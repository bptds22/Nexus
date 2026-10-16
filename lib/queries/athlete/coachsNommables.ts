/* ═══════════════════════════════════════════════════════════════
   Coachs nommables à l'athlète (règle RSEQ, décision BP du 2026-10-16) —
   la SEULE porte du client vers une liste de coachs sur un écran athlète.

   Le filtre vit en base (migration 20261016040000, coach_nommable) : un
   coach collégial, même s'il coache AUSSI au secondaire, n'y figure jamais ;
   une école ou une équipe collégiale rend une liste vide. Le client ne lit
   plus users / team_coaches pour ces listes. Web ET mobile passent ici.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeJoinCode, versEquipeResolue, type ResolvedJoinTeam } from "@/lib/queries/athlete/teamAttachment";

/** Un coach d'une école (choix manuel « Mon coach »). */
export interface CoachNommableEcole {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

/** Un coach d'une équipe, avec son rôle (entraîneur-chef d'abord). */
export interface CoachNommableEquipe {
  coach_id: string;
  first_name: string | null;
  last_name: string | null;
  /** head_coach | head_coach_interim | coordinator | assistant */
  role: string;
}

/** Aperçu d'un code : l'équipe (resolve_team_join_token) + ses coachs nommables. */
export type ApercuCodeResolu = ResolvedJoinTeam & { coachs: CoachNommableEquipe[] };

export function versCoachEcole(r: Record<string, unknown>): CoachNommableEcole {
  return {
    id: r.coach_id as string,
    firstName: (r.prenom as string | null) ?? "",
    lastName: (r.nom as string | null) ?? "",
    photoUrl: (r.photo_url as string | null) ?? null,
  };
}

export function versCoachEquipe(r: Record<string, unknown>): CoachNommableEquipe {
  return {
    coach_id: r.coach_id as string,
    first_name: (r.prenom as string | null) ?? null,
    last_name: (r.nom as string | null) ?? null,
    role: (r.role as string | null) || "assistant",
  };
}

/** Choix manuel : les coachs nommables d'une école. Cégep → []. Erreur → []
 *  (pas de liste plutôt qu'une liste non filtrée). */
export async function chargerCoachsNommablesEcole(supabase: SupabaseClient, schoolId: string): Promise<CoachNommableEcole[]> {
  if (!schoolId) return [];
  const { data, error } = await supabase.rpc("coachs_nommables_ecole", { p_school: schoolId });
  if (error) { console.error(`[coachsNommables] école : ${error.message}`); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map(versCoachEcole);
}

/** Les coachs nommables d'une équipe (déjà triés : entraîneur-chef d'abord). */
export async function chargerCoachsNommablesEquipe(supabase: SupabaseClient, teamId: string): Promise<CoachNommableEquipe[]> {
  if (!teamId) return [];
  const { data, error } = await supabase.rpc("coachs_nommables_equipe", { p_team: teamId });
  if (error) { console.error(`[coachsNommables] équipe : ${error.message}`); return []; }
  return ((data ?? []) as Record<string, unknown>[]).map(versCoachEquipe);
}

/** Aperçu d'un code pour un compte CONNECTÉ (onboarding, Mon équipe, transfert) :
 *  mêmes trois issues que resolveTeamJoinToken (null = code inexistant), plus les
 *  coachs nommables. La page publique /join garde resolveTeamJoinToken (anonyme). */
export async function resoudreApercuCode(supabase: SupabaseClient, rawCode: string): Promise<ApercuCodeResolu | null> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return null;
  const { data, error } = await supabase.rpc("apercu_code_equipe", { p_code: code });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  const coachs = Array.isArray(row.coachs) ? (row.coachs as Record<string, unknown>[]).map(versCoachEquipe) : [];
  return { ...versEquipeResolue(row), coachs };
}
