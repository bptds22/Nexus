/**
 * Phase 6.2.c-1 — Helper pour le lookup athletes par email côté coach.
 *
 * Utilisé par /coach/athletes/create pour vérifier en temps réel si un
 * email correspond à un athlete existant, sans exposer de PII inutile.
 *
 * Privacy guarantees :
 * - Retourne seulement le strict nécessaire (name + sport + school name + type)
 * - Ne révèle JAMAIS l'email back au caller (déjà connu par le coach)
 * - Bloque les lookups malformés (non-email regex) avant query DB
 * - Rate limit en mémoire par session : 10 queries / 60s
 *
 * RLS coverage : policy "Coaches lookup athletes by email" (migration
 * 20260512150000) autorise SELECT users où role='ATHLETE' si le
 * requester est un coach (via is_coach() SECURITY DEFINER).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// Email validation basique — délibérément simple, pas exhaustif.
// Gate "pre-query" : éviter de query la DB sur des inputs malformés.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit state — module scope, persiste cross hot-reloads en dev.
// Pre-beta : suffisant. Post-launch : à promouvoir vers un store dédié
// (ex. Redis ou edge function avec persistence) pour éviter l'oracle
// abuse multi-session.
const lookupHistory: number[] = [];
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export type LookupReason = "invalid_email" | "rate_limited" | "not_found" | "found";

export interface AthleteEmailLookupResult {
  found: boolean;
  reason: LookupReason;
  athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    sportName: string | null;
    schoolName: string | null;
    schoolType: "SECONDAIRE" | "CEGEP" | "LIGUE_CIVILE" | null;
  };
}

/**
 * Lookup un athlete par email. Retourne un résultat structuré pour
 * affichage UI inline.
 *
 * @param supabase Client Supabase (depuis le caller browser)
 * @param email    Email à chercher (peut être malformé, on filtre)
 * @returns Résultat avec found=true/false + reason + métadonnées limitées
 */
export async function lookupAthleteByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<AthleteEmailLookupResult> {
  // Gate 1 : validation email (avant toute query)
  if (!email || !EMAIL_REGEX.test(email.trim())) {
    return { found: false, reason: "invalid_email" };
  }

  // Gate 2 : rate limit (avant toute query)
  const now = Date.now();
  while (lookupHistory.length > 0 && lookupHistory[0] < now - RATE_LIMIT_WINDOW_MS) {
    lookupHistory.shift();
  }

  if (lookupHistory.length >= RATE_LIMIT_MAX) {
    console.warn("[athleteEmailLookup] Rate limit hit");
    return { found: false, reason: "rate_limited" };
  }

  lookupHistory.push(now);

  // Query : SELECT minimal. La RLS policy filtre déjà role='ATHLETE'
  // mais on garde le .eq('role', 'ATHLETE') comme defense-in-depth.
  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      role,
      athletes!user_id (
        id,
        first_name,
        last_name,
        sport_id,
        school_id,
        sports!sport_id ( nom ),
        schools!school_id ( name, type )
      )
    `)
    .eq("email", email.trim().toLowerCase())
    .eq("role", "ATHLETE")
    .maybeSingle();

  if (error) {
    console.error("[athleteEmailLookup] Query error:", error);
    return { found: false, reason: "not_found" };
  }

  if (!data) {
    return { found: false, reason: "not_found" };
  }

  // Normalize embed structure (Supabase retourne arrays sur 1:N embeds
  // selon les hints; on accepte les deux formes)
  const athletesRel = data.athletes as Record<string, unknown> | Record<string, unknown>[] | null;
  const athlete = (Array.isArray(athletesRel) ? athletesRel[0] : athletesRel) as
    | {
        id: string;
        first_name: string | null;
        last_name: string | null;
        sports?: { nom?: string | null } | { nom?: string | null }[] | null;
        schools?: { name?: string | null; type?: string | null } | { name?: string | null; type?: string | null }[] | null;
      }
    | null
    | undefined;

  if (!athlete || !athlete.id) {
    return { found: false, reason: "not_found" };
  }

  const sportRel = athlete.sports;
  const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string | null } | null | undefined;
  const schoolRel = athlete.schools;
  const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as
    | { name?: string | null; type?: string | null }
    | null
    | undefined;

  const schoolType = school?.type;
  const validType: "SECONDAIRE" | "CEGEP" | "LIGUE_CIVILE" | null =
    schoolType === "SECONDAIRE" || schoolType === "CEGEP" || schoolType === "LIGUE_CIVILE"
      ? schoolType
      : null;

  return {
    found: true,
    reason: "found",
    athlete: {
      id: athlete.id,
      firstName: athlete.first_name ?? "",
      lastName: athlete.last_name ?? "",
      sportName: sport?.nom ?? null,
      schoolName: school?.name ?? null,
      schoolType: validType,
    },
  };
}

/**
 * Reset le rate limit (utile en testing ou si l'user change de session).
 */
export function resetLookupRateLimit(): void {
  lookupHistory.length = 0;
}
