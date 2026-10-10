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

   PLUSIEURS CANDIDATES (BP 2026-10-09). Un club civil aligne souvent
   plusieurs équipes dans le même groupe — Diablos Blanc et Diablos Noir en
   Atome Sud, Wildcats Est / Nord / Ouest. Rendre la PREMIÈRE faisait adopter
   l'une pour l'autre. detectExistingTeams les rend TOUTES, avec leur zone,
   pour que le coach choisisse la sienne ; l'ordre met en tête celle qui
   porte le nom saisi.

   « AUCUNE DIVISION » (AUCUNE_DIVISION) : un choix explicite, distinct de
   « pas encore choisi ». Il cherche les équipes de division vide (Atome
   Nord / Sud) — '' et NULL, comme _team_norm_division().
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AUCUNE_DIVISION } from "@/lib/config/civilVocab";

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
  /** teams.zone — '' / null sans zone. */
  zone?: string | null;
}

export interface DetectParams {
  schoolId?: string | null;
  sportId?: string | null;
  ageGroup?: string;
  gender?: string;
  /** Division FINALE, ou AUCUNE_DIVISION pour « pas de niveau ». */
  division?: string;
  /** Nom saisi : l'équipe qui le porte passe en tête. */
  name?: string;
}

/** La division recherchée, ou null tant qu'elle n'est pas choisie. */
function divisionVoulue(division?: string): string | null {
  if (division === AUCUNE_DIVISION) return "";
  const d = normalizeDivision(division);
  return d ? d : null;
}

/** Une ligne `teams` correspond-elle à l'identité normalisée demandée ? Pure. */
export function correspond(
  c: { age_group?: string | null; gender?: string | null; division?: string | null },
  p: Pick<DetectParams, "ageGroup" | "gender" | "division">,
): boolean {
  const div = divisionVoulue(p.division);
  return div !== null
    && normalizeKey(c.age_group) === normalizeKey(p.ageGroup)
    && normalizeKey(c.gender) === normalizeKey(p.gender)
    && normalizeDivision(c.division) === div;
}

/** Ordre des candidates : le nom saisi d'abord, puis l'ordre reçu. Pure. */
export function trierCandidates<T extends { name?: string | null }>(rows: T[], nom?: string): T[] {
  const n = normalizeKey(nom);
  if (!n) return rows;
  return [...rows.filter((r) => normalizeKey(r.name) === n), ...rows.filter((r) => normalizeKey(r.name) !== n)];
}

/**
 * TOUTES les équipes existantes dont l'identité NORMALISÉE (school_id,
 * sport_id, lower(age_group), gender, division normalisée) correspond — [] si
 * aucune, ou tant que les cinq champs ne sont pas posés.
 */
export async function detectExistingTeams(
  supabase: SupabaseClient,
  { schoolId, sportId, ageGroup, gender, division, name }: DetectParams,
): Promise<DetectedTeam[]> {
  if (!schoolId || !sportId) return [];
  if (!normalizeKey(ageGroup) || !normalizeKey(gender) || divisionVoulue(division) === null) return [];

  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, gender, division, zone, season, created_at")
    .eq("school_id", schoolId)
    .eq("sport_id", sportId)
    .eq("is_active", true)
    .order("season", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return trierCandidates(
    data.filter((c) => correspond(c as never, { ageGroup, gender, division })),
    name,
  ).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    ageGroup: (m.age_group as string) ?? null,
    gender: (m.gender as string) ?? null,
    division: (m.division as string) ?? null,
    zone: (m.zone as string) ?? null,
  }));
}

/** La première candidate, ou null (forme historique, gardée pour ses appelants). */
export async function detectExistingTeam(
  supabase: SupabaseClient,
  params: DetectParams,
): Promise<DetectedTeam | null> {
  return (await detectExistingTeams(supabase, params))[0] ?? null;
}
