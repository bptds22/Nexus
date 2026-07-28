/* ═══════════════════════════════════════════════════════════════
   teamAthleteIds — athlètes visibles via l'AUTORITÉ D'ÉQUIPE.

   AUDIT « autorité d'équipe » (BP) : les 3 rôles d'équipe
   (head_coach / assistant / coordinator) doivent avoir la MÊME
   visibilité des athlètes, SANS toucher coach_id (qui reste le lien
   PROPRIÉTAIRE unique — Contacter le coach, notifications, transferts :
   INCHANGÉS).

   La RLS athletes est déjà team-permissive (SELECT école-scopé). Le
   limiteur est 100 % APP-SIDE : plusieurs surfaces filtrent en dur
   `.eq("coach_id", selfId)`, ce qui exclut les athlètes d'une équipe
   que le coach coache mais dont il n'est PAS le propriétaire.

   Ce helper renvoie les athlete_id des équipes que ce coach coache :
     team_coaches WHERE coach_id = selfId       → team_id[]
     team_athletes WHERE team_id IN (team_id[]) → athlete_id[] (distinct)

   Chaque surface combine ensuite « owned OU team » :
     coach_id = selfId  OU  id IN (teamIds)

   Ne throw jamais : retombe sur [] en cas d'erreur / d'absence
   d'équipe (la surface garde alors son filtre `coach_id = selfId`).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * IDs des athlètes rattachés à une équipe que ce coach coache.
 * Retourne [] si le coach n'est dans aucune équipe (ou en cas d'erreur).
 */
export async function loadTeamAthleteIds(
  supabase: SupabaseClient,
  selfId: string,
): Promise<string[]> {
  // 1. Équipes que ce coach coache (tout rôle d'équipe confondu).
  const { data: tcRows } = await supabase
    .from("team_coaches")
    .select("team_id")
    .eq("coach_id", selfId);
  const teamIds = [
    ...new Set(
      (tcRows ?? [])
        .map((r) => (r as { team_id: string | null }).team_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (teamIds.length === 0) return [];

  // 2. Athlètes rattachés à ces équipes.
  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("athlete_id")
    .in("team_id", teamIds);
  return [
    ...new Set(
      (taRows ?? [])
        .map((r) => (r as { athlete_id: string | null }).athlete_id)
        .filter((id): id is string => !!id),
    ),
  ];
}
