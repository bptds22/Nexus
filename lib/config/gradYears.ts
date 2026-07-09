/**
 * Graduation-year options — single source of truth for every
 * "année de diplomation / promotion" picker (athlete onboarding mobile +
 * web, athlete wizard). Replaces the 3 divergent hardcoded lists that
 * previously lived inline in each component.
 *
 * Rolling window: current calendar year through +10 years INCLUSIVE
 * (11 values — e.g. 2026→2036). These consumers are all client
 * components, so `new Date()` evaluates in the browser at runtime and
 * the list advances automatically each year — no code change needed.
 *
 * Pattern mirrors lib/config/civilVocab.ts : JSDoc header, type at top,
 * named exports, inline-computed values (no DB-driven).
 */

export interface GradYearOption {
  value: string;
  label: string;
}

/** How many years ahead of the current year to offer (inclusive). */
const YEARS_AHEAD = 10;

const CURRENT_YEAR = new Date().getFullYear();

export const GRAD_YEAR_OPTIONS: GradYearOption[] = Array.from(
  { length: YEARS_AHEAD + 1 },
  (_, i) => {
    const y = String(CURRENT_YEAR + i);
    return { value: y, label: y };
  },
);

/**
 * Sensible default = the current calendar year (first option). Matches
 * the prior hardcoded default behavior, now de-staled.
 */
export const DEFAULT_GRAD_YEAR = String(CURRENT_YEAR);
