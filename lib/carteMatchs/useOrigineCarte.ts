/* ═══════════════════════════════════════════════════════════════
   useOrigineCarte — ce que la carte des matchs lit du recruteur : le NOM du
   sport de son unité (sport par défaut du filtre, comparé à games.sport).
   Lot B : les coordonnées du cégep (distances, retirées de l'écran) ne sont
   plus lues. Partageable avec le mobile.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export interface OrigineCarte {
  sportUnite: string | null;
}

export function useOrigineCarte(enabled: boolean) {
  const { data: currentUser } = useCurrentUser();
  const sportId = currentUser?.profile?.sport_id ?? null;
  return useQuery<OrigineCarte>({
    queryKey: ["carte-matchs", "origine", sportId],
    enabled: enabled && !!currentUser,
    staleTime: Infinity,
    queryFn: async () => {
      if (!sportId) return { sportUnite: null };
      const { data: sport } = await createClient().from("sports").select("nom").eq("id", sportId).maybeSingle();
      return { sportUnite: (sport?.nom as string | undefined) ?? null };
    },
  });
}
