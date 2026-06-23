/* ═══════════════════════════════════════════════════════════════
   Shared settings utils — identity-agnostic helpers extracted from
   RecruteurParametresMobile so coach + recruiter share the same
   haptic + open-external + tier-status semantics.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export async function triggerHaptic(intensity: "Light" | "Medium" | "Heavy" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style =
      intensity === "Heavy" ? ImpactStyle.Heavy :
      intensity === "Medium" ? ImpactStyle.Medium :
      ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

export async function openExternal(url: string) {
  try {
    if (IS_CAPACITOR) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/* ── API base URL ──────────────────────────────────────────────
   Base to prefix API fetches with. On web it is "" so calls stay
   relative (current behavior, strictly unchanged). On the Capacitor
   static export there is no server origin, so we reuse the absolute
   NEXT_PUBLIC_APP_URL (the same var already used for Stripe
   success/cancel URLs — no new env var) with any trailing slash
   stripped to avoid double slashes when concatenated with a path.

   NOTE: not wired anywhere yet — pure helper. */
export function getApiBase(): string {
  if (IS_CAPACITOR) {
    return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  }
  return "";
}

/* ── Mobile Stripe checkout ────────────────────────────────────
   Mobile-side checkout: grab the current access_token, POST to the
   checkout route at an ABSOLUTE url with a Bearer header (the static
   export has no cookie/server origin), then open the returned Stripe
   url in the native in-app browser. Every failure throws (detectable),
   never silent — this is a payment path.

   NOTE: not wired to any TierCard yet — pure helper. Refresh-on-return
   is handled by the caller (next unit), not here. */
export async function startMobileCheckout(tier: string, cycle: string): Promise<void> {
  // 1. Current session from the mobile (localStorage-backed) client singleton.
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Session absente");

  // 2. Absolute API base. On mobile it MUST resolve — fail loudly rather
  //    than silently hit a relative (server-less) url on a payment route.
  const base = getApiBase();
  if (IS_CAPACITOR && !base) {
    throw new Error("NEXT_PUBLIC_APP_URL manquant dans le build mobile");
  }

  // 3. Checkout request carrying the Bearer token.
  const res = await fetch(`${base}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tier, cycle }),
  });
  if (!res.ok) {
    throw new Error(`Échec de la création du checkout (HTTP ${res.status})`);
  }
  const { url } = await res.json();
  if (!url) throw new Error("URL de checkout absente dans la réponse");

  // 4. Open Stripe checkout in the native browser.
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/* ── Mobile Stripe billing portal ──────────────────────────────
   Comme startMobileCheckout mais pour le PORTAIL : Bearer token →
   POST /api/stripe/portal → ouvre l'URL du portail Stripe dans l'in-app
   browser. Le route portal accepte désormais le Bearer (dual-auth, mirror
   checkout). Throw sur chaque échec (jamais silencieux — c'est un chemin
   facturation). Le refresh du tier au retour est géré par l'appelant
   (browserFinished/appStateChange, déjà en place pour le checkout). */
export async function startMobilePortal(): Promise<void> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Session absente");

  const base = getApiBase();
  if (IS_CAPACITOR && !base) {
    throw new Error("NEXT_PUBLIC_APP_URL manquant dans le build mobile");
  }

  const res = await fetch(`${base}/api/stripe/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Échec de l'ouverture du portail (HTTP ${res.status})`);
  }
  const { url } = await res.json();
  if (!url) throw new Error("URL du portail absente dans la réponse");

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/* ── Résumé abonnement (formatage partagé mobile) ──────────────── */

/** Date "fr-CA" longue (ex: "3 mars 2026"). null → "—". */
export function fmtSubDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/** Libellé FR du statut d'abonnement. */
export function subStatusLabel(status: string): string {
  switch (status) {
    case "trialing": return "Essai";
    case "past_due": return "Paiement en retard";
    case "canceled": return "Annulé";
    default: return "Actif";
  }
}

/* ── Tier ranking — drives TierCard's current/upgrade/below state ── */

export type TierKey = "free" | "pro" | "all_star";
export type TierStatus = "current" | "upgrade" | "below";

export function tierStatus(userTier: TierKey, cardTier: TierKey): TierStatus {
  const rank: Record<TierKey, number> = { free: 0, pro: 1, all_star: 2 };
  if (userTier === cardTier) return "current";
  if (rank[cardTier] > rank[userTier]) return "upgrade";
  return "below";
}
