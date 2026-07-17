/* ═══════════════════════════════════════════════════════════════
   useAthletesByIds — TanStack hook (iter 5.3a)
   Fetch un set d'athlètes par leurs IDs avec le gros select hydraté
   (sports + positions + schools + committed_school + evaluations).

   Le select reproduit le format utilisé dans Favoris (lignes 295-305
   originales) pour préserver la compatibilité avec les
   transformations aval.

   IDs triés (stableIds) → queryKey stable même si l'ordre des IDs
   en input change.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface AthleteRow {
  id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  verified: boolean;
  last_profile_validation: string | null;
  video_faits_saillants_url: string | null;
  annee_diplomation: number | null;
  cote_globale_entraineur: number | null;
  numero_jersey: string | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  recruitment_status: string | null;
  committed_school_id: string | null;
  open_to_offers: boolean | null;
  school_id: string | null;
  sports: { nom: string } | { nom: string }[] | null;
  positions: { nom: string; abreviation: string } | { nom: string; abreviation: string }[] | null;
  schools: { name: string; region: string } | { name: string; region: string }[] | null;
  committed_school: { name: string } | { name: string }[] | null;
  evaluations: { cote_globale: number | null; distinctions: string[] | null; updated_at: string | null }[] | null;
}

export function useAthletesByIds(ids: string[]) {
  // Tri pour stabilité du queryKey (TanStack hash l'array)
  const stableIds = [...ids].sort();

  return useQuery<AthleteRow[]>({
    queryKey: ["athletes-by-ids", stableIds],
    queryFn: async () => {
      if (stableIds.length === 0) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("athletes")
        .select(`
          id, first_name, last_name, photo_url, verified, last_profile_validation,
          video_faits_saillants_url, annee_diplomation,
          cote_globale_entraineur, numero_jersey, taille_pieds, taille_pouces, poids_lbs,
          recruitment_status, committed_school_id, open_to_offers, school_id,
          sports!sport_id(nom),
          positions!position_id(nom, abreviation),
          schools!school_id(name, region),
          committed_school:schools!committed_school_id(name),
          evaluations(cote_globale, distinctions, updated_at)
        `)
        .in("id", stableIds);
      if (error) throw error;
      return (data ?? []) as unknown as AthleteRow[];
    },
    enabled: stableIds.length > 0,
    staleTime: 5 * 60 * 1000,
    // Iter 7.54 — garde les données précédentes pendant le refetch
    // déclenché par un changement de queryKey (ex: retrait d'un favori
    // → favoriteIds change → nouvelle queryKey). Sans ça, isLoading
    // bascule à true et le consommateur (Favoris mobile) swap vers le
    // skeleton plein écran, démontant l'AnimatePresence et empêchant
    // l'exit animation des cartes. Pattern TanStack standard, safe.
    placeholderData: (prev) => prev,
  });
}
