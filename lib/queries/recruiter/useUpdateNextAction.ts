/* ═══════════════════════════════════════════════════════════════
   useUpdateNextAction — TanStack mutation (Lot 1)
   Écrit next_action_at d'un dossier, LA DATE SEULEMENT.

   FRONTIÈRE VOLONTAIRE — next_action_note n'est ni lue, ni écrite, ni
   envoyée par ce hook (docs/pipeline-recruteur-frontieres.md).

   Tableau blanc (lot 2 de la 1.4.4) : unite_ecrire_dossier avec le seul
   champ next_action_at, comme le web. La relance est celle du DOSSIER DE
   L'UNITÉ : la ligne de l'acteur est écrite, la synchronisation la recopie
   sur celles des collègues. Optimiste dans tous les caches du processus.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { ecrireCarte } from "@/lib/cartes/carteProspect";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";

export function useUpdateNextAction() {
  const queryClient = useQueryClient();

  return useMutation({
    /** `nextActionAt` : "AAAA-MM-JJ" (colonne date) ou null pour effacer. */
    mutationFn: async ({ cardId, nextActionAt, carte = false }: { cardId: string; nextActionAt: string | null; carte?: boolean }) => {
      if (carte) {
        const erreur = await ecrireCarte(createClient(), cardId, { next_action_at: nextActionAt });
        if (erreur) throw erreur;
        return;
      }
      const { error } = await createClient().rpc("unite_ecrire_dossier", {
        p_athlete_id: cardId, p_champs: { next_action_at: nextActionAt },
      });
      if (error) throw error;
    },
    onMutate: async ({ cardId, nextActionAt }) => ({
      instantane: await patcherDossiers(queryClient, cardId, (c) => ({ ...c, next_action_at: nextActionAt })),
    }),
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
