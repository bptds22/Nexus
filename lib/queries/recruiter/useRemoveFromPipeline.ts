/* ═══════════════════════════════════════════════════════════════
   useRemoveFromPipeline — TanStack mutation (iter 6.1a)
   Retire un athlète de « Mon processus ».

   Tableau blanc (lot 2 de la 1.4.4, registre §38) : unite_retirer_du_processus
   — le dossier part POUR TOUTE L'UNITÉ (les lignes de chaque collègue), avec
   UNE ligne de journal signée par l'acteur. Avant, un DELETE de « ma ligne » :
   le dossier restait dans l'unité par les lignes des collègues, et revenait
   au rechargement. La confirmation qui NOMME les collègues est faite par
   l'écran AVANT d'appeler ce hook (décision BP 3, même texte que le web).

   `sportId` : l'unité du dossier (unite_sport_id de la carte), comme le web.

   ⚠️ NE TOUCHE PAS aux favoris : retirer du processus n'est pas retirer le
   cœur (l'inverse, retirer le cœur, retire aussi du processus — useBasculeFavori).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";

export function useRemoveFromPipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, sportId }: { cardId: string; sportId?: string | null }) => {
      const { error } = await createClient().rpc("unite_retirer_du_processus", {
        p_athlete_id: cardId, p_sport_id: sportId ?? null,
      });
      if (error) throw error;
    },
    onMutate: async ({ cardId }) => ({ instantane: await patcherDossiers(queryClient, cardId, null) }),
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
