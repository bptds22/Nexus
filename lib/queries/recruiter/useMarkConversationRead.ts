/* ═══════════════════════════════════════════════════════════════
   useMarkConversationRead — TanStack mutation (iter 7.8b)
   Marque une conversation lue par la RPC mark_conversation_read (pose
   messages.read_at, remet unread_count à 0). À appeler au mount du thread
   detail (côté recruteur).
   Correctif du 2026-09-28 : l'ancien UPDATE ne touchait qu'unread_count,
   colonne que rien n'incrémente ; read_at restait vide et les pastilles
   comptaient faux. La règle unique : lib/messaging/nonLusRecruteur.ts.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { signalerCompteursAJour } from "@/lib/messaging/nonLusRecruteur";

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId }: { conversationId: string }) => {
      const { error } = await createClient().rpc("mark_conversation_read", { p_conv: conversationId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "kpi"] });
      signalerCompteursAJour();
    },
  });
}
