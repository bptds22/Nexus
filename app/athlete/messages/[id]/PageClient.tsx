"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { AthleteMessagesThreadMobile } from "@/components/shared/AthleteMessagesThreadMobile";
import AthleteGroupThreadView from "./AthleteGroupThreadView";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Athlete ↔ Coach Thread (athlete side). 2-party ; the coach/director
   is the counterparty. Content immutable + no delete → mark-read via
   the mark_conversation_read RPC (never a direct messages UPDATE).
═══════════════════════════════════════════════════════════════ */

interface MessageData {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  retracted: boolean;
}

interface CoachInfo {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  role: string;
  school: string;
}

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const names = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return names[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getDateKey(isoStr: string): string {
  return new Date(isoStr).toISOString().split("T")[0];
}

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]/50" />
      <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(date)}</span>
      <div className="flex-1 h-px bg-[#2D3748]/50" />
    </div>
  );
}

function MessageBubble({ msg, isMe, otherName }: { msg: MessageData; isMe: boolean; otherName: string }) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">{isMe ? "Vous" : otherName} · {relativeTime(msg.createdAt)}</p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#14532D] rounded-br-md" : "bg-[#1E293B] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function Page() {
  if (IS_CAPACITOR) return <AthleteMessagesThreadMobile />;
  return <AthleteThreadRouter />;
}

/* Route par conversation_type : GROUP → fil de groupe (multi-parties) ;
   sinon → le fil 2-party existant (ATHLETE_COACH / RECRUTEUR_ATHLETE). */
function AthleteThreadRouter() {
  const id = useDynamicParam("id");
  const [convType, setConvType] = useState<"loading" | "GROUP" | "OTHER">("loading");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("conversations").select("conversation_type").eq("id", id).maybeSingle();
        if (!cancelled) setConvType(data?.conversation_type === "GROUP" ? "GROUP" : "OTHER");
      } catch {
        if (!cancelled) setConvType("OTHER");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (convType === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (convType === "GROUP") return <AthleteGroupThreadView id={id} />;
  return <AthleteThreadPage />;
}

function AthleteThreadPage() {
  const id = useDynamicParam("id");
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setMeId(user.id);

        const { data: conv } = await supabase
          .from("conversations")
          .select("id, coach_id, recruiter_id, conversation_type, coach:users!coach_id(id, first_name, last_name, photo_url, avatar_url, schools!school_id(name))")
          .eq("id", id)
          .maybeSingle();

        if (!conv) { setNotFoundState(true); setLoading(false); return; }

        // Counterparty : coach (ATHLETE_COACH) or recruiter (RECRUTEUR_ATHLETE).
        // The recruiter is fetched separately (a second `users` embed alongside
        // the coach one triggers PostgREST FK ambiguity).
        const isRA = (conv as Record<string, unknown>).conversation_type === "RECRUTEUR_ATHLETE";
        let co: Record<string, unknown> | null = null;
        let school: { name?: string } | null = null;
        let counterId = "";
        if (isRA) {
          const { data: rec } = await supabase
            .from("users")
            .select("id, first_name, last_name, photo_url, avatar_url, school_id")
            .eq("id", (conv as Record<string, unknown>).recruiter_id as string)
            .maybeSingle();
          co = (rec as Record<string, unknown>) || null;
          counterId = (co?.id as string) || "";
          if (co?.school_id) {
            const { data: s } = await supabase.from("schools").select("name").eq("id", co.school_id as string).maybeSingle();
            school = (s as { name?: string }) || null;
          }
        } else {
          const raw = (conv as Record<string, unknown>).coach;
          co = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null;
          const schoolRaw = co?.schools;
          school = (Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw) as { name?: string } | null;
          counterId = (co?.id as string) || (conv.coach_id as string) || "";
        }
        const cf = (co?.first_name as string) || "";
        const cl = (co?.last_name as string) || "";
        const coachId = counterId;

        // Role label : recruiter → "Recruteur" ; coach → coach/director.
        let role = isRA ? "Recruteur" : "Entraîneur";
        if (!isRA && coachId) {
          const { data: sc } = await supabase.from("school_coaches").select("role").eq("coach_id", coachId);
          if ((sc ?? []).some((r) => (r.role as string).startsWith("DIRECTEUR"))) role = "Directeur sportif";
        }

        setCoach({
          id: coachId,
          name: `${cf} ${cl}`.trim() || role,
          initials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase() || "?",
          photoUrl: (co?.photo_url as string) || (co?.avatar_url as string) || null,
          role,
          school: school?.name || "",
        });

        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at, retracted_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });

        setMessages((msgs ?? []).map((m) => ({
          id: m.id as string,
          senderId: m.sender_id as string,
          content: (m.content as string) || "",
          createdAt: m.created_at as string,
          retracted: !!m.retracted_at,
        })));

        // Mark read via RPC (content immutable → no direct UPDATE).
        await supabase.rpc("mark_conversation_read", { p_conv: id });
      } catch (err) {
        console.error("[AthleteThread] load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !meId) return;
    const body = reply.trim();
    setReply("");
    const optimistic: MessageData = { id: `tmp-${Date.now()}`, senderId: meId, content: body, createdAt: new Date().toISOString(), retracted: false };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const supabase = createClient();
      const { data: inserted } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: meId, content: body })
        .select("id, sender_id, content, created_at, retracted_at")
        .single();
      if (inserted) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? {
          id: inserted.id as string, senderId: inserted.sender_id as string, content: inserted.content as string, createdAt: inserted.created_at as string, retracted: false,
        } : m));
      }
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    } catch (err) {
      console.error("[AthleteThread] send failed:", err);
    }
  }

  const groups: { date: string; msgs: MessageData[] }[] = [];
  messages.forEach((m) => {
    const dk = getDateKey(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && getDateKey(last.date) === dk) last.msgs.push(m);
    else groups.push({ date: m.createdAt, msgs: [m] });
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFoundState || !coach) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Conversation introuvable</p>
        <Link href="/athlete/messages" className="text-[#E63946] text-[14px] font-bold hover:text-[#ff4d5a]">Retour aux messages</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/athlete/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          {coach.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coach.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-[#9CA3AF]">{coach.initials}</span></div>
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white truncate">{coach.name}</p>
            <p className="text-[12px] text-[#6b7280] truncate">{coach.role}{coach.school ? ` · ${coach.school}` : ""}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-[900px] mx-auto w-full flex flex-col px-6 py-6">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {messages.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b7280] py-10">Écris ton premier message à {coach.name}.</p>
          ) : (
            groups.map((g, gi) => (
              <div key={gi}>
                <DaySeparator date={g.date} />
                <div className="space-y-4">
                  {g.msgs.map((m) => <MessageBubble key={m.id} msg={m} isMe={m.senderId === meId} otherName={coach.name} />)}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
          <div className="flex items-end gap-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Écrire un message..."
              rows={2}
              className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#22C55E] outline-none transition-colors resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!reply.trim()}
              className="shrink-0 w-11 h-11 rounded-xl bg-[#E63946] flex items-center justify-center text-white transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#E63946]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </div>
          <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
        </div>
      </div>
    </div>
  );
}
