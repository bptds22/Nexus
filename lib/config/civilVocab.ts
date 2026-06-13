/**
 * Civil-league team vocab — single source of truth for the age category
 * and division selects on the team create form (and any future surface
 * that needs to constrain these to a known list).
 *
 * One combined list across all sports : hockey M-series + soccer-style
 * U-series + RSEQ Novice/Atome/etc + civil AAA/AA/A + Division 1-4 + an
 * "Autre" escape hatch. When "Autre" is picked, the UI MUST render a
 * required free-text input; the typed value is what gets stored, NEVER
 * the literal string "Autre". This avoids the prior bug where the
 * sentinel string landed in teams.age_group with no further detail.
 *
 * Pattern mirrors lib/config/pricing.ts : JSDoc header, type at top,
 * named array exports, all values inline literals (no DB-driven).
 */

export interface VocabOption {
  value: string;
  label: string;
}

/**
 * Sentinel for the free-text branch on both selects. When the form sees
 * this value, it reveals a required text input and substitutes the
 * trimmed text on submit. Never written to the DB as-is.
 */
export const AUTRE_VALUE = "Autre";

export const AGE_OPTIONS: VocabOption[] = [
  { value: "M9",        label: "M9" },
  { value: "M11",       label: "M11" },
  { value: "M13",       label: "M13" },
  { value: "M15",       label: "M15" },
  { value: "M18",       label: "M18" },
  { value: "U9",        label: "U9" },
  { value: "U11",       label: "U11" },
  { value: "U13",       label: "U13" },
  { value: "U15",       label: "U15" },
  { value: "U18",       label: "U18" },
  { value: "Novice",    label: "Novice" },
  { value: "Atome",     label: "Atome" },
  { value: "Moustique", label: "Moustique" },
  { value: "Pee-Wee",   label: "Pee-Wee" },
  { value: "Bantam",    label: "Bantam" },
  { value: "Midget",    label: "Midget" },
  { value: "Junior",    label: "Junior" },
  { value: "Senior",    label: "Senior" },
  { value: AUTRE_VALUE, label: "Autre" },
];

export const DIVISION_OPTIONS: VocabOption[] = [
  { value: "AAA",         label: "AAA" },
  { value: "AA",          label: "AA" },
  { value: "A",           label: "A" },
  { value: "BB",          label: "BB" },
  { value: "B",           label: "B" },
  { value: "CC",          label: "CC" },
  { value: "C",           label: "C" },
  { value: "Division 1",  label: "Division 1" },
  { value: "Division 2",  label: "Division 2" },
  { value: "Division 3",  label: "Division 3" },
  { value: "Division 4",  label: "Division 4" },
  { value: AUTRE_VALUE,   label: "Autre" },
];

/**
 * Genre — extracted from the inline GENDER_OPTIONS in
 * CoachOnboardingMobileCivil so every team-create surface (manual
 * web, mobile teams, both onboardings) renders the same 3 choices.
 * Values match the civil RPC convention (capitalized French) ; the
 * league_teams.gender CHECK on the DB uses lowercase masculin/
 * feminin/mixte and is mapped by callers on insert when applicable.
 */
export const GENDER_OPTIONS: VocabOption[] = [
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin",  label: "Féminin" },
  { value: "Mixte",    label: "Mixte" },
];

/**
 * Saison — used by the team create form's season select. Adopt the
 * same lazy-rolling list every other surface uses (current + next).
 */
export const SEASON_OPTIONS: VocabOption[] = [
  { value: "2025-2026", label: "2025-2026" },
  { value: "2026-2027", label: "2026-2027" },
];
