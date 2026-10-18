/* ═══════════════════════════════════════════════════════════════
   useRemoveFromPipeline — TanStack mutation (iter 6.1a)
   Retire un athlète (ou une carte prospect) de « Mon processus ».

   BP 2026-10-18 : RIEN n'est supprimé. Le dossier passe à l'étape RETIRE,
   en fin de processus, avec une RAISON obligatoire et une note — il reste
   visible à toute l'unité, pour que personne ne le recrute deux fois.
   Athlète → unite_retirer (pour toute l'unité, UNE ligne de journal signée) ;
   carte prospect → carte_retirer. Plus aucun appel à unite_retirer_du_processus
   ni à la suppression de carte : sans la migration 20261018140000, l'erreur
   remonte (« Mise à jour requise côté serveur »), jamais de repli.
   La confirmation qui NOMME les collègues est faite par l'écran AVANT
   d'appeler ce hook (décision BP 3, même texte que le web).

   `sportId` : l'unité du dossier (unite_sport_id de la carte), comme le web.

   ⚠️ NE TOUCHE PAS aux favoris : retirer du processus n'est pas retirer le
   cœur (l'inverse, retirer le cœur, retire aussi du processus — useBasculeFavori).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";
import { messageRetrait, retirerDossier, type RaisonRetrait } from "@/lib/retraits/retraits";

export function useRemoveFromPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, sportId, carte = false, raison, note }: {
      cardId: string; sportId?: string | null; carte?: boolean; raison: RaisonRetrait; note?: string | null;
    }) => {
      const erreur = await retirerDossier(createClient(), { id: cardId, carte, sportId, raison, note });
      if (erreur) throw new Error(messageRetrait(erreur));
    },
    // Optimiste : la carte passe dans « Retiré » (elle ne disparaît plus).
    onMutate: async ({ cardId }) => ({
      instantane: await patcherDossiers(queryClient, cardId, (c) => ({ ...c, status: "retire" })),
    }),
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
