"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { useGroupThreadMeta } from "@/lib/queries/shared/useGroupThread";

/* ═══════════════════════════════════════════════════════════════
   CoachGroupThreadView — côté STAFF (coach/directeur) d'un fil de
   GROUPE (conversation_type='GROUP'). Rendu par le routeur de thread
   coach quand la conversation est un groupe. Multi-parties → CHAQUE
   message porte l'identité de son expéditeur.

   Visibilité : la RLS renvoie TOUT au staff (annonces + réponses
   privées de chaque athlète). On ne re-filtre pas côté client.
   Étiquetage (par le rôle de l'expéditeur, équivalent à messages.audience) :
     • expéditeur STAFF  (audience 'ALL')  → annonce, pas de tag ;
     • expéditeur ATHLETE (audience 'STAFF') → réponse privée →
       « Réponse de {athlète} — visible staff seulement ».
   Envoi staff → INSERT messages (le trigger estampille 'ALL').
   Accent groupe : indigo #6366F1. Rétraction → ligne système.
═══════════════════════════════════════════════════════════════ */

interface GroupMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  retracted: boolean;
  audience: "ALL" | "STAFF";
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
  if (days < 7) { const n = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]; return n[d.getDay()]; }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
function getDateKey(isoStr: string): string { return new Date(isoStr).toISOString().split("T")[0]; }

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]/50" />
      <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(date)}</span>
      <div className="flex-1 h-px bg-[#2D3748]/50" />
    </div>
  );
}

function GroupBubble({ msg, isMe, senderName, isAthleteReply }: {
  msg: GroupMessage; isMe: boolean; senderName: string; isAthleteReply: boolean;
}) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">
        {isMe ? "Vous" : senderName} · {relativeTime(msg.createdAt)}
      </p>
      {isAthleteReply && !isMe && (
        <div className="flex items-center gap-1.5 mb-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] font-semibold text-[#F59E0B]">
            Réponse de {senderName} — visible staff seulement
          </span>
        </div>
      )}
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
        isMe
          ? "bg-[#4338CA] rounded-br-md"
          : isAthleteReply
            ? "bg-[#3B2E12] border border-[#F59E0B]/25 rounded-bl-md"
            : "bg-[#1E293B] rounded-bl-md"
      }`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function CoachGroupThreadView({ id }: { id: string }) {
  const { data: meta, isLoading: metaLoading } = useGroupThreadMeta(id, "STAFF");
  const meId = meta?.meId ?? null;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reply, setReply] = useState("");
  const [msgsLoading, setMsgsLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at, retracted_at, audience")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        setMessages((msgs ?? []).map((m) => ({
          id: m.id as string,
          senderId: m.sender_id as string,
          content: (m.content as string) || "",
          createdAt: m.created_at as string,
          retracted: !!m.retracted_at,
          audience: ((m.audience as string) === "STAFF" ? "STAFF" : "ALL") as "ALL" | "STAFF",
        })));
      } catch (err) {
        console.error("[CoachGroupThread] load failed:", err);
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // Mark-read : met à jour SA ligne participant (policy group_participants_update_read).
  useEffect(() => {
    if (!meId) return;
    const supabase = createClient();
    supabase.from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id).eq("user_id", meId)
      .then(() => {});
  }, [id, meId, messages.length]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !meId) return;
    const body = reply.trim();
    setReply("");
    const optimistic: GroupMessage = { id: `tmp-${Date.now()}`, senderId: meId, content: body, createdAt: new Date().toISOString(), retracted: false, audience: "ALL" };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const supabase = createClient();
      const { data: inserted } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: meId, content: body })
        .select("id, sender_id, content, created_at, retracted_at, audience")
        .single();
      if (inserted) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? {
          id: inserted.id as string, senderId: inserted.sender_id as string, content: inserted.content as string,
          createdAt: inserted.created_at as string, retracted: false,
          audience: ((inserted.audience as string) === "STAFF" ? "STAFF" : "ALL") as "ALL" | "STAFF",
        } : m));
      }
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    } catch (err) {
      console.error("[CoachGroupThread] send failed:", err);
    }
  }

  const groups = useMemo(() => {
    const out: { date: string; msgs: GroupMessage[] }[] = [];
    messages.forEach((m) => {
      const dk = getDateKey(m.createdAt);
      const last = out[out.length - 1];
      if (last && getDateKey(last.date) === dk) last.msgs.push(m);
      else out.push({ date: m.createdAt, msgs: [m] });
    });
    return out;
  }, [messages]);

  const loading = metaLoading || msgsLoading;
  if (loading) {
    return <div className="min-h-screen bg-[#111317] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (meta?.notFound) {
    return (
      <div className="min-h-screen bg-[#111317] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Conversation introuvable</p>
        <Link href="/coach/demandes" className="text-[#E63946] text-[14px] font-bold hover:text-[#ff4d5a]">Retour aux messages</Link>
      </div>
    );
  }

  const isTeam = meta?.groupScope === "TEAM";

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/coach/demandes" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <p className="text-[14px] font-bold text-white truncate">{meta?.groupName || "Groupe"}</p>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#818CF8]">
            {isTeam ? "Équipe" : "Staff"}
          </span>
          {(meta?.memberCount ?? 0) > 0 && (
            <span className="text-[12px] text-[#6b7280] truncate hidden sm:inline">· {meta?.memberCount} membres</span>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-[1280px] mx-auto w-full flex flex-col px-6 py-6">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {messages.length === 0 ? (
              <p className="text-center text-[13px] text-[#6b7280] py-10">Aucun message pour l&apos;instant.</p>
            ) : (
              groups.map((g, gi) => (
                <div key={gi}>
                  <DaySeparator date={g.date} />
                  <div className="space-y-4">
                    {g.msgs.map((m) => {
                      const isMe = m.senderId === meId;
                      const isAthleteReply = meta?.roles?.[m.senderId] === "ATHLETE" || m.audience === "STAFF";
                      return (
                        <GroupBubble
                          key={m.id}
                          msg={m}
                          isMe={isMe}
                          senderName={meta?.names?.[m.senderId] || "Membre"}
                          isAthleteReply={isAthleteReply}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
            <div className="flex items-end gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Écrire une annonce au groupe..."
                rows={2}
                className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#6366F1] outline-none transition-colors resize-none"
              />
              <button type="button" onClick={handleSend} disabled={!reply.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-[#6366F1] flex items-center justify-center text-white transition-all hover:bg-[#4f46e5] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#6366F1]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4d56] mt-2">
              {isTeam ? "Ton message est visible par tout le groupe · Ctrl + Entrée pour envoyer" : "Ctrl + Entrée pour envoyer"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
