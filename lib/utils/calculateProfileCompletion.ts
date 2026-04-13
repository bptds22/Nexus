/* ─────────────────────────────────────────────────────────────────
   Shared profile completion calculator — single source of truth.
   Thin wrapper that forwards to lib/utils/profileCompletion.ts so
   there is only one set of weights in the codebase.
───────────────────────────────────────────────────────────────── */

import { calculateCompletion, type AthleteLike, type EvalLike } from "./profileCompletion";

function extractEval(row: Record<string, unknown>): EvalLike | null {
  const raw = row.evaluations;
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as EvalLike) || null;
  return raw as EvalLike;
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
