/* ═══════════════════════════════════════════════════════════════
   useUpdateNextAction — TanStack mutation (Lot 1)
   Écrit recruiter_pipeline.next_action_at, LA DATE SEULEMENT.

   FRONTIÈRE VOLONTAIRE — next_action_note n'est ni lue, ni écrite, ni
   envoyée par ce hook. La RLS de recruiter_pipeline est par LIGNE : le
   coach de l'athlète reçoit déjà la ligne entière. La note de suivi est
   la cuisine interne du recruteur et ne descend pas au mobile sans
   décision explicite. Voir docs/pipeline-recruteur-frontieres.md.

   L'UPDATE ne porte QUE next_action_at : pas de flagged, pas de
   updated_at, pas de stage. Depuis le Lot 0, trg_log_pipeline_update
   porte un WHEN (old.stage IS DISTINCT FROM new.stage) — cette écriture
   ne journalise donc rien, ce qui est l'effet recherché.

   Calqué sur useTogglePipelinePriority : optimistic update du cache
   ["pipeline", userId] via onMutate, revert en onError, invalidation en
   onSettled.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";

export function useUpdateNextAction() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const queryKey = ["pipeline", userId];

  return useMutation({
    /** `nextActionAt` : "AAAA-MM-JJ" (colonne date) ou null pour effacer. */
    mutationFn: async ({ cardId, nextActionAt }: { cardId: string; nextActionAt: string | null }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { error } = await supabase
        .from("recruiter_pipeline")
        .update({ next_action_at: nextActionAt })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", userId);
      if (error) throw error;
    },
    onMutate: async ({ cardId, nextActionAt }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PipelineData>(queryKey);
      queryClient.setQueryData<PipelineData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === cardId ? { ...c, next_action_at: nextActionAt } : c
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
    },
  });
}
