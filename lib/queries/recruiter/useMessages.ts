/* ═══════════════════════════════════════════════════════════════
   useMessages — TanStack hook (iter 7.8b)
   Liste de messages d'un thread, ordonnée ASC (chronologique).
   Cache key ["messages", conversationId].
   staleTime 30s — refetch silencieux après. La subscription Realtime
   côté composant pousse les inserts en live (cf RecruteurMessagesThreadMobile).
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // état local pour optimistic update (pas en DB) — voir useSendMessage
  status?: "sending" | "sent" | "error";
}

export function useMessages(conversationId: string | null) {
  return useQuery<MessageRow[]>({
    queryKey: ["messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000,
  });
}
