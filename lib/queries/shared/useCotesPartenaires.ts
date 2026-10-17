/* Les évaluations partenaires d'un lot d'athlètes, pour les cartes (favoris…).
   Lecture arbitrée par W2 (voir lib/evaluations/coteCarte.ts) ; la règle
   d'affichage est coteCarteDepuisEvaluations(). Partagé web et appli. */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { chargerCotesPartenaires, type CotePartenaire } from "@/lib/evaluations/coteCarte";

export function useCotesPartenaires(ids: readonly string[], actif = true) {
  const stableIds = [...new Set(ids.filter(Boolean))].sort();
  return useQuery<Map<string, CotePartenaire[]>>({
    queryKey: ["cotes-partenaires", stableIds],
    queryFn: () => chargerCotesPartenaires(createClient(), stableIds),
    enabled: actif && stableIds.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
