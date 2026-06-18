/* ═══════════════════════════════════════════════════════════════
   useTogglePipelinePriority — TanStack mutation (iter 6.1a-fix)
   Toggle de recruiter_pipeline.flagged (réutilisé comme "priorité").

   Iter 6.1a-fix : ajout de l'optimistic update via onMutate/onError/
   onSettled. Patch immédiat du cache ["pipeline", userId] pour que
   la card row affiche le badge ⭐ sans attendre le refetch. Revert
   en onError, invalidation en onSettled pour resync DB.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { PipelineData } from "@/lib/queries/recruiter/usePipelineCards";

export function useTogglePipelinePriority() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.profile.id;
  const queryKey = ["pipeline", userId];

  return useMutation({
    mutationFn: async ({ cardId, value }: { cardId: string; value: boolean }) => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { error } = await supabase
        .from("recruiter_pipeline")
        .update({ flagged: value })
        .eq("athlete_id", cardId)
        .eq("recruiter_id", userId);
      if (error) throw error;
    },
    // Optimistic update — patch le cache avant l'aller-retour serveur
    onMutate: async ({ cardId, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PipelineData>(queryKey);
      queryClient.setQueryData<PipelineData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          cards: old.cards.map((c) =>
            c.id === cardId ? { ...c, flagged: value } : c
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
