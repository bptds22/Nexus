/* ═══════════════════════════════════════════════════════════════
   athleteReferent — qui répond pour cet athlète, côté recruteur.

   MIROIR CLIENT de la fonction SQL `fn_resolve_team_referent` (vague 2) :

     responsable de l'équipe (head_coach → head_coach_interim)
       → directeur de l'organisation
       → personne

   ⚠️ DEUX IMPLÉMENTATIONS, VOLONTAIREMENT, ET TEMPORAIREMENT. La vague 2
   n'est pas appliquée : `fn_resolve_team_referent` n'existe pas encore en
   base, et les RPC recruteur ne projettent pas coach_id de toute façon.
   Ce module comble la fenêtre.

   À L'APPLY DE LA VAGUE 2 : le référent sera maintenu dans
   `athletes.coach_id` par les triggers, donc ce module se réduira à une
   simple lecture de coach_id — ou disparaîtra si la projection recruteur
   l'expose. Ne pas laisser les deux cascades vivre côte à côte : c'est
   exactement le motif « chaque surface sa propre définition » que la
   session du 8/09 a passé à démonter.

   Pourquoi ne pas simplement lire coach_id aujourd'hui : parce qu'il est
   NULL pour 43 des 53 athlètes en équipe (relevé du 2026-09-09). Lire le
   champ brut, c'est afficher « aucun entraîneur » à 81 % — alors que dans
   bien des cas un responsable d'équipe existe.
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { REFERENT_ROLES, coachDisplayName } from "@/lib/coach/teamRoles";

export interface AthleteReferent {
  coachId: string | null;
  name: string | null;
  /** D'où vient le référent — sert à nuancer le libellé côté UI. */
  source: "team" | "director" | "owner" | "none";
  /** Nom de l'équipe qui a fourni le référent, si c'est cette voie. */
  teamName: string | null;
}

const AUCUN: AthleteReferent = { coachId: null, name: null, source: "none", teamName: null };

/** Ne throw jamais : un nom d'entraîneur absent ne casse pas une fiche. */
export async function loadAthleteReferent(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<AthleteReferent> {
  if (!athleteId) return AUCUN;

  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("team_id, teams!team_id(name, school_id)")
    .eq("athlete_id", athleteId)
    .limit(1);

  const ta = ((taRows ?? []) as Record<string, unknown>[])[0];

  if (ta) {
    const tRel = ta.teams as { name?: string; school_id?: string } | { name?: string; school_id?: string }[] | null;
    const team = Array.isArray(tRel) ? tRel[0] : tRel;
    const teamId = ta.team_id as string;

    const { data: tcRows } = await supabase
      .from("team_coaches")
      .select("coach_id, role, users!coach_id(first_name, last_name)")
      .eq("team_id", teamId)
      .in("role", REFERENT_ROLES);

    const rows = (tcRows ?? []) as Record<string, unknown>[];
    // head_coach l'emporte sur l'intérim — même ordre que la cascade SQL.
    const chef =
      rows.find((r) => r.role === "head_coach") ?? rows.find((r) => r.role === "head_coach_interim");

    if (chef) {
      const uRel = chef.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
      const u = Array.isArray(uRel) ? uRel[0] : uRel;
      return {
        coachId: chef.coach_id as string,
        name: coachDisplayName(u?.first_name, u?.last_name),
        source: "team",
        teamName: team?.name ?? null,
      };
    }

    if (team?.school_id) {
      const dir = await loadDirector(supabase, team.school_id);
      if (dir) return { ...dir, source: "director", teamName: team?.name ?? null };
    }
  }

  /* Aucune équipe (ou équipe sans staff ni directeur) : on retombe sur le
     propriétaire déclaré, quand il existe. */
  const { data: aRows } = await supabase
    .from("athletes")
    .select("coach_id, users!athletes_coach_id_fkey(first_name, last_name)")
    .eq("id", athleteId)
    .limit(1);

  const a = ((aRows ?? []) as Record<string, unknown>[])[0];
  if (a?.coach_id) {
    const uRel = a.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
    const u = Array.isArray(uRel) ? uRel[0] : uRel;
    return {
      coachId: a.coach_id as string,
      name: coachDisplayName(u?.first_name, u?.last_name),
      source: "owner",
      teamName: null,
    };
  }

  return AUCUN;
}

async function loadDirector(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<{ coachId: string; name: string } | null> {
  const { data } = await supabase
    .from("school_coaches")
    .select("coach_id, role, users!coach_id(first_name, last_name)")
    .eq("school_id", schoolId)
    .in("role", ["DIRECTEUR", "DIRECTEUR_INTERIM"])
    .limit(1);

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;
  const uRel = row.users as { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] | null;
  const u = Array.isArray(uRel) ? uRel[0] : uRel;
  return { coachId: row.coach_id as string, name: coachDisplayName(u?.first_name, u?.last_name) };
}

/* ── F2 — ce qu'on dit au recruteur quand personne ne répond ────────
   État NOMINAL de pré-saison, pas une erreur : au 2026-09-09, 43 des 53
   athlètes en équipe n'ont aucun membre du staff inscrit. Le message doit
   informer sans accuser la plateforme ni l'athlète — et surtout remplacer
   le silence actuel, où le message partait sans que personne ne soit
   notifié.                                                              */
export const AUCUN_STAFF_TITRE = "Le staff de cette équipe n'est pas encore sur Nexus";

export function aucunStaffMessage(teamName: string | null): string {
  return (
    `Personne de l'encadrement ${teamName ? `de ${teamName} ` : ""}n'a encore rejoint la plateforme : ` +
    "ton message partira, mais aucun entraîneur ne sera notifié pour l'instant. " +
    "Le parent de l'athlète, lui, reçoit l'avis de premier contact quand son courriel est renseigné."
  );
}

/** Libellé de la carte « entraîneur » selon la voie de résolution. */
export function referentRoleLabel(r: AthleteReferent): string {
  switch (r.source) {
    case "team":     return r.teamName ? `Responsable — ${r.teamName}` : "Responsable de l'équipe";
    case "director": return "Directeur de l'organisation";
    case "owner":    return "Entraîneur référent";
    default:         return "";
  }
}
