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
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const queryKey = ["pipeline", userId];

  return useMutation({
    mutationFn: async ({ cardId, newStage }: { cardId: string; newStage: string }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("recruiter_pipeline")
        .update({
          stage: newStage.toUpperCase(),
          moved_at: now,
          updated_at: now,
        })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", userId);

      if (error) throw error;
    },
    onMutate: async ({ cardId, newStage }) => {
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    },
  });
}
