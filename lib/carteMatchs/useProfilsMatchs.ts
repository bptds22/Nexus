/* ═══════════════════════════════════════════════════════════════
   useProfilsMatchs — les profils Nexus des deux équipes de chaque match
   (RPC matchs_profils_nexus, lot A+, BP 2026-10-07). UN appel par jeu de
   matchs : la page passe les game_id de la journée affichée (avant les
   filtres de catégorie / division / ligue, pour qu'un filtre ne relance
   pas d'appel). Le lot B passera « tous les matchs » du jour : le hook ne
   sait rien du mode « suivis ». Partageable avec le mobile.

   Un échec (recruteur non Pro côté base, réseau) rend une carte VIDE : la
   page n'affiche alors aucune pastille plutôt qu'un message d'erreur.
═══════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { profilsParMatch, type LigneProfilNexus, type ProfilsMatch } from "@/lib/carteMatchs/carteMatchs";

/** Plafond de la RPC (refus au-delà). */
export const MAX_MATCHS_PAR_APPEL = 500;

export function useProfilsMatchs(gameIds: string[], suivis: ReadonlySet<string>, enabled: boolean) {
  const ids = [...new Set(gameIds)].sort();
  const requete = useQuery<LigneProfilNexus[]>({
    queryKey: ["carte-matchs", "profils-nexus", ids.join(",")],
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const lignes: LigneProfilNexus[] = [];
      for (let i = 0; i < ids.length; i += MAX_MATCHS_PAR_APPEL) {
        const { data, error } = await supabase.rpc("matchs_profils_nexus", { p_games: ids.slice(i, i + MAX_MATCHS_PAR_APPEL) });
        if (error) throw error;
        lignes.push(...((data ?? []) as LigneProfilNexus[]));
      }
      return lignes;
    },
  });
  const parMatch: Map<string, ProfilsMatch> = useMemo(() => profilsParMatch(requete.data ?? [], suivis), [requete.data, suivis]);
  return { parMatch, isLoading: requete.isLoading, isError: requete.isError };
}
