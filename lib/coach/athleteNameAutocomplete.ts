/**
 * Phase 6.2.c-1-pivot — Autocomplete athletes par nom (orphelins only).
 *
 * Replace l'email-exact lookup de 6.2.c-1 par un autocomplete par nom.
 * RLS sur users garantit que seulement les athletes orphelins
 * (school_id NULL) avec un compte Nexus (user_id NOT NULL) sont
 * retournés via l'embed users!user_id.
 *
 * Privacy guarantees :
 * - Min 3 caractères avant query
 * - Max 5 résultats retournés
 * - Filtré aux athletes orphelins (school_id IS NULL) avec compte
 *   Nexus (user_id IS NOT NULL)
 * - Rate limit en mémoire : 10 queries / 60s
 * - Email retourné MAIS jamais affiché dans la dropdown (utilisé
 *   pour pré-fill seulement, le coach ne le voit pas avant de
 *   sélectionner)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;

// Rate limit state (module scope, persistent across hot reloads)
const lookupHistory: number[] = [];
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type AutocompleteStatus = "ok" | "too_short" | "rate_limited" | "no_results" | "error";

export interface AthleteSuggestion {
  userId: string;
  athleteId: string;
  firstName: string;
  lastName: string;
  email: string; // Pour le pré-fill; jamais affiché dans la dropdown
  sportName: string | null;
}

export interface AthleteAutocompleteResult {
  status: AutocompleteStatus;
  athletes: AthleteSuggestion[];
}

/**
 * Cherche les athletes orphelins par nom (prénom + nom).
 *
 * Gate logic :
 * - Empty/short query → too_short (UI shows no dropdown)
 * - Rate limit hit → rate_limited (UI shows warning)
 * - Query returns 0 rows → no_results (UI shows no dropdown)
 * - Query succeeds with rows → ok + list
 *
 * @param supabase Client Supabase (browser side)
 * @param query Combinaison prénom + nom (string libre, espace-séparé)
 * @returns Résultat structuré pour affichage UI
 */
export async function autocompleteOrphanAthletes(
  supabase: SupabaseClient,
  query: string,
): Promise<AthleteAutocompleteResult> {
  const trimmed = query.trim();

  // Gate 1 : min length
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { status: "too_short", athletes: [] };
  }

  // Gate 2 : rate limit
  const now = Date.now();
  while (lookupHistory.length > 0 && lookupHistory[0] < now - RATE_LIMIT_WINDOW_MS) {
    lookupHistory.shift();
  }

  if (lookupHistory.length >= RATE_LIMIT_MAX) {
    return { status: "rate_limited", athletes: [] };
  }

  lookupHistory.push(now);

  // Split "Alex Tre" → ["Alex", "Tre"] pour matching first+last
  const parts = trimmed.split(/\s+/);
  const firstPart = parts[0] ?? "";
  const lastPart = parts.length > 1 ? parts.slice(1).join(" ") : null;

  let athletesQuery = supabase
    .from("athletes")
    .select(`
      id,
      first_name,
      last_name,
      user_id,
      users!user_id (email),
      sports!sport_id (nom)
    `)
    .is("school_id", null)
    .not("user_id", "is", null)
    .limit(MAX_RESULTS);

  if (lastPart) {
    // "Alex Tre" → first ILIKE 'Alex%' AND last ILIKE 'Tre%'
    athletesQuery = athletesQuery
      .ilike("first_name", `${firstPart}%`)
      .ilike("last_name", `${lastPart}%`);
  } else {
    // "Alex" → first OR last ILIKE 'Alex%'
    athletesQuery = athletesQuery.or(
      `first_name.ilike.${firstPart}%,last_name.ilike.${firstPart}%`,
    );
  }

  const { data, error } = await athletesQuery;

  if (error) {
    console.error("[athleteNameAutocomplete] Query error:", error);
    return { status: "error", athletes: [] };
  }

  if (!data || data.length === 0) {
    return { status: "no_results", athletes: [] };
  }

  const suggestions: AthleteSuggestion[] = data.map((row) => {
    const r = row as Record<string, unknown>;
    const usersRel = r.users as { email?: string | null } | { email?: string | null }[] | null;
    const userObj = (Array.isArray(usersRel) ? usersRel[0] : usersRel) as { email?: string | null } | null;
    const sportsRel = r.sports as { nom?: string | null } | { nom?: string | null }[] | null;
    const sportObj = (Array.isArray(sportsRel) ? sportsRel[0] : sportsRel) as { nom?: string | null } | null;

    return {
      userId: (r.user_id as string) || "",
      athleteId: r.id as string,
      firstName: (r.first_name as string) ?? "",
      lastName: (r.last_name as string) ?? "",
      email: userObj?.email ?? "",
      sportName: sportObj?.nom ?? null,
    };
  });

  // Filtre defensive : si users embed retourne null (RLS bloque), l'email
  // est "". On garde quand même la suggestion pour permettre au coach de
  // créer un profil même sans compte Nexus existant — mais le pré-fill
  // sera incomplet.
  return { status: "ok", athletes: suggestions };
}

/**
 * Reset le rate limit (utile en testing ou si l'user change de session).
 */
export function resetAutocompleteRateLimit(): void {
  lookupHistory.length = 0;
}
