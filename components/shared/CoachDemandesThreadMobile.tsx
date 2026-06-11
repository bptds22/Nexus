"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDemandesThreadMobile — Thread detail mobile (Phase 2)
   Coach side. Mirror of RecruteurMessagesThreadMobile, but :
   - HeaderCenter = RECRUITER photo + name + CÉGEP + chevron,
     sous-titre "Au sujet de {athlète} ›" tappable.
   - Bubbles : coach = bleu iOS #0A84FF (à droite), recruteur =
     gris iOS dark #262628 (à gauche) — mêmes couleurs que côté
     recruteur (le "me" est toujours bleu, l'autre toujours gris).
   - Pas de bottom sheets coach-specific en Phase 2. Le chevron
     "Au sujet de {athlète}" route vers /coach/athletes/[id]
     (le coach owne déjà ce profil).

   Reuse :
   - MessageThreadShell + MessageBubble + DaySeparator + utils.
   - useMessages / useSendMessage / useMarkConversationRead
     (conversation-id keyed → agnostiques au rôle).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage } from "@/lib/queries/recruiter/useSendMessage";
import { useMarkConversationRead } from "@/lib/queries/recruiter/useMarkConversationRead";
import { useCoachThreadContext } from "@/lib/queries/coach/useCoachThreadContext";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useQueryClient } from "@tanstack/react-query";
import { MessageThreadShell } from "@/components/shared/messaging/MessageThreadShell";
import { triggerHaptic } from "@/components/shared/messaging/utils";

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function CoachDemandesThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: ctx, isLoading: ctxLoading } = useCoachThreadContext(conversationId);
  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();
  const markRead = useMarkConversationRead();

  // Mark as read au mount (1 fois)
  const markedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || markedRef.current) return;
    markedRef.current = true;
    markRead.mutate({ conversationId });
  }, [conversationId, markRead]);

  // Realtime subscription : INSERT messages live
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          const queryKey = ["messages", conversationId];
          queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
            if (!old) return [newMsg];
            if (old.some((m) => m.id === newMsg.id)) return old;
            return [...old, newMsg];
          });
          // Si c'est un message du recruteur (pas nous), re-marquer comme lu.
          if (newMsg.sender_id !== userId) {
            markRead.mutate({ conversationId });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, queryClient, markRead]);

  const handleSendContent = (content: string) => {
    if (!conversationId) return;
    sendMut.mutate(
      { conversationId, content },
      {
        onError: () => {
          toast.error({ message: "Erreur d'envoi", detail: "Vérifie ta connexion" });
        },
      }
    );
  };

  const handleBack = () => router.push("/coach/demandes");

  const handleAthleteTap = () => {
    triggerHaptic("Light");
    if (ctx?.athleteId) {
      router.push(`/coach/athletes/${ctx.athleteId}`);
    }
  };

  const loading = ctxLoading || msgsLoading;

  /* Header centre — bloc spécifique coach :
     - photo recruteur 36 + nom + chevron (informationnel ; pas de
       sheet recruteur en Phase 2)
     - CÉGEP en petit
     - sous-titre "Au sujet de {athlète} ›" → /coach/athletes/[id] */
  const headerCenter = (
    <>
      <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-full">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
          <AthletePhoto
            photoUrl={ctx?.recruiterPhotoUrl ?? null}
            firstName={ctx?.recruiterInitials?.[0] ?? "R"}
            lastName={ctx?.recruiterInitials?.[1] ?? ""}
            size={36}
          />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 max-w-full">
          <span className="text-[16px] font-bold text-white truncate">
            {ctx?.recruiterName ?? "—"}
          </span>
        </div>
        {ctx?.recruiterCegep && (
          <span className="text-[12px] text-white/55 truncate max-w-full">
            {ctx.recruiterCegep}
          </span>
        )}
      </div>
      {ctx?.athleteName && (
        <button
          type="button"
          onClick={handleAthleteTap}
          className="inline-flex items-center gap-1 text-[14px] text-white/75 truncate max-w-full active:opacity-70 transition-opacity"
        >
          <span className="truncate">Au sujet de {ctx.athleteName}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </>
  );

  return (
    <MessageThreadShell<MessageRow>
      messages={messages}
      isLoading={loading}
      currentUserId={userId}
      getId={(m) => m.id}
      getContent={(m) => m.content}
      getCreatedAt={(m) => m.created_at}
      getSenderId={(m) => m.sender_id}
      getStatus={(m) => m.status}
      meColor="#0A84FF"
      otherColor="#262628"
      headerCenter={headerCenter}
      onBack={handleBack}
      onSend={handleSendContent}
      composerPlaceholder="Message…"
      emptyTitle="Démarre la conversation"
      emptyDescription={`Pose une question à ${ctx?.recruiterName ?? "le recruteur"} ou réponds à sa demande.`}
    />
  );
}
