"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteMessagesThreadMobile — Thread détail mobile (Phase C — athlète)
   Miroir de CoachDemandesThreadMobile. HeaderCenter = coach/directeur
   (photo + nom + rôle · école). Bulles : athlète = bleu #0A84FF (moi),
   coach = gris #262628. Rétraction → ligne système (getRetracted).

   Mark-read via le RPC mark_conversation_read (l'athlète n'a AUCUNE
   policy UPDATE sur messages — registre immuable — donc pas de
   useMarkConversationRead qui écrirait read_at en direct).

   Réutilise MessageThreadShell + useMessages + useSendMessage.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMessages, type MessageRow } from "@/lib/queries/recruiter/useMessages";
import { useSendMessage, isBlackoutError } from "@/lib/queries/recruiter/useSendMessage";
import { blackoutMessageFiche } from "@/lib/queries/recruiter/useAthleteContactable";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { useQueryClient } from "@tanstack/react-query";
import { MessageThreadShell } from "@/components/shared/messaging/MessageThreadShell";
import { AthleteGroupThreadMobile } from "@/components/shared/AthleteGroupThreadMobile";
import { NexusThreadMobile } from "@/components/messaging/NexusThreadView";

interface CoachHeader { name: string; initials: string; photoUrl: string | null; role: string; school: string; }

function roleLabel(scRole: string | undefined): string {
  return scRole === "DIRECTEUR" || scRole === "DIRECTEUR_INTERIM" ? "Directeur sportif" : "Entraîneur";
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER — route par conversation_type. GROUP → fil de groupe
   (multi-parties, visibilité asymétrique). Sinon → le fil 2-party
   existant (ATHLETE_COACH / RECRUTEUR_ATHLETE), inchangé.
═══════════════════════════════════════════════════════════════ */
export function AthleteMessagesThreadMobile() {
  const conversationId = useDynamicParam("id");
  const [convType, setConvType] = useState<"loading" | "GROUP" | "ADMIN_USER" | "OTHER">("loading");
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("conversations").select("conversation_type").eq("id", conversationId).maybeSingle();
        const t = data?.conversation_type;
        if (!cancelled) setConvType(t === "GROUP" ? "GROUP" : t === "ADMIN_USER" ? "ADMIN_USER" : "OTHER");
      } catch {
        if (!cancelled) setConvType("OTHER");
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  if (convType === "loading") {
    return (
      <div className="h-full bg-[#111317] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (convType === "GROUP") return <AthleteGroupThreadMobile />;
  if (convType === "ADMIN_USER") return <NexusThreadMobile id={conversationId} backHref="/athlete/messages" />;
  return <AthleteCoachThreadMobile />;
}

function AthleteCoachThreadMobile() {
  const router = useRouter();
  const conversationId = useDynamicParam("id");
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const { data: messages = [], isLoading: msgsLoading } = useMessages(conversationId);
  const sendMut = useSendMessage();

  const [coach, setCoach] = useState<CoachHeader | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  // Coach context (header) — inline fetch.
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("conversations")
          .select("coach_id, recruiter_id, conversation_type, coach:users!coach_id(id, first_name, last_name, photo_url, avatar_url, schools!school_id(name))")
          .eq("id", conversationId)
          .maybeSingle();
        // Counterparty : coach (ATHLETE_COACH) or recruiter (RECRUTEUR_ATHLETE).
        // Recruiter fetched separately (a 2nd `users` embed clashes on the FK).
        const isRA = (data as Record<string, unknown> | null)?.conversation_type === "RECRUTEUR_ATHLETE";
        let co: Record<string, unknown> | null = null;
        let sch: { name?: string } | null = null;
        if (isRA) {
          const { data: rec } = await supabase
            .from("users")
            .select("id, first_name, last_name, photo_url, avatar_url, school_id")
            .eq("id", (data as Record<string, unknown>).recruiter_id as string)
            .maybeSingle();
          co = (rec as Record<string, unknown>) || null;
          if (co?.school_id) {
            const { data: s } = await supabase.from("schools").select("name").eq("id", co.school_id as string).maybeSingle();
            sch = (s as { name?: string }) || null;
          }
        } else {
          const raw = (data as Record<string, unknown> | null)?.coach;
          co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
          const schRaw = co?.schools;
          sch = (Array.isArray(schRaw) ? schRaw[0] : schRaw) as { name?: string } | null;
        }
        const cid = (co?.id as string) || "";
        const cf = (co?.first_name as string) || "";
        const cl = (co?.last_name as string) || "";
        // Role label : recruiter → "Recruteur" ; coach → coach/director.
        let role = isRA ? "Recruteur" : "Entraîneur";
        if (!isRA && cid) {
          const { data: sc } = await supabase.from("school_coaches").select("role").eq("coach_id", cid).limit(1).maybeSingle();
          role = roleLabel((sc?.role as string) || undefined);
        }
        if (!cancelled) {
          setCoach({
            name: `${cf} ${cl}`.trim() || role,
            initials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase() || "?",
            photoUrl: (co?.photo_url as string) || (co?.avatar_url as string) || null,
            role, school: sch?.name || "",
          });
        }
      } catch (err) {
        console.error("[AthleteThread] ctx load failed:", err);
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Mark read au mount via le RPC (SECURITY DEFINER).
  const markedRef = useRef(false);
  useEffect(() => {
    if (!conversationId || markedRef.current) return;
    markedRef.current = true;
    (async () => {
      try {
        const supabase = createClient();
        await supabase.rpc("mark_conversation_read", { p_conv: conversationId });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      } catch { /* best-effort */ }
    })();
  }, [conversationId, queryClient]);

  // Realtime : inserts live + re-mark-read sur message entrant.
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const newMsg = payload.new as MessageRow;
        const queryKey = ["messages", conversationId];
        queryClient.setQueryData<MessageRow[]>(queryKey, (old) => {
          if (!old) return [newMsg];
          if (old.some((m) => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
        if (newMsg.sender_id !== userId) {
          supabase.rpc("mark_conversation_read", { p_conv: conversationId }).then(() => {});
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, userId, queryClient]);

  const handleSend = (content: string) => {
    if (!conversationId) return;
    sendMut.mutate({ conversationId, content }, {
      /* Cote ATHLETE du meme fil RECRUTEUR_ATHLETE : le trigger bloque
         l'insertion quel que soit l'expediteur, l'athlete se prenait donc
         « Verifie ta connexion » lui aussi. */
      onError: (error: unknown) => toast.error(
        isBlackoutError(error)
          ? { message: "Envoi impossible", detail: blackoutMessageFiche(null) }
          : { message: "Erreur d'envoi", detail: "Vérifie ta connexion" },
      ),
    });
  };

  const headerCenter = (
    <div className="flex flex-col items-center gap-0.5 min-w-0 max-w-full">
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
        <AthletePhoto photoUrl={coach?.photoUrl ?? null} firstName={coach?.initials?.[0] ?? "C"} lastName={coach?.initials?.[1] ?? ""} size={36} />
      </div>
      <span className="text-[16px] font-bold text-white truncate max-w-full">{coach?.name ?? "—"}</span>
      {(coach?.role || coach?.school) && (
        <span className="text-[12px] text-white/55 truncate max-w-full">
          {coach?.role}{coach?.school ? ` · ${coach.school}` : ""}
        </span>
      )}
    </div>
  );

  return (
    <MessageThreadShell<MessageRow>
      messages={messages}
      isLoading={ctxLoading || msgsLoading}
      currentUserId={userId}
      getId={(m) => m.id}
      getContent={(m) => m.content}
      getCreatedAt={(m) => m.created_at}
      getSenderId={(m) => m.sender_id}
      getStatus={(m) => m.status}
      getRetracted={(m) => !!m.retracted_at}
      meColor="#0A84FF"
      otherColor="#262628"
      headerCenter={headerCenter}
      onBack={() => router.push("/athlete/messages")}
      composerPlaceholder="Message…"
      onSend={handleSend}
      emptyTitle="Démarre la conversation"
      emptyDescription={`Pose ta question à ${coach?.name ?? "ton entraîneur"}.`}
    />
  );
}
