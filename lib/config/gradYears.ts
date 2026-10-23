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

import { saisonCourante } from "@/lib/queries/schoolPage/saisonEnCours";

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

/**
 * Onboarding ATHLÈTE seulement (décision BP, 2026-10-22) — « Année où tu
 * finis ton Sec 5 ». De la fin de la saison courante (bascule au 1er juillet,
 * saisonCourante()) à +4 : en 2026-2027, 2027 (Sec 5) → 2031 (Sec 1). Aucun
 * défaut : l'ancienne présélection de l'année CIVILE faisait d'un élève de
 * Sec 5 un « diplômé » à l'automne. Les écrans coach gardent GRAD_YEAR_OPTIONS.
 *
 * `garder` : une année déjà enregistrée hors de la fenêtre (reprise d'un
 * onboarding) reste dans la liste, sinon le menu afficherait une autre valeur
 * que celle qui sera écrite.
 */
export function optionsAnneeSec5(d: Date = new Date(), garder?: string | null): GradYearOption[] {
  const fin = Number(saisonCourante(d).slice(0, 4)) + 1;
  const annees = Array.from({ length: 5 }, (_, i) => String(fin + i));
  if (garder && !annees.includes(garder)) annees.push(garder);
  return annees.sort().map((y) => ({ value: y, label: y }));
}

export const LIBELLE_ANNEE_SEC5 = "Année où tu finis ton Sec 5";
