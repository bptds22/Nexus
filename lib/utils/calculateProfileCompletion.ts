/* ─────────────────────────────────────────────────────────────────
   Shared profile completion calculator — single source of truth.
   Thin wrapper that forwards to lib/utils/profileCompletion.ts so
   there is only one set of weights in the codebase.
───────────────────────────────────────────────────────────────── */

import { calculateCompletion, type AthleteLike, type EvalLike } from "./profileCompletion";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";

function extractEval(row: Record<string, unknown>): EvalLike | null {
  const raw = row.evaluations;
  if (!raw) return null;
  // Latest-eval-wins : la plus récente (updated_at) — même règle que l'affichage.
  // Retombe sur l'ordre du tableau si la requête n'a pas sélectionné updated_at.
  const arr = Array.isArray(raw) ? raw : [raw];
  return (selectBestEvaluation(arr as Record<string, unknown>[]) as EvalLike) || null;
}

/**
 * Calculate profile completion percentage from a raw athlete DB row.
 * If the row embeds `evaluations` (from a Supabase join), they're used.
 * Returns 0-100.
 */
export function calculateProfileCompletion(athlete: Record<string, unknown>): number {
  if (!athlete) return 0;
  const ev = extractEval(athlete);
  return calculateCompletion(athlete as AthleteLike, ev, null).percentage;
}

/**
 * Backward-compatible legacy export — returns the same shape the
 * athlete profile sidebar expected ({ label, boost }).
 */
export function getIncompleteFields(athlete: Record<string, unknown>): { label: string; boost: number }[] {
  if (!athlete) return [];
  const ev = extractEval(athlete);
  return calculateCompletion(athlete as AthleteLike, ev, null)
    .missing
    .map((m) => ({ label: m.label, boost: m.weight }));
}
