/* ═══════════════════════════════════════════════════════════════
   useFavoriteCounts — TanStack hook (iter 5.2)
   Counts globaux de favoris par athlete_id (combien de recruteurs
   au total ont chaque athlète en favori). Sert à afficher
   "X recruteurs intéressés" sur les cards athlète.

   Récupère toute la table recruiter_favorites (sans filtre par
   user) → agrège client-side. Acceptable tant que la table reste
   raisonnable ; sinon migrer en RPC count_per_athlete plus tard.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useFavoriteCounts() {
  return useQuery<Record<string, number>>({
    queryKey: ["favoriteCounts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_favorites")
        .select("athlete_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { athlete_id: string }[]) {
        counts[row.athlete_id] = (counts[row.athlete_id] || 0) + 1;
      }
      return counts;
    },
    staleTime: 2 * 60 * 1000,
  });
}
