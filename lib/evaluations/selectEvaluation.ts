/* ═══════════════════════════════════════════════════════════════
   selectEvaluation — single source of truth for picking WHICH coach
   evaluation to display for an athlete, and for the simple/détaillée
   deduction.

   An athlete can hold several evaluation rows (UNIQUE(coach_id,
   athlete_id) → one per coach: coaches, directeur, directeur intérimaire
   each hold at most one). The recruiter/coach views must NOT take
   evaluations[0] (the DB returns an unordered array).

   Selection rule (PO-confirmed, révisé juillet 2026) :
     LA PLUS RÉCENTE GAGNE, TOUJOURS. On trie sur updated_at décroissant
     et on prend la première. Aucune priorité de type : une évaluation
     SIMPLE récente l'emporte sur une DÉTAILLÉE plus ancienne. Ça rend le
     tableau de bord directeur déterministe (« la dernière éval saisie est
     celle qui s'affiche ») et aligne l'affichage sur la colonne
     dénormalisée athletes.cote_globale_entraineur (trigger last-write).

   No coach filter (the rule is date, not owning coach — PO decision).
   This is DISPLAY-only; the write path is untouched.

   isDetailed / EVALUATION_TRAIT_FIELDS restent exportés : ils servent
   AILLEURS à décider l'affichage simple/détaillé d'une éval déjà choisie
   (ils ne participent PLUS à la sélection).

   NOTE: the consuming Supabase query MUST select `updated_at` for the
   sort to work. Sans lui, updatedAtMs → -Infinity pour toutes les lignes
   et la sélection retombe sur l'ordre du tableau (non déterministe).
═══════════════════════════════════════════════════════════════ */

export type EvalRow = Record<string, unknown>;

/** The 14 numeric trait columns that define a DÉTAILLÉE evaluation.
 *  8 mental (integer) + 6 physical/tactical (numeric). Keep this list as
 *  the ONLY copy — both selectBestEvaluation and isDetailed read it. */
export const EVALUATION_TRAIT_FIELDS = [
  "leadership", "discipline", "coachabilite", "intelligence_jeu",
  "competitivite", "esprit_equipe", "resilience", "attitude_mentalite",
  "vitesse_explosivite", "force_puissance", "endurance_cardio",
  "agilite_coordination", "vision_du_jeu", "sens_tactique",
] as const;

/** True when at least one of the 14 trait columns is non-null / non-zero. */
export function isDetailed(evalRow: EvalRow | null | undefined): boolean {
  if (!evalRow) return false;
  return EVALUATION_TRAIT_FIELDS.some((f) => (Number(evalRow[f]) || 0) > 0);
}

/** updated_at as epoch ms; -Infinity when missing/unparseable so it sorts
 *  oldest (robust to a query that forgot to select updated_at). */
function updatedAtMs(evalRow: EvalRow): number {
  const v = evalRow["updated_at"];
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) {
    const t = new Date(v as string | number | Date).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  }
  return -Infinity;
}

/** Pick the evaluation to display: LA PLUS RÉCENTE par updated_at, point.
 *  Robust to empty/null input (→ null), a single row, many rows, and any
 *  DB ordering — never assumes order or a single row. Sur égalité stricte
 *  d'updated_at, garde la première rencontrée (stable). */
export function selectBestEvaluation<T extends EvalRow>(
  evals: readonly T[] | null | undefined,
): T | null {
  if (!Array.isArray(evals) || evals.length === 0) return null;

  let best: T | null = null;
  let bestTime = -Infinity;

  for (const e of evals) {
    if (!e) continue;
    const time = updatedAtMs(e);
    if (best === null || time > bestTime) {
      best = e; bestTime = time;
    }
  }

  return best;
}
