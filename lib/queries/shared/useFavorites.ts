/* ═══════════════════════════════════════════════════════════════
   useFavorites — TanStack hook (iter 5.2)
   Liste des athlete_ids favoris du recruteur courant.
   Utilisé par : Recherche, profil athlète mobile/desktop, Dashboard.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "./useCurrentUser";

export function useFavorites() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useQuery<string[]>({
    queryKey: ["favorites", userId],
    queryFn: async () => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recruiter_favorites")
        .select("athlete_id")
        .eq("recruiter_id", userId);
      if (error) throw error;
      return (data ?? []).map((f) => f.athlete_id as string);
    },
    enabled: !!userId,
  });
}
