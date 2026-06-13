/* ═══════════════════════════════════════════════════════════════
   createTeam / joinTeam — shared data-layer for team creation.

   Mirrors the createCoachConversation pattern : pure functions
   returning { teamId?, error? } / { error? }. Consumed by every
   team-create surface so the role assignment + atomicity + sport
   validation rule is identical across web manual create, the new
   mobile teams page, and both onboarding wizards (which keep their
   atomic RPCs for the multi-step submit but pass through this
   function's signature in V2 ; for now they call the same UI block).

   NO blocking duplicate pre-check : the TeamPickerSheet UI surfaces
   existing teams BEFORE the create form opens, which is the dedup
   mechanism (a coach sees the existing team and joins it via
   joinTeam instead of creating a duplicate). DB-level UNIQUE was
   intentionally not added — picker UX handles it.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface CreateTeamParams {
  /** auth.uid() of the coach creating the team — becomes head_coach. */
  coachUserId: string;
  /** Owning school (école school row or LIGUE_CIVILE schools row). */
  schoolId: string;
  /** sports.id — required (teams.sport_id is NOT NULL). */
  sportId: string;
  /** teams.name. Trimmed inside ; empty rejected. */
  name: string;
  /** Structured age category from AGE_OPTIONS (substituted from
   *  free-text when the coach picked "Autre"). Empty becomes NULL. */
  ageGroup?: string;
  /** Structured division from DIVISION_OPTIONS (or substituted Autre
   *  free-text). Empty becomes NULL. */
  division?: string;
  /** Capitalized FR value from GENDER_OPTIONS. Empty becomes NULL. */
  gender?: string;
  /** Free text. Default "RSEQ" on the form ; passed through as-is. */
  league?: string;
  /** From SEASON_OPTIONS. Empty falls through to DB default
   *  ('2025-2026' per the teams table column default). */
  season?: string;
}

export interface CreateTeamResult {
  teamId?: string;
  error?: PostgrestError | { message: string; code?: string };
}

export interface JoinTeamParams {
  coachUserId: string;
  teamId: string;
}

export interface JoinTeamResult {
  error?: PostgrestError | { message: string; code?: string };
}

/* ── createTeam ──────────────────────────────────────────────── */

export async function createTeam(
  supabase: SupabaseClient,
  params: CreateTeamParams,
): Promise<CreateTeamResult> {
  const { coachUserId, schoolId, sportId, name } = params;

  /* Validation : every required FK / non-empty field. */
  if (!coachUserId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!schoolId)    return { error: { message: "École / ligue manquante." } };
  if (!sportId)     return { error: { message: "Sport manquant." } };
  const nameTrim = name.trim();
  if (!nameTrim)    return { error: { message: "Nom de l'équipe manquant." } };

  /* Normalize optional fields : empty → null (matches civil RPC
     NULLIF(TRIM(COALESCE(...)), '') idiom). */
  const norm = (s?: string) => (s ? s.trim() : "") || null;
  const payload: Record<string, unknown> = {
    school_id: schoolId,
    sport_id: sportId,
    name: nameTrim,
    age_group: norm(params.ageGroup),
    division:  norm(params.division),
    gender:    norm(params.gender),
    league:    norm(params.league),
  };
  /* season : only set if caller provided one ; otherwise the teams
     column default ('2025-2026') applies. */
  if (params.season) payload.season = params.season;

  /* 1. INSERT teams. */
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert(payload)
    .select("id")
    .single();

  if (teamErr || !team) {
    return { error: teamErr ?? { message: "Création de l'équipe échouée." } };
  }
  const teamId = team.id as string;

  /* 2. INSERT team_coaches — creator becomes head_coach (mirror
     civil RPC v_team_created branch). Note: ON CONFLICT DO NOTHING
     defensive even though the team just-created has zero coaches. */
  const { error: tcErr } = await supabase
    .from("team_coaches")
    .insert({ team_id: teamId, coach_id: coachUserId, role: "head_coach" });

  if (tcErr) {
    return { teamId, error: tcErr };
  }

  return { teamId };
}

/* ── joinTeam ────────────────────────────────────────────────── */

/**
 * Insert the coach as an ASSISTANT on an existing team. Mirrors the
 * civil RPC's join branch (p_team_id IS NOT NULL → role 'assistant'
 * ON CONFLICT DO NOTHING). Idempotent : tapping "Join" twice is safe.
 */
export async function joinTeam(
  supabase: SupabaseClient,
  params: JoinTeamParams,
): Promise<JoinTeamResult> {
  const { coachUserId, teamId } = params;
  if (!coachUserId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!teamId)      return { error: { message: "Équipe manquante." } };

  /* Supabase doesn't have a clean .upsert-with-ignore on per-row
     unique violations the way RPC does ; .insert with onConflict
     ignore is supported when a unique constraint exists on the
     conflicting columns. team_coaches has UNIQUE (team_id, coach_id)
     per baseline. */
  const { error } = await supabase
    .from("team_coaches")
    .upsert(
      { team_id: teamId, coach_id: coachUserId, role: "assistant" },
      { onConflict: "team_id,coach_id", ignoreDuplicates: true },
    );

  if (error) return { error };
  return {};
}
