/* Les badges partenaire d'un lot de cartes, lus UNE fois (RPC groupée, toutes les pages).
   Partagé web et appli. Règle d'affichage : badgesDeCarte() (lib/badges/carteBadges.ts). */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { chargerBadgesPartenairesLot, type BadgePartenaire } from "@/lib/badges/partenaire";

export function useBadgesPartenairesLot(ids: readonly string[], actif = true) {
  const stableIds = [...new Set(ids.filter(Boolean))].sort();
  return useQuery<Map<string, BadgePartenaire[]>>({
    queryKey: ["badges-partenaires-lot", stableIds],
    queryFn: () => chargerBadgesPartenairesLot(createClient(), stableIds),
    enabled: actif && stableIds.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
