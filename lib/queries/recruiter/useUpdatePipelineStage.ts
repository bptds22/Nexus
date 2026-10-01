/* ═══════════════════════════════════════════════════════════════
   useUpdatePipelineStage — TanStack mutation (iter 6.1b)
   Change le stage pipeline (recruiter_pipeline.stage) d'un athlète.

   Iter 6.1b : optimistic update via onMutate/onError/onSettled.
   Patch immédiat du cache ["pipeline", userId] pour que la card
   disparaisse instantanément du stage source et apparaisse dans
   le stage cible (zéro latence perçue au swipe Tinder).

   ⚠️ Contrainte chk_recruiter_pipeline_stage : stage doit être l'un de
   IDENTIFIE / CONTACTE / EN_DISCUSSION / VISITE_PLANIFIEE / ENGAGE /
   LETTRE_SIGNEE. Le statut "retire" passe par useRemoveFromPipeline
   (DELETE de la row).

   visit_at : CHEMIN D'ÉCRITURE UNIQUE de la date de visite côté kanban.
   Lot 0 de la 1.4.4 — la règle du web (lib/pipeline/regleVisite.ts, décision
   BP 2026-09-23) remplace « portée par VISITE_PLANIFIEE seulement » : la date
   survit à Engagé et Lettre signée, et n'est effacée que si l'étape redescend
   SOUS Visite planifiée. Sans date saisie, la colonne n'est pas touchée.
   `visitAtIso` : une chaîne POSE/MODIFIE la date ; `null` l'EFFACE (geste
   explicite, l'étape ne change pas — règle 3) ; absent : non touchée. Le cache optimiste suit la même
   règle (visiteApresChangementEtape).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";
import { hapticSelect } from "@/lib/haptics";
import { champVisitePourEtape, visiteApresChangementEtape } from "@/lib/pipeline/regleVisite";

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const queryKey = ["pipeline", userId];

  return useMutation({
    mutationFn: async ({ cardId, newStage, visitAtIso }: { cardId: string; newStage: string; visitAtIso?: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("recruiter_pipeline")
        .update({
          stage: newStage.toUpperCase(),
          moved_at: now,
          updated_at: now,
          ...(visitAtIso === null ? { visit_at: null } : champVisitePourEtape(newStage, visitAtIso)),
        })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", userId);

      if (error) throw error;
    },
    onMutate: async ({ cardId, newStage, visitAtIso }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PipelineData>(queryKey);
      const stageLower = newStage.toLowerCase();
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<PipelineData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === cardId
              ? {
                  ...c,
                  status: stageLower as typeof c.status,
                  moved_at: nowIso,
                  days_in_status: 0,
                  last_activity: "Mis à jour il y a 0 jours",
                  // Même règle que l'écriture (regleVisite).
                  visit_at: visitAtIso === null ? null : visiteApresChangementEtape(newStage, visitAtIso, c.visit_at ?? null),
                }
              : c
          ),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    // Feedback haptique APRÈS confirmation serveur (le visuel reste instantané
    // via l'optimistic update de onMutate). Couvre les 3 call-sites en un point.
    onSuccess: () => {
      hapticSelect();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    },
  });
}
