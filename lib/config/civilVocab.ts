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
  // Catégories RSEQ scolaires (secondaire) — en tête car ce sont les
  // plus courantes côté scolaire ; partagées avec le flux civil.
  { value: "Benjamin",  label: "Benjamin" },
  { value: "Cadet",     label: "Cadet" },
  { value: "Juvénile",  label: "Juvénile" },
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
  // Catégorie = âge + CALIBRE (BP 2026-10-09) : les groupes civils importés
  // sont rangés ainsi (lib/civil/classementCivil.ts). Sans ces valeurs, un coach
  // de « Pee-Wee AAA » ne pouvait pas retrouver son équipe existante — la
  // détection compare la catégorie exacte — et en créait une seconde.
  { value: "Moustique AAA", label: "Moustique AAA" },
  { value: "Pee-Wee AAA",   label: "Pee-Wee AAA" },
  { value: "Bantam AAA",    label: "Bantam AAA" },
  { value: "Midget AAA",    label: "Midget AAA" },
  { value: "M18 AAA",       label: "M18 AAA" },
  { value: "Junior Majeur", label: "Junior Majeur" },
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
 * « Aucune division » (BP 2026-10-09). Certains groupes civils n'ont PAS de
 * niveau : Atome Nord / Atome Sud (LFMM) sont rangés avec division '' en base.
 * Sans ce choix, un coach de ces groupes devait inventer une division pour
 * passer le formulaire (division obligatoire) — l'équipe existante ne
 * correspondait plus et il en créait une DEUXIÈME.
 *
 * Sentinelle, comme AUTRE_VALUE : jamais écrite en base, toujours résolue en
 * '' par divisionChoisie(). Liste À PART (DIVISION_OPTIONS reste inchangée) :
 * l'inscription mobile civile lit DIVISION_OPTIONS avec sa propre résolution,
 * qui ne connaît pas cette sentinelle — elle l'écrirait telle quelle. Seules
 * les surfaces qui résolvent par divisionChoisie() prennent cette liste.
 */
export const AUCUNE_DIVISION = "__AUCUNE_DIVISION__";

export const DIVISION_OPTIONS_AVEC_AUCUNE: VocabOption[] = [
  { value: AUCUNE_DIVISION, label: "Aucune (pas de niveau)" },
  ...DIVISION_OPTIONS,
];

/** Valeur ENREGISTRÉE d'un choix de division : « Autre » → texte saisi,
 *  « Aucune » → '' ; sinon le choix tel quel. */
export function divisionChoisie(choix: string, autre: string): string {
  if (choix === AUCUNE_DIVISION) return "";
  if (choix === AUTRE_VALUE) return autre.trim();
  return choix;
}

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
