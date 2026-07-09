/* ═══════════════════════════════════════════════════════════════
   selectEvaluation — single source of truth for picking WHICH coach
   evaluation to display for an athlete, and for the simple/détaillée
   deduction.

   An athlete can hold several evaluation rows (UNIQUE(coach_id,
   athlete_id) → one per coach). The recruiter/coach views must NOT
   take evaluations[0] (the DB returns an unordered array). Selection
   rule (PO-confirmed):

     1. TYPE first  — a DÉTAILLÉE evaluation always beats a SIMPLE one.
     2. DATE next   — among same-type rows, the most recent by updated_at.

   Détaillée = at least one of the 14 numeric trait columns is
   non-null / non-zero (8 mental + 6 physical/tactical). cote_globale
   and rapport_entraineur are written in BOTH modes, so they do NOT
   distinguish type.

   No coach filter (the rule is type+date, not owning coach — PO
   decision). This is DISPLAY-only; the write path is untouched.

   NOTE: the consuming Supabase query MUST select `updated_at` for the
   date tiebreaker to work (and the 14 trait columns for the type rule).
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

/** Pick the evaluation to display: détaillée over simple, then most recent
 *  by updated_at. Robust to empty/null input (→ null), a single row, many
 *  rows, and any DB ordering — never assumes order or a single row. */
export function selectBestEvaluation<T extends EvalRow>(
  evals: readonly T[] | null | undefined,
): T | null {
  if (!Array.isArray(evals) || evals.length === 0) return null;

  let best: T | null = null;
  let bestDetailed = false;
  let bestTime = -Infinity;

  for (const e of evals) {
    if (!e) continue;
    const detailed = isDetailed(e);
    const time = updatedAtMs(e);

    if (best === null) {
      best = e; bestDetailed = detailed; bestTime = time;
      continue;
    }
    // 1. TYPE first: a detailed row beats any simple row.
    if (detailed !== bestDetailed) {
      if (detailed) { best = e; bestDetailed = true; bestTime = time; }
      continue;
    }
    // 2. Same type → DATE: keep the most recent by updated_at.
    if (time > bestTime) { best = e; bestTime = time; }
  }

  return best;
}
