/* ═══════════════════════════════════════════════════════════════
   useUpsertAthleteGrade — TanStack mutation (Lot 2)
   Pose, remplace ou retire le grade A-D d'un athlète.

   Tableau blanc (lot 2 de la 1.4.4) : unite_ecrire_grade, comme le web —
   écrit sur la ligne de l'acteur, recopié sur celles des collègues ; `null`
   le retire POUR L'UNITÉ (unite_retirer_grade). Avant, une écriture directe
   de « ma ligne » : le grade d'un collègue restait affiché après un retrait.
   Optimiste dans tous les caches du processus (cacheDossiers).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Grade } from "@/lib/config/grades";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { ecrireCarte } from "@/lib/cartes/carteProspect";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";

export function useUpsertAthleteGrade() {
  const queryClient = useQueryClient();

  return useMutation({
    /** `grade: null` = retirer le grade pour l'unité. */
    mutationFn: async ({ athleteId, grade, carte = false }: { athleteId: string; grade: Grade | null; carte?: boolean }) => {
      if (carte) {
        const erreur = await ecrireCarte(createClient(), athleteId, { grade });
        if (erreur) throw erreur;
        return;
      }
      const { error } = await createClient().rpc("unite_ecrire_grade", { p_athlete_id: athleteId, p_grade: grade });
      if (error) throw error;
    },
    onMutate: async ({ athleteId, grade }) => ({
      instantane: await patcherDossiers(queryClient, athleteId, (c) => ({ ...c, grade })),
    }),
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
