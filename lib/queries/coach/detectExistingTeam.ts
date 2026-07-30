/* ═══════════════════════════════════════════════════════════════
   detectExistingTeam — attribute-match detection (Morceau 2).

   SINGLE SOURCE of the normalized-identity logic used to surface an
   already-existing team BEFORE the coach submits a create form. It
   MIRRORS the server adoption guard (Morceau 1) exactly :
     - createTeam.ts (client guard)
     - _team_norm_division() + the RPC SELECTs (server guard)
   so the banner shown pre-submit matches what the server would adopt.

   Detection is a LIGHT SELECT scoped by school_id + sport_id (never a
   global fetch) : a school+sport has ≤ ~15 teams, matched in JS on the
   normalized tuple (lower(age_group), lower(gender), Division N ≡ DN).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/** lower+trim ; '' when absent. Mirrors lower(btrim(coalesce(x,''))). */
export function normalizeKey(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

/** Division N ≡ DN, '' when absent. Mirrors public._team_norm_division(). */
export function normalizeDivision(d?: string | null): string {
  const s = (d ?? "").trim();
  if (!s) return "";
  if (/^d[1-4]$/i.test(s)) return s.toUpperCase();
  const m = s.match(/^division\s*([1-4])$/i);
  return m ? "D" + m[1] : s;
}

export interface DetectedTeam {
  id: string;
  name: string;
  ageGroup: string | null;
  gender: string | null;
  division: string | null;
}

export interface DetectParams {
  schoolId?: string | null;
  sportId?: string | null;
  ageGroup?: string;
  gender?: string;
  division?: string;
}

/**
 * Returns the first existing team whose NORMALIZED identity
 * (school_id, sport_id, lower(age_group), gender, normalized division)
 * matches the given attributes — or null. No-op (null) until the five
 * identity fields are present, so callers can call it eagerly.
 */
export async function detectExistingTeam(
  supabase: SupabaseClient,
  { schoolId, sportId, ageGroup, gender, division }: DetectParams,
): Promise<DetectedTeam | null> {
  if (!schoolId || !sportId) return null;
  if (!normalizeKey(ageGroup) || !normalizeKey(gender) || !normalizeDivision(division)) return null;

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, gender, division")
    .eq("school_id", schoolId)
    .eq("sport_id", sportId)
    .eq("is_active", true);
  if (error || !data) return null;

  const wantAge = normalizeKey(ageGroup);
  const wantGen = normalizeKey(gender);
  const wantDiv = normalizeDivision(division);

  const m = data.find(
    (c) =>
      normalizeKey(c.age_group as string) === wantAge &&
      normalizeKey(c.gender as string) === wantGen &&
      normalizeDivision(c.division as string) === wantDiv,
  );
  return m
    ? {
        id: m.id as string,
        name: m.name as string,
        ageGroup: (m.age_group as string) ?? null,
        gender: (m.gender as string) ?? null,
        division: (m.division as string) ?? null,
      }
    : null;
}
