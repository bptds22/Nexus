/* ═══════════════════════════════════════════════════════════════
   divisionsEquipe — la division de l'ÉQUIPE de chaque athlète (colonne
   « Division » de la vue tableau, décision BP 2026-09-24).

   Même source que la Recherche (recruiter_search_athletes : team_athletes →
   teams.division) : la même division des deux côtés. Un athlète peut avoir
   une équipe par sport (team_athletes_one_per_sport) — on prend celle du
   sport du dossier quand on le connaît, sinon la première.

   Pas d'équipe, ou une équipe sans division → absent de la map (« — »).
   Une erreur ne casse pas le processus : colonne vide plutôt que tableau
   blanc, et elle est journalisée.
═══════════════════════════════════════════════════════════════ */

import type { createClient } from "@/lib/supabase/client";

export async function fetchDivisionsEquipe(
  supabase: ReturnType<typeof createClient>,
  athleteIds: string[],
  sportPrefere: (athleteId: string) => string | null | undefined = () => null,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (athleteIds.length === 0) return out;
  const { data, error } = await supabase
    .from("team_athletes")
    .select("athlete_id, teams(division, sport_id)")
    .in("athlete_id", athleteIds);
  if (error) {
    console.error("[divisionsEquipe] :", error.message);
    return out;
  }
  const retenu: Record<string, { division: string | null; sport_id: string | null }> = {};
  for (const ligne of (data ?? []) as { athlete_id: string; teams: { division: string | null; sport_id: string | null } | { division: string | null; sport_id: string | null }[] | null }[]) {
    const eq = Array.isArray(ligne.teams) ? ligne.teams[0] : ligne.teams;
    if (!eq) continue;
    const deja = retenu[ligne.athlete_id];
    const prefere = sportPrefere(ligne.athlete_id);
    if (!deja || (prefere && eq.sport_id === prefere && deja.sport_id !== prefere)) retenu[ligne.athlete_id] = eq;
  }
  for (const [id, eq] of Object.entries(retenu)) {
    const d = eq.division?.trim();
    if (d) out[id] = d;
  }
  return out;
}
