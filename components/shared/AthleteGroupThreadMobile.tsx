"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteGroupThreadMobile — côté ATHLÈTE d'un fil de GROUPE (TEAM)
   sur mobile. Réutilise MessageThreadShell via renderMessage (rendu
   MULTI-parties : identité de chaque expéditeur staff, « Vous » pour
   soi) + composerNote pour la mention discrète.

   Visibilité : la RLS ne renvoie que les annonces staff ('ALL') + SES
   envois — jamais la réponse privée d'un coéquipier. Aucun re-filtre
   client. Envoi → useSendMessage (le trigger estampille audience='STAFF'
   = réponse privée aux entraîneurs). Registre immuable côté athlète →
   mark-read via SA ligne participant.last_read_at. Realtime : refetch
   sous RLS (jamais d'injection de payload brut) → mineur-safety.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
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
import { GroupMembersSheet, buildGroupMembers } from "@/components/shared/messaging/GroupMembersSheet";

export function AthleteGroupThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: meta, isLoading: metaLoading } = useGroupThreadMeta(conversationId, "ATHLETE");
  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();

  // Mark-read : SA ligne participant.last_read_at (aucune policy UPDATE messages côté athlète).
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

  // Realtime : refetch sous RLS (jamais d'injection brute → pas de fuite d'une réponse de coéquipier).
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

  const [membersOpen, setMembersOpen] = useState(false);
  const members = meta ? buildGroupMembers(meta.names, meta.roles, meta.initials, userId) : [];

  // Header tappable → ouvre le sheet des membres (#1). Pour l'athlète, la RLS
  // ne renvoie que le staff + lui-même → le sheet ne liste jamais les coéquipiers.
  const headerCenter = (
    <button type="button" onClick={() => setMembersOpen(true)}
      className="flex flex-col items-center gap-0.5 min-w-0 max-w-full active:opacity-70 transition-opacity">
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#6366F1]/15 border border-[#6366F1]/30">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <span className="text-[16px] font-bold text-white truncate max-w-full">{meta?.groupName ?? "Groupe"}</span>
      <span className="text-[12px] text-white/55 truncate max-w-full">
        Groupe d&apos;équipe{(meta?.memberCount ?? 0) > 0 ? ` · ${meta?.memberCount} membres` : ""}
      </span>
    </button>
  );

  const renderMessage = (m: MessageRow, isMe: boolean) => {
    if (m.retracted_at) {
      return (
        <div className="flex justify-center px-4 py-1">
          <span className="text-[12px] italic text-[#6B7280]">{m.content || "Message retiré par Nexus"}</span>
        </div>
      );
    }
    const name = meta?.names?.[m.sender_id] || "Entraîneur";
    const isSending = m.status === "sending";
    const isError = m.status === "error";
    return (
      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} px-4`}>
        {!isMe && (
          <span className="text-[11px] font-semibold text-white/55 mb-0.5 pl-1">{name}</span>
        )}
        <div
          className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${isMe ? `rounded-br-md ${isSending ? "opacity-70" : ""} ${isError ? "ring-2 ring-[#EF4444]/60" : ""}` : "rounded-bl-md"}`}
          style={{ backgroundColor: isMe ? "#0A84FF" : "#262628" }}
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

  const composerNote = (
    <p className="text-[10px] text-white/40 flex items-center gap-1.5">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Ta réponse ne sera visible que par les entraîneurs
    </p>
  );

  return (
    <>
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
        onBack={() => router.push("/athlete/messages")}
        onSend={handleSend}
        renderMessage={renderMessage}
        composerNote={composerNote}
        composerPlaceholder="Écrire une réponse…"
        emptyTitle="Aucun message"
        emptyDescription="Les annonces de tes entraîneurs apparaîtront ici."
      />
      <GroupMembersSheet open={membersOpen} onClose={() => setMembersOpen(false)} members={members}
        title="Membres de l’équipe" />
    </>
  );
}
