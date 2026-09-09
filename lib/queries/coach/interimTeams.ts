/* ═══════════════════════════════════════════════════════════════
   interimTeams — les équipes dont je suis responsable PAR INTÉRIM.

   Alimente le bandeau persistant du tableau de bord (Lot C). Il disparaît
   de lui-même dès qu'un head coach titulaire est nommé : le bandeau ne
   porte aucun état propre, il est le reflet direct de la donnée.

   Lecture seule. Consommé par le tableau de bord web
   (`app/coach/tableau-de-bord/page.tsx`) et mobile
   (`components/shared/CoachDashboardMobile.tsx`).
   ═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface InterimTeam {
  teamId: string;
  teamName: string;
  athleteCount: number;
}

/** Ne throw jamais : un bandeau informatif ne casse pas un tableau de bord. */
export async function loadMyInterimTeams(
  supabase: SupabaseClient,
): Promise<InterimTeam[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("team_coaches")
    .select("team_id, teams!team_id(name)")
    .eq("coach_id", uid)
    .eq("role", "head_coach_interim");

  if (error || !data || data.length === 0) return [];

  const rows = data as Record<string, unknown>[];
  const ids = rows.map((r) => r.team_id as string);

  /* Un seul aller-retour pour tous les effectifs, puis comptage en mémoire :
     une requête `count` par équipe ferait N requêtes pour un bandeau. */
  const { data: taRows } = await supabase
    .from("team_athletes")
    .select("team_id")
    .in("team_id", ids);

  const counts = new Map<string, number>();
  for (const r of (taRows ?? []) as { team_id: string }[]) {
    counts.set(r.team_id, (counts.get(r.team_id) ?? 0) + 1);
  }

  return rows.map((r) => {
    const tRel = r.teams as { name?: string } | { name?: string }[] | null;
    const t = Array.isArray(tRel) ? tRel[0] : tRel;
    const teamId = r.team_id as string;
    return {
      teamId,
      teamName: t?.name || "Équipe",
      athleteCount: counts.get(teamId) ?? 0,
    };
  });
}

/** Titre du bandeau — partagé pour que web et mobile ne dérivent pas. */
export function interimBannerTitle(teams: InterimTeam[]): string {
  if (teams.length === 0) return "";
  if (teams.length === 1) return `Tu es coach intérimaire de ${teams[0].teamName}`;
  return `Tu es coach intérimaire de ${teams.length} équipes`;
}
