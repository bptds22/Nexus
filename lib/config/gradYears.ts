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
 * Sec 5 un « diplômé » à l'automne. Les écrans coach web l'utilisent aussi depuis le lot B4 (le mobile, au lot B5).
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

/** Athlète CÉGÉPIEN (lot C1 cégep, décision BP 2026-10-27) — « Année où tu finis ton cégep », même
 *  colonne annee_diplomation, aucune nouvelle colonne. De la fin de la saison courante à +3 : en
 *  2026-2027, 2027 → 2030. Couvre un DEC préuniversitaire (2 ans) commencé à l'automne 2025 qui finit
 *  en 2027, jusqu'à une technique (3 ans) commencée à l'automne 2026 et allongée d'une session ou d'un
 *  an (2030) — un parcours d'athlète au cégep est souvent étiré. Aucun défaut, et la même règle
 *  `garder` que le Sec 5. */
export function optionsAnneeCegep(d: Date = new Date(), garder?: string | null): GradYearOption[] {
  const fin = Number(saisonCourante(d).slice(0, 4)) + 1;
  const annees = Array.from({ length: 4 }, (_, i) => String(fin + i));
  if (garder && !annees.includes(garder)) annees.push(garder);
  return annees.sort().map((y) => ({ value: y, label: y }));
}

export const LIBELLE_ANNEE_CEGEP = "Année où tu finis ton cégep";

/** Écrans COACH (création et modification d'athlète, lot B4 cégep, décision BP 2026-10-26) :
 *  même fenêtre que l'athlète (optionsAnneeSec5), sans présélection. */
export const LIBELLE_ANNEE_SEC5_COACH = "Année où il finit son Sec 5";

/* ── Libellé de promotion (lot B4 cégep, décision BP 2026-10-26 ; « Cégep » au lieu de « DEC »
   depuis le lot C1, décision BP 2026-10-27) ───────────────────────────────────────────────────────
   « Cégep AAAA » quand l'école d'ancrage de l'athlète est un cégep, sinon « Secondaire AAAA ».
   JAMAIS l'année seule. `typeEcole` = schools.type de athletes.school_id (même définition que
   le cégépien du lot A). */
export function libellePromotion(
  annee: number | string | null | undefined,
  typeEcole: string | null | undefined,
): string | null {
  const a = Number(annee);
  if (annee == null || annee === "" || !Number.isInteger(a) || a <= 0) return null;
  return (typeEcole ?? "").trim().toUpperCase() === "CEGEP" ? `Cégep ${a}` : `Secondaire ${a}`;
}

/** Ce que couvre une option du filtre Promotion : le filtre porte sur l'année, le libellé dit
 *  de quelle fin d'études il s'agit. « les_deux » quand la liste peut mêler secondaire et cégep
 *  (partenaire, Type non choisi). */
export type PortéePromotion = "secondaire" | "dec" | "les_deux";

export function libelleOptionPromotion(annee: number | string, portee: PortéePromotion): string {
  if (portee === "dec") return `Cégep ${annee}`;
  if (portee === "les_deux") return `Secondaire ou Cégep ${annee}`;
  return `Secondaire ${annee}`;
}

/** Portée du filtre Promotion selon le Type choisi (« collegial » → Cégep) et la présence
 *  possible de cégépiens dans la liste (faux pour coach et recruteur collégial). */
export function porteePromotion(typeChoisi: string | null | undefined, cegepiensPossibles: boolean): PortéePromotion {
  if (typeChoisi === "collegial") return "dec";
  if (typeChoisi) return "secondaire";
  return cegepiensPossibles ? "les_deux" : "secondaire";
}
