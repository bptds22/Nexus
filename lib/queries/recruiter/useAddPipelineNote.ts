/* ═══════════════════════════════════════════════════════════════
   useAddPipelineNote — TanStack mutation (iter 6.1a)
   Insert d'une note dans recruiter_notes (table partagée avec le
   profil athlète). Invalidation de la query ["pipeline-notes",
   userId, athleteId] consommée par usePipelineNotes.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";

export function useAddPipelineNote() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ athleteId, content }: { athleteId: string; content: string }) => {
      const userId = currentUser?.profile.id;
      if (!userId) throw new Error("Not authenticated");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Note vide");
      const supabase = createClient();

      const { error } = await supabase
        .from("recruiter_notes")
        .insert({
          recruiter_id: userId,
          athlete_id: athleteId,
          content: trimmed,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const userId = currentUser?.profile.id;
      queryClient.invalidateQueries({
        queryKey: ["pipeline-notes", userId, variables.athleteId],
      });
    },
  });
}
