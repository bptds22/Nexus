/**
 * Email-partial autocomplete — athlètes civils NON-COACHÉS (orphelins totaux
 * OU rattachés à un club LIGUE_CIVILE sans coach). Le coach tape une partie
 * de l'email, des suggestions s'affichent, clic = autofill + invitation.
 *
 * Sécurité / vie privée :
 * - Passe par la RPC SECURITY DEFINER `lookup_civil_unclaimed_by_email`
 *   (migration 20260628120000) qui :
 *     • garde is_coach() (keyée sur auth.uid() = l'appelant),
 *     • critère coach_id IS NULL AND (school_id IS NULL OR type='LIGUE_CIVILE')
 *       → exclut scolaire/cégep + déjà-coaché,
 *     • ne renvoie QUE nom/email/sport → AUCUNE PII (DOB, parent, téléphone).
 * - Min 4 caractères + max 3 résultats + LIMIT 3 côté SQL (anti-énumération).
 * - Rate limit en mémoire : 10 queries / 60s par session (défense en profondeur).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_QUERY_LENGTH = 4;

const lookupHistory: number[] = [];
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type AutocompleteStatus = "ok" | "too_short" | "rate_limited" | "no_results" | "error";

export interface AthleteEmailSuggestion {
  userId: string;
  athleteId: string;
  email: string;
  firstName: string;
  lastName: string;
  sportName: string | null;
}

export interface AthleteEmailAutocompleteResult {
  status: AutocompleteStatus;
  suggestions: AthleteEmailSuggestion[];
}

/** Forme d'une row renvoyée par la RPC lookup_civil_unclaimed_by_email. */
interface CivilUnclaimedRow {
  user_id: string;
  athlete_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  sport_name: string | null;
}

/**
 * Cherche les athlètes civils non-coachés par email partial (ILIKE 'prefix%').
 *
 * @param supabase Client Supabase
 * @param partial Partie de l'email tapée par le coach
 * @returns Résultat structuré pour affichage UI dropdown
 */
export async function autocompleteCivilUnclaimedByEmail(
  supabase: SupabaseClient,
  partial: string,
): Promise<AthleteEmailAutocompleteResult> {
  const trimmed = partial.trim().toLowerCase();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { status: "too_short", suggestions: [] };
  }

  const now = Date.now();
  while (lookupHistory.length > 0 && lookupHistory[0] < now - RATE_LIMIT_WINDOW_MS) {
    lookupHistory.shift();
  }

  if (lookupHistory.length >= RATE_LIMIT_MAX) {
    return { status: "rate_limited", suggestions: [] };
  }

  lookupHistory.push(now);

  // RPC SECURITY DEFINER : garde is_coach() + critère civil-non-coaché +
  // colonnes minimales. Pas de SELECT direct sur athletes (anti-fuite PII).
  const { data, error } = await supabase.rpc("lookup_civil_unclaimed_by_email", {
    p_prefix: trimmed,
  });

  if (error) {
    console.error("[athleteEmailAutocomplete] RPC error:", error);
    return { status: "error", suggestions: [] };
  }

  const rows = (data as CivilUnclaimedRow[] | null) ?? [];
  if (rows.length === 0) {
    return { status: "no_results", suggestions: [] };
  }

  const suggestions: AthleteEmailSuggestion[] = rows.map((r) => ({
    userId: r.user_id,
    athleteId: r.athlete_id,
    email: r.email ?? "",
    firstName: r.first_name ?? "",
    lastName: r.last_name ?? "",
    sportName: r.sport_name ?? null,
  }));

  return { status: "ok", suggestions };
}

/**
 * Reset le rate limit (utile en testing ou si l'user change de session).
 */
export function resetEmailAutocompleteRateLimit(): void {
  lookupHistory.length = 0;
}
