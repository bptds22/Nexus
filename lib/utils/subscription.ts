/* ═══════════════════════════════════════════════════════════════
   Subscription & access helpers (client-side, reads localStorage)

   Tier hierarchy per role:
     Coach:     free → coach_pro ($5.99) → coach_allstar ($29.99)
     Recruiter: free → recruteur_pro ($9.99) → recruteur_allstar ($29.99)
     Athlete:   free → athlete_pro ($9.99)
═══════════════════════════════════════════════════════════════ */

export type SubscriptionTier =
  | "free"
  | "coach_pro" | "coach_allstar"
  | "recruteur_pro" | "recruteur_allstar"
  | "athlete_pro";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

export interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "annual" | null;
  current_period_end: string | null;
  trial_days_remaining: number | null;
  cancel_at_period_end: boolean;
}

function getUser(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("nexus_user") || "{}"); }
  catch { return {}; }
}

function getSub(): SubscriptionData {
  const user = getUser();
  return (user.subscription as SubscriptionData) || { tier: "free", status: "active", billing_cycle: null, current_period_end: null, trial_days_remaining: null, cancel_at_period_end: false };
}

/* ── Tier checks ─────────────────────────────────────────── */

export function getTier(): SubscriptionTier {
  return getSub().tier || "free";
}

export function getSubscription(): SubscriptionData {
  return getSub();
}

export function isFree(): boolean { return getTier() === "free"; }
export function isPro(): boolean { return ["coach_pro", "recruteur_pro", "athlete_pro"].includes(getTier()); }
export function isAllStar(): boolean { return ["coach_allstar", "recruteur_allstar"].includes(getTier()); }
export function isTrialing(): boolean { return getSub().status === "trialing"; }
export function isPastDue(): boolean { return getSub().status === "past_due"; }
export function isCanceled(): boolean { return getSub().status === "canceled"; }

/* ── School / CÉGEP access (Pro OR AllStar OR Admin) ─────── */

export function hasSchoolAccess(): boolean {
  const user = getUser();
  const tier = (user.subscription as SubscriptionData)?.tier || "free";
  return tier === "coach_pro" || tier === "coach_allstar" || user.is_school_admin === true;
}

export function isSchoolAdmin(): boolean {
  return getUser().is_school_admin === true;
}

export function isCoachPro(): boolean {
  const tier = getTier();
  return tier === "coach_pro" || tier === "coach_allstar";
}

export function isAlsoCoach(): boolean {
  const user = getUser();
  return user.is_also_coach !== false;
}

export function hasCegepAccess(): boolean {
  const user = getUser();
  const tier = (user.subscription as SubscriptionData)?.tier || "free";
  // Only All Star or Admin CÉGEP unlocks CÉGEP management (Pro does NOT)
  return tier === "recruteur_allstar" || user.is_cegep_admin === true;
}

export function isCegepAdmin(): boolean {
  return getUser().is_cegep_admin === true;
}

export function isRecruiterPro(): boolean {
  const tier = getTier();
  return tier === "recruteur_pro" || tier === "recruteur_allstar";
}

export function isAlsoRecruiter(): boolean {
  const user = getUser();
  return user.is_also_recruiter !== false;
}

/* ── Display helpers ─────────────────────────────────────── */

export function getTierLabel(tier: SubscriptionTier): string {
  const labels: Record<SubscriptionTier, string> = {
    free: "Gratuit",
    coach_pro: "Coach Pro",
    coach_allstar: "Coach All Star",
    recruteur_pro: "Recruteur Pro",
    recruteur_allstar: "Recruteur All Star",
    athlete_pro: "Athlète Pro",
  };
  return labels[tier] || "Gratuit";
}

export function getTierColor(tier: SubscriptionTier): string {
  if (tier === "free") return "#6B7280";
  if (tier.includes("allstar")) return "#E63946";
  return "#DAB65A"; // Pro = gold
}

export type SidebarState = "free" | "pro" | "allstar" | "trial" | "admin" | "past_due" | "canceled";

export function isAtLeastPro(): boolean {
  return isPro() || isAllStar();
}

export function hasFullAccess(): boolean {
  return isAllStar() || isSchoolAdmin() || isCegepAdmin();
}

export function hasMessaging(): boolean {
  return isAtLeastPro();
}

export function hasExport(): boolean {
  return isAllStar();
}

export function getSidebarState(): SidebarState {
  const user = getUser();
  if (user.is_school_admin || user.is_cegep_admin) return "admin";
  const sub = getSub();
  if (sub.status === "past_due") return "past_due";
  if (sub.status === "canceled") return "canceled";
  if (sub.status === "trialing") return "trial";
  if (isAllStar()) return "allstar";
  if (isPro()) return "pro";
  return "free";
}
