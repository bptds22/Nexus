/* ═══════════════════════════════════════════════════════════════
   useSendMessage — TanStack mutation (iter 7.8b)
   Insert message + update conversation.last_message_at + invalidate
   cache liste threads. Optimistic : ajout immédiat au cache messages
   avec id temp + status "sending". Revert + status "error" si fail.
═══════════════════════════════════════════════════════════════ */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import type { MessageRow } from "@/lib/queries/recruiter/useMessages";

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!userId) throw new Error("Not authenticated");
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Message vide");
      const supabase = createClient();
      const nowIso = new Date().toISOString();
      const { data: newMsg, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: userId, content: trimmed })
        .select("id, conversation_id, sender_id, content, created_at")
        .single();
      if (error) throw error;
      // Update conversation.last_message_at — best-effort, ne bloque pas le retour
      await supabase
        .from("conversations")
        .update({ last_message_at: nowIso, updated_at: nowIso })
        .eq("id", conversationId);
      return newMsg as MessageRow;
    },
    onMutate: async ({ conversationId, content }) => {
      const queryKey = ["messages", conversationId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MessageRow[]>(queryKey);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticMsg: MessageRow = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: userId || "",
        content: content.trim(),
        created_at: new Date().toISOString(),
        status: "sending",
      };
      queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
        if (!old) return [optimisticMsg];
        return [...old, optimisticMsg];
      });
      return { previous, tempId, conversationId };
    },
    onSuccess: (newMsg, _vars, context) => {
      // Remplace l'optimistic par le vrai row (avec UUID DB)
      const queryKey = ["messages", context?.conversationId];
      queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
        if (!old) return [newMsg];
        return old.map((m) => (m.id === context?.tempId ? { ...newMsg, status: "sent" } : m));
      });
    },
    onError: (_err, _vars, context) => {
      // Marque le message optimistic en "error" (pas de revert pour permettre retry)
      if (!context?.tempId || !context?.conversationId) return;
      const queryKey = ["messages", context.conversationId];
      queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
        if (!old) return old;
        return old.map((m) => (m.id === context.tempId ? { ...m, status: "error" } : m));
      });
    },
    onSettled: () => {
      // Invalidate la liste de conversations (last_message_at + unread).
      // Préfixe → catche ["conversations", userId] (recruteur) et
      // ["conversations", "coach", userId] (coach) en un seul shot.
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      // ── NE PAS invalider ["messages", conversationId] ici. ──
      // L'optimistic update a déjà écrit le bubble dans le cache et
      // onSuccess l'a swappé du tempId vers l'UUID DB ; la subscription
      // postgres_changes (INSERT) côté composant merge le row canonique
      // si jamais le payload arrivait avant onSuccess. Refetcher ici
      // déclenchait un re-render avec data potentiellement vide ou
      // ordonnée différemment qui CLOBBERAIT le bubble optimistic →
      // le coach voyait sa bulle disparaître (le recruteur avait la même
      // race mais elle était masquée par la chance de timing).
    },
  });
}
