/**
 * Current school season as a "YYYY-YYYY" string (e.g. "2025-2026").
 *
 * Boundary: Aug 1. A school year starts in August and ends end-of-July
 * the following calendar year. This aligns with how secondary schools
 * and CÉGEPs structure their year.
 *
 * Replaces ~10 hardcoded "2025-2026" / "2026-2027" call sites across
 * coach + recruteur + onboarding flows. Static dropdown options
 * (coach/ecole/stats, coach/equipes new-team form, edit-team modal)
 * are intentionally NOT consumed by this helper — those let users
 * pick a year explicitly and need their own seasonOptions() helper
 * if we want to make them dynamic. Tracked separately as P3 debt.
 *
 * Mock data + placeholder strings ("Ex: 2025-2026") also kept static.
 */
export function getCurrentSeason(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (Jan=0, Aug=7)
  // Aug or later -> season starts this year; Jan-Jul -> season started last year
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}