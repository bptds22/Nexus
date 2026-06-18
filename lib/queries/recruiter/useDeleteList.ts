/* ═══════════════════════════════════════════════════════════════
   useDeleteList — TanStack mutation (iter 7.15 Sprint 1)
   DELETE recruiter_lists par id. La cascade ON DELETE CASCADE sur
   recruiter_list_members et recruiter_list_notes nettoie automatiquement
   les jonctions. Optimistic remove + revert au snapshot si erreur DB.

   ⚠️ Undo via toast réinsère SEULEMENT la row recruiter_lists (nouvel id) —
   les membres et notes sont perdus (cascade). Acceptable Sprint 1 où les
   listes ont peu de membres ; pour un undo complet, soft-delete dans un
   sprint futur (ajout colonne deleted_at).
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { RecruiterListSummary } from "@/lib/queries/recruiter/useRecruiterLists";

export function useDeleteList() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async (listId: string): Promise<void> => {
      if (!userId) throw new Error("Not authenticated");
      const supabase = createClient();
      const { error } = await supabase
        .from("recruiter_lists")
        .delete()
        .eq("id", listId);
      if (error) throw error;
    },
    onMutate: async (listId) => {
      const queryKey = ["recruiter-lists", userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<RecruiterListSummary[]>(queryKey);
      queryClient.setQueryData<RecruiterListSummary[]>(queryKey, (prev) =>
        (prev ?? []).filter((l) => l.id !== listId),
      );
      return { previous, queryKey };
    },
    onError: (_err, _listId, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recruiter-lists", userId] });
    },
  });
}
