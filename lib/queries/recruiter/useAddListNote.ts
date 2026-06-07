/* ═══════════════════════════════════════════════════════════════
   useAddListNote — TanStack mutation (iter 7.18 Sprint 3)
   INSERT recruiter_list_notes (list_id, content). Optimistic add
   en tête du feed ["list-notes", listId, userId] (tri DESC). Snapshot
   revert si erreur. Invalidate au settle.
   NB : aucun trigger d'activity log sur recruiter_list_notes — seul
   recruiter_notes alimente recruiter_activity_log via log_note_added.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { ListNoteRow } from "@/lib/queries/recruiter/useListNotes";

export function useAddListNote() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async ({ listId, content }: { listId: string; content: string }) => {
      if (!userId) throw new Error("Not authenticated");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Note vide");
      const supabase = createClient();
      const { error } = await supabase
        .from("recruiter_list_notes")
        .insert({ recruiter_id: userId, list_id: listId, content: trimmed });
      if (error) throw error;
    },
    onMutate: async ({ listId, content }) => {
      const queryKey = ["list-notes", listId, userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ListNoteRow[]>(queryKey);
      const optimistic: ListNoteRow = {
        id: `temp-${Math.floor(Math.random() * 1e9)}`,
        content: content.trim(),
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<ListNoteRow[]>(queryKey, (prev) => [
        optimistic,
        ...(prev ?? []),
      ]);
      return { previous, queryKey };
    },
    onError: (_err, _input, context) => {
      if (context?.previous !== undefined && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["list-notes", variables.listId, userId],
      });
    },
  });
}
