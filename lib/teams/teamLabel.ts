/* ═══════════════════════════════════════════════════════════════
   teamLabel — single source of truth for the team display label in
   the onboarding pickers (coach école / civil, recruiter Programme).

   Format: "Sport · Catégorie · Division · Genre" — sport FIRST so the
   list is unambiguous when teams of several sports are shown together
   (the picker no longer filters by sport). Empty fields are dropped;
   if everything is empty, falls back to the team name.

   Web shows these as pills + this string; mobile shows the string —
   both source the same fields, so the two surfaces never diverge.
═══════════════════════════════════════════════════════════════ */

export function formatTeamLabel(
  sport: string | null | undefined,
  ageGroup: string | null | undefined,
  division: string | null | undefined,
  gender: string | null | undefined,
  fallbackName?: string | null,
): string {
  const parts = [sport, ageGroup, division, gender]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0);
  return parts.length > 0 ? parts.join(" · ") : (fallbackName ?? "").trim();
}
