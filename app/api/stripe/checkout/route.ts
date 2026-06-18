import { NextResponse } from "next/server";
import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";
import { priceIdFor, type StripePlanRole, type StripePlanTier, type StripePlanCycle } from "@/lib/stripe/prices";

/* ═══════════════════════════════════════════════════════════════
   POST /api/stripe/checkout
   Creates a Stripe Checkout session and returns its URL.

   Body: { tier: 'pro'|'all_star', cycle: 'monthly'|'annual' }
   Role is derived server-side from the authenticated user.

   The client (web or Capacitor Browser) opens the returned URL.
   Tier is NOT written here — only the webhook writes tier after
   payment succeeds.
═══════════════════════════════════════════════════════════════ */

const VALID_TIERS: StripePlanTier[] = ["pro", "all_star"];
const VALID_CYCLES: StripePlanCycle[] = ["monthly", "annual"];
const ROLE_MAP: Record<string, StripePlanRole> = {
  RECRUTEUR: "RECRUTEUR",
  COACH: "COACH",
  ATHLETE: "ATHLETE",
};

// Where to send the user back after checkout (success OR cancel) — the
// settings page they started from. Derived SERVER-SIDE from the role
// (never trust a client-supplied redirect). Mirrors /api/stripe/portal.
const ROLE_RETURN_PATH: Record<string, string> = {
  RECRUTEUR: "/recruteur/parametres",
  COACH: "/coach/settings",
  ATHLETE: "/athlete/parametres",
};

// ── CORS ───────────────────────────────────────────────────
// The Capacitor WebView calls this route cross-origin from these
// fixed origins. Strict allowlist (NO wildcard) — wildcard is
// incompatible with credentialed/auth-header requests and needlessly
// permissive on a payment route. Same-origin web sends no cross
// `Origin`, so it never matches and behaves exactly as before.
const ALLOWED_ORIGINS = ["https://localhost", "capacitor://localhost"];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  return {};
}

// Preflight: browsers send OPTIONS before a cross-origin POST that
// carries Authorization / Content-Type. 204 + CORS headers if allowed.
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  // Computed once; reflected on every response below. Empty {} for
  // same-origin/unknown origins → no CORS headers posted (unchanged).
  const cors = corsHeaders(req);
  try {
    // ── 1. Auth (dual: mobile Bearer OR web cookies) ─────────
    // Mobile (Capacitor static export) has no server-readable cookie,
    // so it sends the Supabase access_token as `Authorization: Bearer`.
    // Web keeps the EXACT cookie-based path unchanged. The resolved
    // `supabase` client carries the user's RLS context downstream in
    // both branches.
    let supabase: SupabaseClient;
    let user;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      // ── Mobile: validate the token with a lightweight anon client.
      //    NEVER use the service role for token validation.
      const token = authHeader.slice("Bearer ".length).trim();
      supabase = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      // ── Web: unchanged cookie-based session.
      supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: cors });
    }

    // ── 2. Get user role from DB (never trust client) ────────
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", user.id)
      .single();

    if (userErr || !userRow) {
      console.error("[stripe/checkout] user lookup:", userErr);
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 400, headers: cors });
    }

    const role = ROLE_MAP[userRow.role as string];
    if (!role) {
      return NextResponse.json({ error: "Rôle non éligible à un abonnement" }, { status: 400, headers: cors });
    }

    // ── 3. Parse + validate body ─────────────────────────────
    let body: { tier?: string; cycle?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400, headers: cors });
    }

    const tier = body.tier as StripePlanTier;
    const cycle = body.cycle as StripePlanCycle;

    if (!VALID_TIERS.includes(tier) || !VALID_CYCLES.includes(cycle)) {
      return NextResponse.json({ error: "tier ou cycle invalide" }, { status: 400, headers: cors });
    }

    // Athlete only has pro — no all_star product
    if (role === "ATHLETE" && tier === "all_star") {
      return NextResponse.json({ error: "Plan non disponible pour les athlètes" }, { status: 400, headers: cors });
    }

    // ── 4. Resolve Stripe price ID ───────────────────────────
    const priceId = priceIdFor(role, tier, cycle);

    // ── 5. Get or create Stripe customer ─────────────────────
    const serviceClient = createServiceClient();
    const { data: subRow } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = getStripe();
    let customerId = subRow?.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userRow.email as string || user.email || undefined,
        metadata: {
          supabase_user_id: user.id,
          role: role,
        },
      });
      customerId = customer.id;

      // Atomic upsert: sets stripe_customer_id on existing rows (incl.
      // admin_grant) without touching tier/tier_source/status. Creates a
      // free/stripe row if none exists. No TOCTOU race — single statement.
      const { error: upsertErr } = await serviceClient.rpc(
        "upsert_stripe_customer",
        { p_user_id: user.id, p_customer_id: customerId },
      );
      if (upsertErr) {
        console.error("[stripe/checkout] upsert_stripe_customer:", upsertErr);
        return NextResponse.json(
          { error: "Erreur lors de la création du profil de paiement" },
          { status: 500, headers: cors },
        );
      }
    }

    // ── 6. Create Checkout session ───────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    // Return the user to the settings page they started from. Tier is
    // written by the webhook (not here), and the success page reads tier
    // from the DB via refresh() — so no {CHECKOUT_SESSION_ID} is needed.
    const returnUrl = `${appUrl}${ROLE_RETURN_PATH[role] ?? "/"}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      // TODO: re-enable automatic_tax once Stripe Tax head office address is fully configured (test mode is rejecting it)
      automatic_tax: { enabled: false },
      metadata: {
        supabase_user_id: user.id,
        role,
        tier,
        cycle,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          role,
          tier,
          cycle,
        },
      },
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=canceled`,
      allow_promotion_codes: false,
      locale: "fr-CA",
    });

    return NextResponse.json({ url: session.url }, { headers: cors });
  } catch (err) {
    console.error("[stripe/checkout] error:", err);
    return NextResponse.json(
      { error: "Erreur lors de la création de la session de paiement" },
      { status: 500, headers: cors },
    );
  }
}
