/* ═══════════════════════════════════════════════════════════════
   Subscription & access helpers (client-side, reads localStorage)
═══════════════════════════════════════════════════════════════ */

export function hasSchoolAccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
    return user.subscription?.tier === "coach_pro" || user.is_school_admin === true;
  } catch { return false; }
}

export function isSchoolAdmin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
    return user.is_school_admin === true;
  } catch { return false; }
}

export function isCoachPro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
    return user.subscription?.tier === "coach_pro";
  } catch { return false; }
}

export function isAlsoCoach(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
    return user.is_also_coach !== false; // default true
  } catch { return true; }
}
