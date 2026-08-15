/* ═══════════════════════════════════════════════════════════════
   useAthletesByIds — hydratation d'un lot d'athlètes par leurs IDs.

   BASCULÉ SUR recruiter_athlete_cards (chantier bascule RPC).

   Avant : un `.from("athletes")` direct avec un gros select hydraté.
   C'est exactement ce que le verrou RLS doit fermer, et ça ne pouvait
   appliquer aucune projection Loi 25 — le nom, la photo et le dossard
   partaient en clair, à charge du client de les cacher. Un masquage
   client ne masque rien : la donnée est déjà dans la réponse réseau.

   Ce hook n'a pas de relation à lui (contrairement à usePipelineCards,
   qui garde sa table de pipeline) : il EST l'hydratation. Le 2-temps se
   réduit donc à son temps 2, et le hook devient un simple appel à la
   fondation partagée.

   ── Ce qui change pour les appelants ──────────────────────────
   Le type rendu est désormais `RecruiterAthleteCard`, le miroir exact
   du RETURNS TABLE de la RPC. Trois correspondances à connaître :

     video_faits_saillants_url  ->  a_une_video   (booléen, pas l'URL :
                                    un recruteur n'a pas besoin de l'URL
                                    pour savoir qu'une vidéo existe)
     committed_school_id        ->  committed_school_name
     cote_globale_entraineur    ->  cote_globale

   Et surtout : `identity_visible`. Quand il est faux, first_name,
   last_name, photo_url et numero_jersey arrivent à NULL — le serveur ne
   les envoie pas. Les surfaces doivent le propager jusqu'aux
   composants AthletePhoto*, et ne JAMAIS retomber sur des initiales.

   IDs triés (stableIds) → queryKey stable même si l'ordre des IDs en
   entrée change.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchRecruiterAthleteCards,
  type RecruiterAthleteCard,
} from "@/lib/queries/shared/recruiterAthleteCards";

/** Ré-export de commodité : les appelants historiques importaient
 *  `AthleteRow` d'ici. Le nom reste, la forme est celle de la RPC. */
export type { RecruiterAthleteCard } from "@/lib/queries/shared/recruiterAthleteCards";

export function useAthletesByIds(ids: string[]) {
  // Tri pour stabilité du queryKey (TanStack hash l'array)
  const stableIds = [...ids].sort();

  return useQuery<RecruiterAthleteCard[]>({
    // Clé distincte de l'ancienne : la forme rendue a changé, un cache
    // persistant de l'ancienne version tromperait les consommateurs.
    queryKey: ["athlete-cards-by-ids", stableIds],
    queryFn: async () => {
      if (stableIds.length === 0) return [];
      const supabase = createClient();
      const cardMap = await fetchRecruiterAthleteCards(supabase, stableIds);
      // La Map peut contenir MOINS d'entrées que d'IDs demandés : la RPC
      // ne rend rien pour un athlète inactif ou supprimé. On rend donc
      // les cartes réellement obtenues, pas un tableau troué.
      return stableIds
        .map((id) => cardMap.get(id))
        .filter((c): c is RecruiterAthleteCard => !!c);
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
