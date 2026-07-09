import { NextResponse } from "next/server";
import { createClient as createSbClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/stripe/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/stripe/portal
   Opens a Stripe Billing Portal session for the authenticated user
   and returns its URL. The client redirects the browser there to
   manage / cancel / update the subscription and payment method.

   The return_url is derived SERVER-SIDE from the user's role — the
   client never supplies a redirect target (open-redirect guard).
═══════════════════════════════════════════════════════════════ */

const ROLE_RETURN_PATH: Record<string, string> = {
  RECRUTEUR: "/recruteur/parametres",
  COACH: "/coach/settings",
  ATHLETE: "/athlete/parametres",
};

// ── CORS — mirror du checkout : la WebView Capacitor appelle cross-origin
//    depuis ces origines fixes (allowlist stricte, pas de wildcard). ──
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
export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  try {
    // ── 1. Auth (dual: mobile Bearer OR web cookies) — mirror checkout ──
    let supabase: SupabaseClient;
    let user;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      supabase = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data } = await supabase.auth.getUser(token);
      user = data.user;
    } else {
      supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401, headers: cors });
    }

    // ── 2. Resolve the Stripe customer id (service role) ─────
    const serviceClient = createServiceClient();
    const { data: subRow } = await serviceClient
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = subRow?.stripe_customer_id as string | null;
    if (!customerId) {
      return NextResponse.json({ error: "Aucun abonnement Stripe trouvé" }, { status: 400, headers: cors });
    }

    // ── 3. Derive return_url server-side from the user role ──
    const { data: userRow } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    const path = ROLE_RETURN_PATH[(userRow?.role as string) ?? ""] ?? "/";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${appUrl}${path}`;

    // ── 4. Create the Billing Portal session ─────────────────
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      locale: "fr-CA",
    });

    return NextResponse.json({ url: session.url }, { headers: cors });
  } catch (err) {
    console.error("[stripe/portal] error:", err);
    return NextResponse.json(
      { error: "Erreur lors de l'ouverture du portail de facturation" },
      { status: 500, headers: cors },
    );
  }
}
