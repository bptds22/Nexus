/* ═══════════════════════════════════════════════════════════════
   createTeam / joinTeam — shared data-layer for team creation.

   Mirrors the createCoachConversation pattern : pure functions
   returning { teamId?, error? } / { error? }. Consumed by every
   team-create surface so the role assignment + atomicity + sport
   validation rule is identical across web manual create, the new
   mobile teams page, and both onboarding wizards (which keep their
   atomic RPCs for the multi-step submit but pass through this
   function's signature in V2 ; for now they call the same UI block).

   ADOPTION GUARD (dedup) : before INSERT, createTeam looks for an
   existing team with the same NORMALIZED identity — (school_id,
   sport_id, lower(age_group), gender, normalized division with
   Division N ≡ DN), ignoring name. If one exists it is ADOPTED
   (the coach is attached via joinTeam) and NO row is inserted. This
   backstops the picker UX : the RSEQ import gave every team the school
   name, so a coach typing a different name would otherwise silently
   create a duplicate that carries no RSEQ calendar. The DB UNIQUE
   (…, name, season) does not catch that — this guard does.

   BORNE SAISON (FIX 1c) : la recherche est limitée à season >= saison
   cible et triée season DESC, created_at ASC — exactement comme les RPC
   finish_coach_*_onboarding. Le garde ignorait la saison et prenait un
   ordre arbitraire : au chargement des équipes 2026-27 en septembre, il
   adoptait l'équipe 2025-2026 (créée avant), qui ne porte aucun match de
   la saison en cours. La saison cible vient de params.season, sinon de
   public.current_season() — même source que le DEFAULT de colonne.
═══════════════════════════════════════════════════════════════ */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { normalizeKey, normalizeDivision } from "./detectExistingTeam";

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
  /** true when an existing team with the same normalized identity was
   *  ADOPTED instead of creating a new row (no INSERT happened). */
  adopted?: boolean;
  /** Role attributed on adoption (via joinTeam) : 'head_coach' if the
   *  adopted team had no coach, else 'assistant'. Absent when created. */
  role?: "head_coach" | "assistant";
}

export interface JoinTeamParams {
  coachUserId: string;
  teamId: string;
}

export interface JoinTeamResult {
  error?: PostgrestError | { message: string; code?: string };
  /** Rôle réellement attribué : 'head_coach' si l'équipe n'avait aucun
   *  coach (revendication d'une équipe scrapée), sinon 'assistant'.
   *  Absent en cas d'erreur. Sert au message de confirmation. */
  role?: "head_coach" | "assistant";
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

  /* SAISON CIBLE — celle demandée par l'appelant, sinon la saison courante
     LUE EN BASE via public.current_season(). C'est volontairement la même
     source que le DEFAULT de teams.season et que le garde des deux RPC
     finish_coach_*_onboarding : trois couches qui calculeraient la saison
     chacune de leur côté finiraient par diverger (c'était déjà le cas entre
     le .find() d'ordre arbitraire ici et le ORDER BY de la RPC).
     Fail-soft : si l'appel échoue, on retombe sur l'ancien comportement
     (aucun filtre saison) plutôt que de bloquer la création. */
  let targetSeason = params.season?.trim() || "";
  if (!targetSeason) {
    const { data: s } = await supabase.rpc("current_season");
    targetSeason = typeof s === "string" ? s : "";
  }
  if (targetSeason) payload.season = targetSeason;

  /* ── ADOPTION GUARD ──────────────────────────────────────────────
     Look for an existing team with the SAME normalized identity
     (school+sport+age+gender+division, Division N ≡ DN), ignoring
     name+season. If found → adopt it (attach coach via joinTeam),
     NO insert. Idempotent : re-submitting adopts the same team and
     joinTeam's ON CONFLICT DO NOTHING makes a repeat a clean no-op.
     Normalization is the SHARED source (detectExistingTeam) — same
     functions the pre-submit banner uses, mirroring the SQL guard. */
  let candidatesQuery = supabase
    .from("teams")
    .select("id, age_group, gender, division")
    .eq("school_id", schoolId)
    .eq("sport_id", sportId)
    .eq("is_active", true);
  /* Borne saison + tri IDENTIQUES à la RPC : season >= saison cible, puis
     ORDER BY season DESC, created_at ASC. Sans ça, .find() prenait la
     première ligne d'un ordre arbitraire — en pratique la plus ancienne,
     donc l'équipe de la saison passée, qui ne porte aucun match de la
     saison en cours. */
  if (targetSeason) candidatesQuery = candidatesQuery.gte("season", targetSeason);
  const { data: candidates } = await candidatesQuery
    .order("season", { ascending: false })
    .order("created_at", { ascending: true });
  const existing = (candidates ?? []).find(
    (c) =>
      normalizeKey(c.age_group as string) === normalizeKey(params.ageGroup) &&
      normalizeKey(c.gender as string) === normalizeKey(params.gender) &&
      normalizeDivision(c.division as string) === normalizeDivision(params.division),
  );
  if (existing) {
    const join = await joinTeam(supabase, {
      coachUserId,
      teamId: existing.id as string,
    });
    if (join.error) return { error: join.error };
    return { teamId: existing.id as string, adopted: true, role: join.role };
  }

  /* 1. INSERT teams (aucune team identique — création réelle). */
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
 * Rattache le coach à une équipe EXISTANTE.
 *
 * Rôle attribué :
 *   - équipe SANS aucun coach (typiquement une équipe scrapée RSEQ, jamais
 *     revendiquée) → 'head_coach' : le 1er arrivant en devient responsable,
 *     sinon une équipe orpheline n'aurait jamais de responsable.
 *   - équipe qui a déjà au moins un coach → 'assistant' (comportement
 *     historique, miroir de la branche join du RPC civil).
 *
 * Idempotent : ON CONFLICT DO NOTHING sur (team_id, coach_id) — taper
 * « Rejoindre » deux fois est sans effet, et ne peut pas promouvoir
 * rétroactivement un assistant existant.
 *
 * ⚠️ Course : deux coachs qui revendiquent la MÊME équipe orpheline dans la
 * même seconde liront tous deux 0 et deviendront head_coach. Bénin (deux
 * responsables) et non détectable côté client ; un vrai verrou demanderait
 * une RPC atomique — hors périmètre de ce ticket.
 */
export async function joinTeam(
  supabase: SupabaseClient,
  params: JoinTeamParams,
): Promise<JoinTeamResult> {
  const { coachUserId, teamId } = params;
  if (!coachUserId) return { error: { message: "Coach manquant (non authentifié)." } };
  if (!teamId)      return { error: { message: "Équipe manquante." } };

  /* Équipe orpheline ? → head_coach. La policy "team_coaches scoped
     select" laisse lire les lignes des équipes de mon école, donc ce
     compte est fiable pour le cas qui nous intéresse (équipe scrapée de
     mon école). En cas d'erreur de lecture on retombe sur 'assistant' :
     jamais de promotion accidentelle sur une équipe déjà encadrée. */
  const { count, error: countErr } = await supabase
    .from("team_coaches")
    .select("coach_id", { count: "exact", head: true })
    .eq("team_id", teamId);

  const role = !countErr && (count ?? 0) === 0 ? "head_coach" : "assistant";

  /* Supabase doesn't have a clean .upsert-with-ignore on per-row
     unique violations the way RPC does ; .insert with onConflict
     ignore is supported when a unique constraint exists on the
     conflicting columns. team_coaches has UNIQUE (team_id, coach_id)
     per baseline. */
  const { error } = await supabase
    .from("team_coaches")
    .upsert(
      { team_id: teamId, coach_id: coachUserId, role },
      { onConflict: "team_id,coach_id", ignoreDuplicates: true },
    );

  if (error) return { error };
  return { role };
}
