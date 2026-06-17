import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import { createServiceClient } from "@/lib/supabase/service";
import { planFromPriceId } from "@/lib/stripe/prices";

/* ═══════════════════════════════════════════════════════════════
   POST /api/stripe/webhook
   Receives Stripe events, verifies signature, writes subscription
   state via service-role. Idempotent (stripe_webhook_events).

   SECURITY:
   - Signature verification on RAW body (req.text(), not req.json())
   - Nothing runs before signature passes
   - admin_grant rows are never modified (SQL WHERE guard)
   - Locked to service_role writes (apply_stripe_subscription fn)
═══════════════════════════════════════════════════════════════ */

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(req: Request) {
  const stripe = getStripe();
  const supabase = createServiceClient();

  // ── 1. SIGNATURE VERIFICATION (raw body, mandatory) ────────
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── 2. IDEMPOTENCY (stripe_webhook_events) ────────────────
  const { data: inserted, error: idempErr } = await supabase
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object as unknown,
      status: "PENDING",
    })
    .select("id")
    .maybeSingle();

  if (idempErr) {
    // UNIQUE violation = already processed (concurrent delivery)
    if (idempErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe/webhook] idempotency insert error:", idempErr);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  if (!inserted) {
    // Shouldn't happen (insert succeeded but no row returned), treat as duplicate
    return NextResponse.json({ received: true });
  }

  const webhookEventId = inserted.id as string;

  // ── 3. ROUTE TO HANDLER ───────────────────────────────────
  if (!HANDLED_EVENTS.has(event.type)) {
    await markEvent(supabase, webhookEventId, "IGNORED");
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, supabase, event);
        break;
      // Both created and updated apply the full subscription state. A fresh
      // checkout often emits `created`, so it must not be a no-op.
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(supabase, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, event);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(supabase, event);
        break;
    }

    await markEvent(supabase, webhookEventId, "PROCESSED");
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe/webhook] ${event.type} handler error:`, err);
    await markEvent(supabase, webhookEventId, "FAILED", (err as Error).message);
    // 500 so Stripe retries (handler is idempotent)
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }
}

/* ── Helpers ───────────────────────────────────────────────── */

async function markEvent(
  supabase: ReturnType<typeof createServiceClient>,
  id: string,
  status: "PROCESSED" | "FAILED" | "IGNORED",
  error?: string,
) {
  await supabase
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: new Date().toISOString(),
      ...(error ? { error } : {}),
    })
    .eq("id", id);
}

function resolveUserId(metadata: Stripe.Metadata | null): string | null {
  return metadata?.supabase_user_id ?? null;
}

/* Stripe sends timestamps as integer SECONDS. JS Date expects MILLISECONDS,
   so multiply by 1000. Guard null/undefined/non-finite — passing those into
   new Date(...).toISOString() throws "Invalid time value". */
function epochToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/* current_period_start/end moved off the top-level subscription object onto
   the subscription ITEM in recent Stripe API versions. Read the item first,
   fall back to the top-level field for older payloads. Returns epoch seconds. */
function readPeriod(item: Stripe.SubscriptionItem, subscription: Stripe.Subscription) {
  const i = item as unknown as { current_period_start?: number; current_period_end?: number };
  const s = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    start: i.current_period_start ?? s.current_period_start ?? null,
    end: i.current_period_end ?? s.current_period_end ?? null,
  };
}

async function resolveUserIdFromCustomer(
  supabase: ReturnType<typeof createServiceClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.user_id as string) ?? null;
}

/* ── checkout.session.completed ────────────────────────────── */

async function handleCheckoutCompleted(
  stripe: ReturnType<typeof getStripe>,
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
) {
  const session = event.data.object as Stripe.Checkout.Session;

  const userId = resolveUserId(session.metadata)
    ?? await resolveUserIdFromCustomer(supabase, session.customer as string);
  if (!userId) throw new Error("Cannot resolve supabase_user_id from checkout session");

  // Retrieve the full subscription to get price, period, status
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no line items");

  const plan = planFromPriceId(item.price.id);
  if (!plan) throw new Error(`Unknown price_id: ${item.price.id}`);

  const period = readPeriod(item, subscription);

  await supabase.rpc("apply_stripe_subscription", {
    p_user_id: userId,
    p_tier: plan.tier,
    p_status: "active",
    p_billing_cycle: plan.cycle,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: item.price.id,
    p_current_period_start: epochToIso(period.start),
    p_current_period_end: epochToIso(period.end),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_canceled_at: epochToIso(subscription.canceled_at),
  });
}

/* ── customer.subscription.created / .updated ──────────────── */

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
) {
  const subscription = event.data.object as Stripe.Subscription;

  const userId = resolveUserId(subscription.metadata)
    ?? await resolveUserIdFromCustomer(supabase, subscription.customer as string);
  if (!userId) throw new Error("Cannot resolve supabase_user_id from subscription");

  const item = subscription.items.data[0];
  if (!item) throw new Error("Subscription has no line items");

  const plan = planFromPriceId(item.price.id);
  if (!plan) throw new Error(`Unknown price_id: ${item.price.id}`);

  // Map Stripe status → our status
  const status = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "past_due"
      ? "past_due"
      : subscription.status === "canceled" || subscription.status === "unpaid"
        ? "canceled"
        : "active";

  const period = readPeriod(item, subscription);

  await supabase.rpc("apply_stripe_subscription", {
    p_user_id: userId,
    p_tier: plan.tier,
    p_status: status,
    p_billing_cycle: plan.cycle,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: item.price.id,
    p_current_period_start: epochToIso(period.start),
    p_current_period_end: epochToIso(period.end),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_canceled_at: epochToIso(subscription.canceled_at),
  });
}

/* ── customer.subscription.deleted ─────────────────────────── */

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
) {
  const subscription = event.data.object as Stripe.Subscription;

  const userId = resolveUserId(subscription.metadata)
    ?? await resolveUserIdFromCustomer(supabase, subscription.customer as string);
  if (!userId) throw new Error("Cannot resolve supabase_user_id from subscription");

  // Reset to free — keep stripe_customer_id for future resubscription
  await supabase.rpc("apply_stripe_subscription", {
    p_user_id: userId,
    p_tier: "free",
    p_status: "canceled",
    p_billing_cycle: null,
    p_stripe_subscription_id: subscription.id,
    p_stripe_price_id: null,
    p_current_period_start: null,
    p_current_period_end: null,
    p_cancel_at_period_end: false,
    p_canceled_at: epochToIso(subscription.canceled_at) ?? new Date().toISOString(),
  });
}

/* ── invoice.payment_failed ────────────────────────────────── */

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoice.subscription as string | null;
  if (!subscriptionId) return; // One-off invoice, not subscription-related

  // Find the user by stripe_subscription_id
  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("user_id, tier, billing_cycle, stripe_price_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!subRow) return; // Unknown subscription, ignore

  // Set status to past_due — get_user_tier only reads status='active',
  // so the user effectively drops to free until payment is resolved.
  await supabase.rpc("apply_stripe_subscription", {
    p_user_id: subRow.user_id,
    p_tier: subRow.tier,
    p_status: "past_due",
    p_billing_cycle: subRow.billing_cycle,
    p_stripe_subscription_id: subscriptionId,
    p_stripe_price_id: subRow.stripe_price_id,
    p_current_period_start: null,
    p_current_period_end: null,
    p_cancel_at_period_end: false,
    p_canceled_at: null,
  });
}
