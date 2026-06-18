/* ═══════════════════════════════════════════════════════════════
   useTrendingAthletes — TanStack hook (iter 5.2)
   Top 5 athlètes les plus vus sur les 7 derniers jours, avec
   compteur de favoris global. staleTime 2 min — peut changer
   rapidement, contrairement à un dashboard "snapshot".
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TrendingAthlete } from "@/app/recruteur/_data/mockDashboardData";

export function useTrendingAthletes() {
  return useQuery<TrendingAthlete[]>({
    queryKey: ["dashboard", "trending"],
    queryFn: async (): Promise<TrendingAthlete[]> => {
      const supabase = createClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: viewsData } = await supabase
        .from("recruiter_athlete_views")
        .select(
          // Iter 6.2-fix : ajout photo_url pour le carousel mobile.
          "athlete_id, athletes!athlete_id(first_name, last_name, photo_url, cote_globale_entraineur, sports!sport_id(nom), positions!position_id(abreviation), schools!school_id(name))",
        )
        .gte("viewed_at", sevenDaysAgo);

      const allViews = viewsData || [];
      if (allViews.length === 0) return [];

      const viewMap = new Map<string, { count: number; row: typeof allViews[0] }>();
      for (const v of allViews) {
        const existing = viewMap.get(v.athlete_id);
        if (existing) existing.count++;
        else viewMap.set(v.athlete_id, { count: 1, row: v });
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
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5);

      return sorted.map(([athId, { count, row }], i): TrendingAthlete => {
        const ath = row.athletes as unknown as {
          first_name?: string;
          last_name?: string;
          photo_url?: string | null;
          cote_globale_entraineur?: number;
          sports?: { nom?: string } | { nom?: string }[] | null;
          positions?: { abreviation?: string } | { abreviation?: string }[] | null;
          schools?: { name?: string } | { name?: string }[] | null;
        } | null;
        const sRel = ath?.sports; const sObj = Array.isArray(sRel) ? sRel[0] : sRel;
        const pRel = ath?.positions; const pObj = Array.isArray(pRel) ? pRel[0] : pRel;
        const schRel = ath?.schools; const schObj = Array.isArray(schRel) ? schRel[0] : schRel;
        const firstName = ath?.first_name || "";
        const lastName = ath?.last_name || "";
        return {
          id: athId,
          rank: i + 1,
          name: `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          photoUrl: ath?.photo_url ?? null,
          position: pObj?.abreviation || sObj?.nom || "",
          school: schObj?.name || "",
          stars: (ath?.cote_globale_entraineur as number) || 0,
          viewsThisWeek: count,
          favoritedBy: favCountMap.get(athId) || 0,
        };
      });
    },
    staleTime: 2 * 60 * 1000,
  });
}
