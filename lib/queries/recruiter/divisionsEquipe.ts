/* ═══════════════════════════════════════════════════════════════
   divisionsEquipe — la division ET la ligue de l'ÉQUIPE de chaque athlète
   (colonne « Division » de la vue tableau, décision BP 2026-09-24 ; liste
   « Ligue » de la feuille Filtrer de l'app, recette 1.4.4).

   Même source que la Recherche (recruiter_search_athletes : team_athletes →
   teams.division / teams.league) : la même division des deux côtés. La ligue
   passe par leagueOf (lib/config/team-taxonomy) — une équipe d'école sans
   ligue saisie joue en RSEQ, comme dans la Recherche. Un athlète peut avoir
   une équipe par sport (team_athletes_one_per_sport) — on prend celle du
   sport du dossier quand on le connaît, sinon la première.

   Pas d'équipe, ou une équipe sans division → absent de la map (« — »).
   Une erreur ne casse pas le processus : colonne vide plutôt que tableau
   blanc, et elle est journalisée.
═══════════════════════════════════════════════════════════════ */

import type { createClient } from "@/lib/supabase/client";
import { leagueOf } from "@/lib/config/team-taxonomy";

type EquipeLue = {
  division: string | null;
  sport_id: string | null;
  league: string | null;
  rseq_team_id: string | null;
  schools: { type: string | null } | { type: string | null }[] | null;
};

export interface EquipesAthletes {
  divisions: Record<string, string>;
  ligues: Record<string, string>;
}

export async function fetchEquipesAthletes(
  supabase: ReturnType<typeof createClient>,
  athleteIds: string[],
  sportPrefere: (athleteId: string) => string | null | undefined = () => null,
): Promise<EquipesAthletes> {
  const out: EquipesAthletes = { divisions: {}, ligues: {} };
  if (athleteIds.length === 0) return out;
  const { data, error } = await supabase
    .from("team_athletes")
    .select("athlete_id, teams(division, sport_id, league, rseq_team_id, schools!school_id(type))")
    .in("athlete_id", athleteIds);
  if (error) {
    console.error("[divisionsEquipe] :", error.message);
    return out;
  }
  const retenu: Record<string, EquipeLue> = {};
  for (const ligne of (data ?? []) as unknown as { athlete_id: string; teams: EquipeLue | EquipeLue[] | null }[]) {
    const eq = Array.isArray(ligne.teams) ? ligne.teams[0] : ligne.teams;
    if (!eq) continue;
    const deja = retenu[ligne.athlete_id];
    const prefere = sportPrefere(ligne.athlete_id);
    if (!deja || (prefere && eq.sport_id === prefere && deja.sport_id !== prefere)) retenu[ligne.athlete_id] = eq;
  }
  for (const [id, eq] of Object.entries(retenu)) {
    const d = eq.division?.trim();
    if (d) out.divisions[id] = d;
    const ecole = Array.isArray(eq.schools) ? eq.schools[0] : eq.schools;
    const ligue = leagueOf({
      context: null, schoolType: null,
      teamDivision: eq.division, teamLeague: eq.league,
      teamIsRseq: !!eq.rseq_team_id, hasTeam: true,
      teamSchoolType: ecole?.type ?? null,
    });
    if (ligue) out.ligues[id] = ligue;
  }
  return out;
}

/** Division seule — conservé pour les appelants qui n'ont pas besoin de la ligue. */
export async function fetchDivisionsEquipe(
  supabase: ReturnType<typeof createClient>,
  athleteIds: string[],
  sportPrefere: (athleteId: string) => string | null | undefined = () => null,
): Promise<Record<string, string>> {
  return (await fetchEquipesAthletes(supabase, athleteIds, sportPrefere)).divisions;
}
