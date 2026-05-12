/**
 * Phase 6.2.c-1-pivot — Email partial autocomplete (orphan athletes only).
 *
 * Pivot du name-autocomplete (0d3b430) vers email-partial autocomplete
 * sur le champ Courriel. Le coach tape une partie de l'email, des
 * suggestions s'affichent, clic = autofill tous les champs.
 *
 * Privacy guarantees :
 * - Min 4 caractères avant query
 * - Max 3 résultats retournés (privacy max)
 * - RLS filtre aux athletes orphelins (school_id IS NULL) via
 *   policy "Coaches lookup orphan athletes" (migration 20260512160000)
 * - Filtre defensive côté code : confirme school_id IS NULL avant
 *   de retourner (au cas où RLS aurait un edge case)
 * - Rate limit en mémoire : 10 queries / 60s par session
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_QUERY_LENGTH = 4;
const MAX_RESULTS = 3;

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

/**
 * Cherche les athletes orphelins par email partial (ILIKE 'partial%').
 *
 * @param supabase Client Supabase
 * @param partial Partie de l'email tapée par le coach
 * @returns Résultat structuré pour affichage UI dropdown
 */
export async function autocompleteOrphanAthletesByEmail(
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

  // Query : users (role=ATHLETE + email ILIKE 'partial%') JOIN athletes
  // (school_id NULL) JOIN sports.
  // RLS double-check : policy "Coaches lookup orphan athletes" filtre
  // déjà côté users — l'embed athletes ne retournera que les rows
  // accessibles à l'utilisateur courant.
  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      email,
      athletes!user_id (
        id,
        first_name,
        last_name,
        school_id,
        sports!sport_id (nom)
      )
    `)
    .eq("role", "ATHLETE")
    .ilike("email", `${trimmed}%`)
    .limit(MAX_RESULTS);

  if (error) {
    console.error("[athleteEmailAutocomplete] Query error:", error);
    return { status: "error", suggestions: [] };
  }

  if (!data || data.length === 0) {
    return { status: "no_results", suggestions: [] };
  }

  // Map + filtre defensive : confirm school_id IS NULL et drop les
  // rows sans athletes link (édge case RLS).
  const suggestions: AthleteEmailSuggestion[] = data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const athletesRel = r.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
      const athlete = (Array.isArray(athletesRel) ? athletesRel[0] : athletesRel) as Record<string, unknown> | null;
      if (!athlete) return null;

      const schoolId = athlete.school_id as string | null | undefined;
      if (schoolId !== null && schoolId !== undefined) return null;

      const sportsRel = athlete.sports as { nom?: string | null } | { nom?: string | null }[] | null;
      const sportObj = (Array.isArray(sportsRel) ? sportsRel[0] : sportsRel) as { nom?: string | null } | null;

      const suggestion: AthleteEmailSuggestion = {
        userId: r.id as string,
        athleteId: athlete.id as string,
        email: (r.email as string) ?? "",
        firstName: (athlete.first_name as string) ?? "",
        lastName: (athlete.last_name as string) ?? "",
        sportName: sportObj?.nom ?? null,
      };
      return suggestion;
    })
    .filter((s): s is AthleteEmailSuggestion => s !== null);

  if (suggestions.length === 0) {
    return { status: "no_results", suggestions: [] };
  }

  return { status: "ok", suggestions };
}

/**
 * Reset le rate limit (utile en testing ou si l'user change de session).
 */
export function resetEmailAutocompleteRateLimit(): void {
  lookupHistory.length = 0;
}
