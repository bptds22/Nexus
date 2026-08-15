/* ═══════════════════════════════════════════════════════════════
   useTrendingAthletes — TanStack hook (iter 5.2)
   Top 5 athlètes les plus vus sur les 7 derniers jours, avec
   compteur de favoris global. staleTime 2 min — peut changer
   rapidement, contrairement à un dashboard "snapshot".
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TrendingAthlete } from "@/app/recruteur/_data/mockDashboardData";
import { fetchRecruiterAthleteCards, displayFullName } from "@/lib/queries/shared/recruiterAthleteCards";

export function useTrendingAthletes() {
  return useQuery<TrendingAthlete[]>({
    queryKey: ["dashboard", "trending"],
    queryFn: async (): Promise<TrendingAthlete[]> => {
      const supabase = createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      /* Temps 1 — les vues seules, embed athletes retiré. */
      const { data: viewsData } = await supabase
        .from("recruiter_athlete_views")
        .select("athlete_id")
        .gte("viewed_at", sevenDaysAgo);

      const allViews = viewsData || [];
      if (allViews.length === 0) return [];

      const viewMap = new Map<string, number>();
      for (const v of allViews) {
        viewMap.set(v.athlete_id, (viewMap.get(v.athlete_id) || 0) + 1);
      }

      const athleteIds = Array.from(viewMap.keys());
      const { data: favData } = await supabase
        .from("recruiter_favorites")
        .select("athlete_id")
        .in("athlete_id", athleteIds);
      const favCountMap = new Map<string, number>();
      for (const f of favData || []) {
        favCountMap.set(f.athlete_id, (favCountMap.get(f.athlete_id) || 0) + 1);
      }

      const sorted = Array.from(viewMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      /* Temps 2 — les cartes projetées, sur le top 5 seulement. */
      const cardMap = await fetchRecruiterAthleteCards(supabase, sorted.map(([id]) => id));

      return sorted.map(([athId, count], i): TrendingAthlete => {
        const card = cardMap.get(athId) ?? null;
        return {
          id: athId,
          rank: i + 1,
          name: displayFullName(card, "Athlète"),
          identityVisible: card?.identity_visible ?? false,
          firstName: card?.first_name ?? "",
          lastName: card?.last_name ?? "",
          photoUrl: card?.photo_url ?? null,
          position: card?.position_abbr || card?.sport_nom || "",
          school: card?.school_name ?? "",
          stars: card?.cote_globale ?? 0,
          viewsThisWeek: count,
          favoritedBy: favCountMap.get(athId) || 0,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
  });
}
