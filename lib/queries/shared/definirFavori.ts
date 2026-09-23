/* ═══════════════════════════════════════════════════════════════
   definirFavori — l'écriture de recruiter_favorites.

   Une exception, voulue : RecruteurFavorisMobile écrit lui-même. Il patche
   ["favorites", uid] en optimiste pour l'animation de sortie des cartes,
   vérifie l'erreur et revient en arrière si la base refuse — une
   invalidation ici ferait réapparaître la carte le temps du refetch.

   Pourquoi une seule : la bascule était recopiée dans quatre écrans
   (recherche web + mobile, fiche athlète web + mobile). Les fiches
   n'invalidaient pas ["favorites"] — or cette liste a un staleTime de
   5 min ET est persistée en sessionStorage (QueryProvider) : un athlète
   ajouté depuis sa fiche n'apparaissait pas dans « Mes favoris ». Et
   aucune des quatre ne lisait l'erreur retournée : le cœur devenait
   rouge même quand la base refusait l'insertion (RLS : plafond gratuit,
   rôle ; ou exception dans la chaîne de triggers AFTER INSERT).

   Contrat :
   - on passe l'état VOULU, pas « bascule » : un écran dont l'état local
     est périmé (autre onglet, double clic) ne produit jamais l'inverse de
     ce que le recruteur a vu ;
   - 23505 à l'insertion = déjà favori → l'état voulu est atteint, succès ;
   - les trois clés sont invalidées dans TOUS les cas, échec compris : la
     vérité serveur remplace ce que l'écran croyait ;
   - l'appelant ne met son état local à jour que sur `ok: true`.
═══════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { erreurLisible } from "@/lib/athlete/perimetreProtege";

export type ResultatFavori =
  | { ok: true; favori: boolean }
  | { ok: false; message: string };

const CLES_A_INVALIDER = [["favorites"], ["favoriteCounts"], ["dashboard", "kpi"]] as const;

function messageEchec(veut: boolean, code: string | undefined): string {
  if (!veut) return "Impossible de retirer cet athlète de tes favoris. Réessaie.";
  // 42501 = refus RLS : le plus souvent le plafond de favoris du forfait gratuit.
  if (code === "42501") return "Ajout refusé : la limite de favoris de ton forfait est peut-être atteinte.";
  return "Impossible d'ajouter cet athlète à tes favoris. Réessaie.";
}

export async function definirFavori(
  queryClient: QueryClient,
  athleteId: string,
  veut: boolean,
): Promise<ResultatFavori> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const recruteurId = session?.user?.id;
  if (!recruteurId) return { ok: false, message: "Ta session a expiré. Reconnecte-toi." };

  const { error } = veut
    ? await supabase.from("recruiter_favorites").insert({ recruiter_id: recruteurId, athlete_id: athleteId })
    : await supabase.from("recruiter_favorites").delete().eq("recruiter_id", recruteurId).eq("athlete_id", athleteId);

  for (const queryKey of CLES_A_INVALIDER) queryClient.invalidateQueries({ queryKey: [...queryKey] });

  if (error && !(veut && error.code === "23505")) {
    // Sérialisé à la main : en WebView, un objet passé à console.error sort en [object Object].
    console.error(`[favoris] ${veut ? "ajout" : "retrait"} refusé — ${erreurLisible(error)}`);
    return { ok: false, message: messageEchec(veut, error.code) };
  }
  return { ok: true, favori: veut };
}

/** Variante liée au QueryClient courant, pour les composants. */
export function useDefinirFavori() {
  const queryClient = useQueryClient();
  return useCallback(
    (athleteId: string, veut: boolean) => definirFavori(queryClient, athleteId, veut),
    [queryClient],
  );
}
