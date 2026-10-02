/* ═══════════════════════════════════════════════════════════════
   useUpdatePipelineStage — TanStack mutation (iter 6.1b)
   Change l'étape d'un dossier de « Mon processus ».

   TABLEAU BLANC (lot 2 de la 1.4.4, registre §38) : l'écriture passe par
   unite_ecrire_dossier(athlete_id, champs) — la ligne de l'ACTEUR, créée au
   besoin, alignée sur l'unité, journal signé par lui. Avant, un UPDATE sur
   « ma ligne » : sur le dossier d'un collègue (pas de ligne à moi), il ne
   touchait AUCUNE ligne et ne disait rien. Même chemin que le web
   (app/recruteur/pipeline/page.tsx, ecrireDossier).

   Un compte gratuit n'arrive jamais ici : l'écran l'arrête avant (mode
   démo), et la base refuserait (user_has_pro).

   Optimiste : la carte change de colonne tout de suite, dans tous les caches
   du processus (cacheDossiers) ; remise en place si la base refuse.

   ⚠️ « Retiré » n'est pas une étape : useRemoveFromPipeline.

   visit_at : CHEMIN D'ÉCRITURE UNIQUE de la date de visite côté kanban.
   Règle du web (lib/pipeline/regleVisite.ts, décision BP 2026-09-23) : la
   date survit à Engagé et Lettre signée, et n'est effacée que si l'étape
   redescend SOUS Visite planifiée. `visitAtIso` : une chaîne POSE/MODIFIE la
   date ; `null` l'EFFACE (l'étape ne change pas) ; absent : non touchée.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { hapticSelect } from "@/lib/haptics";
import { champVisitePourEtape, visiteApresChangementEtape } from "@/lib/pipeline/regleVisite";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { ecrireCarte } from "@/lib/cartes/carteProspect";
import { patcherDossiers, restaurerDossiers } from "@/lib/queries/recruiter/cacheDossiers";

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    /** `carte` : carte prospect (lot C) — mêmes champs, écrits sur la carte. */
    mutationFn: async ({ cardId, newStage, visitAtIso, carte = false }: { cardId: string; newStage: string; visitAtIso?: string | null; carte?: boolean }) => {
      const champs = {
        stage: newStage.toUpperCase(),
        ...(visitAtIso === null ? { visit_at: null } : champVisitePourEtape(newStage, visitAtIso)),
      };
      if (carte) {
        const erreur = await ecrireCarte(createClient(), cardId, champs);
        if (erreur) throw erreur;
        return;
      }
      const { error } = await createClient().rpc("unite_ecrire_dossier", { p_athlete_id: cardId, p_champs: champs });
      if (error) throw error;
    },
    onMutate: async ({ cardId, newStage, visitAtIso }) => {
      const nowIso = new Date().toISOString();
      const instantane = await patcherDossiers(queryClient, cardId, (c) => ({
        ...c,
        status: newStage.toLowerCase() as typeof c.status,
        moved_at: nowIso,
        days_in_status: 0,
        last_activity: "Mis à jour il y a 0 jours",
        // Même règle que l'écriture (regleVisite).
        visit_at: visitAtIso === null ? null : visiteApresChangementEtape(newStage, visitAtIso, c.visit_at ?? null),
      }));
      return { instantane };
    },
    onError: (_err, _vars, context) => restaurerDossiers(queryClient, context?.instantane),
    // Feedback haptique APRÈS confirmation serveur (le visuel reste instantané).
    onSuccess: () => { hapticSelect(); },
    onSettled: () => { void invaliderTableauBlanc(queryClient); },
  });
}
