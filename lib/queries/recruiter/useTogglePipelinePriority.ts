/* ═══════════════════════════════════════════════════════════════
   useTogglePipelinePriority — TanStack mutation (iter 6.1a-fix)
   Bascule `flagged` (réutilisé comme « priorité ») d'un dossier.

   Tableau blanc (lot 2 de la 1.4.4) : unite_ecrire_dossier, comme le web —
   un UPDATE sur « ma ligne » ne touchait rien sur le dossier d'un collègue.
   Optimiste dans tous les caches du processus (cacheDossiers).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";

export function useTogglePipelinePriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, value }: { cardId: string; value: boolean }) => {
      const { error } = await createClient().rpc("unite_ecrire_dossier", {
        p_athlete_id: cardId, p_champs: { flagged: value },
      });
      if (error) throw error;
    },
    onMutate: async ({ cardId, value }) => ({
      instantane: await patcherDossiers(queryClient, cardId, (c) => ({ ...c, flagged: value })),
    }),
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
