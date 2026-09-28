/* ═══════════════════════════════════════════════════════════════
   useFavorisUnite — les favoris de l'UNITÉ (lot B2, étape 2, web).

   Décision BP 2026-09-24 : un cœur posé par un collègue Pro s'affiche chez
   tous les Pro de l'unité (cégep × sport) — recherche, fiche, Mes favoris.
   Lu par unite_favoris() (lot B1) : une ligne par athlète, `recruteurs` =
   qui l'a mis en favori, dans l'ordre d'ajout.

   Gratuit : rien ne change, ses propres favoris (useFavorites). La base le
   garantit aussi — les policies d'unité exigent Pro depuis B2-0, et
   unite_favoris() est SECURITY INVOKER.

   Admin cégep : son sport seulement, comme un recruteur de l'unité. Les
   autres sports de son cégep relèvent de l'étape 3 (registre §39–40).

   Web seulement : l'app 1.4.3 garde useFavorites (ses propres lignes)
   jusqu'à la 1.4.4 (registre §38).

   Clé sous le préfixe ["favorites"] : dans la liste tableauBlanc.ts, donc
   jamais persistée, et invalidée par toute écriture d'unité.
═══════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useFavorites } from "@/lib/queries/shared/useFavorites";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";

export interface FavorisUnite {
  /** Vrai pour un Pro / All Star : les favoris sont ceux de l'unité. */
  modeUnite: boolean;
  /** Les athlètes en favori (de l'unité, ou les siens pour un gratuit). */
  ids: Set<string>;
  /** Qui a mis l'athlète en favori, par id de recruteur (ordre d'ajout). */
  parAthlete: Record<string, string[]>;
  /** Nom d'affichage d'un recruteur de l'unité. */
  nom: (recruteurId: string) => string;
  /** Les COLLÈGUES (moi exclu) qui ont l'athlète en favori, par nom. */
  collegues: (athleteId: string) => string[];
  isLoading: boolean;
}

interface LigneFavori {
  athlete_id: string;
  recruteurs: string[] | null;
}

export function useFavorisUnite(): FavorisUnite {
  const { tier, loading: tierLoading } = useSubscription();
  const modeUnite = !tierLoading && (tier === "pro" || tier === "all_star");
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id ?? null;

  const unite = useQuery<LigneFavori[]>({
    queryKey: ["favorites", "unite", moi],
    enabled: !!moi && modeUnite,
    // Tableau PARTAGÉ : rechargé à chaque affichage et au retour sur l'onglet.
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("unite_favoris");
      if (error) throw error;
      return (data ?? []) as LigneFavori[];
    },
  });
  const propres = useFavorites();
  const { data: auteurs = {} } = useAuteursUnite(modeUnite);

  return useMemo<FavorisUnite>(() => {
    const parAthlete: Record<string, string[]> = {};
    if (modeUnite) {
      for (const l of unite.data ?? []) {
        // Tout le cégep n'est pas demandé : une ligne par athlète. Par
        // prudence, on fusionne quand même si deux lignes arrivaient.
        parAthlete[l.athlete_id] = [...(parAthlete[l.athlete_id] ?? []), ...(l.recruteurs ?? [])];
      }
    } else if (moi) {
      for (const id of propres.data ?? []) parAthlete[id] = [moi];
    }
    const nom = (id: string) => nomAuteur(auteurs[id]);
    return {
      modeUnite,
      ids: new Set(Object.keys(parAthlete)),
      parAthlete,
      nom,
      collegues: (athleteId: string) => (parAthlete[athleteId] ?? []).filter((id) => id !== moi).map(nom),
      isLoading: tierLoading || (modeUnite ? unite.isLoading : propres.isLoading),
    };
  }, [modeUnite, unite.data, unite.isLoading, propres.data, propres.isLoading, auteurs, moi, tierLoading]);
}

/** « Marie Tremblay », « Marie Tremblay et Luc Roy », « A, B et C ». */
export function joindreNoms(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}
