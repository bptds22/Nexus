/* ═══════════════════════════════════════════════════════════════
   useMarkConversationRead — TanStack mutation (iter 7.8b)
   UPDATE conversations.unread_count = 0 pour une conversation donnée.
   À appeler au mount du thread detail (côté recruteur).
   Note : on reste sur unread_count thread-level (cohérent avec
   l'existant). read_at par message existe en colonne mais n'est pas
   utilisé en V1.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
    },
  });
}
