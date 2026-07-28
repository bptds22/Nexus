"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachGroupThreadMobile — côté STAFF (coach/directeur) d'un fil de
   GROUPE (conversation_type='GROUP') sur mobile. Réutilise
   MessageThreadShell (chrome + clavier + composer) via son slot
   renderMessage pour un rendu MULTI-parties : chaque message porte
   l'identité de son expéditeur.

   Visibilité : la RLS renvoie TOUT au staff. On n'y re-filtre pas.
   Étiquetage par le rôle de l'expéditeur (≡ messages.audience posé par
   le trigger) : expéditeur ATHLETE → réponse privée →
   « Réponse de {athlète} — visible staff seulement » ; STAFF → annonce.
   Envoi staff → useSendMessage (le trigger estampille audience='ALL').
   Realtime : on INVALIDE (refetch sous RLS) plutôt que d'injecter le
   payload brut — mineur-safety (jamais de fuite de réponse privée).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage } from "@/lib/queries/recruiter/useSendMessage";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useQueryClient } from "@tanstack/react-query";
import { MessageThreadShell } from "@/components/shared/messaging/MessageThreadShell";
import { timeOfDay } from "@/components/shared/messaging/utils";
import { useGroupThreadMeta } from "@/lib/queries/shared/useGroupThread";

export function CoachGroupThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: meta, isLoading: metaLoading } = useGroupThreadMeta(conversationId, "STAFF");
  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();

  // Mark-read : SA ligne participant.last_read_at.
  const markedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || !userId || markedRef.current) return;
    markedRef.current = true;
    const supabase = createClient();
    supabase.from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).eq("user_id", userId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }));
  }, [conversationId, userId, queryClient]);

  // Realtime : refetch sous RLS (jamais d'injection de payload brut).
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  const handleSend = (content: string) => {
    if (!conversationId) return;
    sendMut.mutate({ conversationId, content }, {
      onError: () => toast.error({ message: "Erreur d'envoi", detail: "Vérifie ta connexion" }),
    });
  };

  const isTeam = meta?.groupScope === "TEAM";

  const headerCenter = (
    <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-full">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#6366F1]/15 border border-[#6366F1]/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <span className="text-[16px] font-bold text-white truncate max-w-full">{meta?.groupName ?? "Groupe"}</span>
      <span className="text-[12px] text-white/55 truncate max-w-full">
        {isTeam ? "Équipe" : "Staff"}{(meta?.memberCount ?? 0) > 0 ? ` · ${meta?.memberCount} membres` : ""}
      </span>
    </div>
  );

  const renderMessage = (m: MessageRow, isMe: boolean) => {
    if (m.retracted_at) {
      return (
        <div className="flex justify-center px-4 py-1">
          <span className="text-[12px] italic text-[#6B7280]">{m.content || "Message retiré par Nexus"}</span>
        </div>
      );
    }
    const name = meta?.names?.[m.sender_id] || "Membre";
    const isAthleteReply = meta?.roles?.[m.sender_id] === "ATHLETE";
    const isSending = m.status === "sending";
    const isError = m.status === "error";
    return (
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} px-4`}>
        {!isMe && (
          <span className="text-[11px] font-semibold text-white/55 mb-0.5 pl-1">{name}</span>
        )}
        {isAthleteReply && !isMe && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#F59E0B] mb-1 pl-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Réponse de {name} — visible staff seulement
          </span>
        )}
        <div
          className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isMe ? `rounded-br-md ${isSending ? "opacity-70" : ""} ${isError ? "ring-2 ring-[#EF4444]/60" : ""}` : "rounded-bl-md"} ${isAthleteReply && !isMe ? "border border-[#F59E0B]/25" : ""}`}
          style={{ backgroundColor: isMe ? "#4338CA" : isAthleteReply ? "#3B2E12" : "#262628" }}
        >
          <p className="text-[16px] text-white leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
        </div>
        <div className={`flex items-center gap-1.5 mt-1 ${isMe ? "pr-1" : "pl-1"}`}>
          <span className="text-[10px] text-white/35">{timeOfDay(m.created_at)}</span>
          {isMe && isSending && <span className="text-[10px] text-white/35 italic">envoi…</span>}
          {isMe && isError && <span className="text-[10px] text-[#EF4444] font-semibold">échec</span>}
        </div>
      </div>
    );
  };

  return (
    <MessageThreadShell<MessageRow>
      messages={messages}
      isLoading={metaLoading || msgsLoading}
      currentUserId={userId}
      getId={(m) => m.id}
      getContent={(m) => m.content}
      getCreatedAt={(m) => m.created_at}
      getSenderId={(m) => m.sender_id}
      getStatus={(m) => m.status}
      getRetracted={(m) => !!m.retracted_at}
      headerCenter={headerCenter}
      onBack={() => router.push("/coach/demandes")}
      onSend={handleSend}
      renderMessage={renderMessage}
      composerPlaceholder={isTeam ? "Annonce au groupe…" : "Message…"}
      emptyTitle="Démarre la conversation"
      emptyDescription={`Écris une première annonce à ${meta?.groupName ?? "ton groupe"}.`}
    />
  );
}
