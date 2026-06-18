/* ═══════════════════════════════════════════════════════════════
   Shared settings utils — identity-agnostic helpers extracted from
   RecruteurParametresMobile so coach + recruiter share the same
   haptic + open-external + tier-status semantics.
═══════════════════════════════════════════════════════════════ */

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

/* ── Tier ranking — drives TierCard's current/upgrade/below state ── */

export type TierKey = "free" | "pro" | "all_star";
export type TierStatus = "current" | "upgrade" | "below";

export function tierStatus(userTier: TierKey, cardTier: TierKey): TierStatus {
  const rank: Record<TierKey, number> = { free: 0, pro: 1, all_star: 2 };
  if (userTier === cardTier) return "current";
  if (rank[cardTier] > rank[userTier]) return "upgrade";
  return "below";
}
