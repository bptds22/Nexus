"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";
import { useGroupThreadMeta } from "@/lib/queries/shared/useGroupThread";

/* ═══════════════════════════════════════════════════════════════
   AthleteGroupThreadView — côté ATHLÈTE d'un fil de GROUPE (TEAM).
   Rendu par le routeur de thread athlète quand conversation_type='GROUP'.

   Visibilité : la RLS ne renvoie à l'athlète que les annonces staff
   (audience='ALL') + SES propres réponses — JAMAIS la réponse privée
   d'un coéquipier. On ne re-filtre pas côté client. Multi-parties →
   chaque message montre l'identité de son expéditeur (staff) ; les
   siens sont « Vous ».

   Envoi : INSERT messages (le trigger DB estampille audience='STAFF' =
   réponse privée aux entraîneurs). Le champ de saisie porte la mention
   discrète « Ta réponse ne sera visible que par les entraîneurs ».
   Registre immuable côté athlète → mark-read via update de SA ligne
   participant.last_read_at (policy group_participants_update_read).
═══════════════════════════════════════════════════════════════ */

interface GroupMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  retracted: boolean;
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

function GroupBubble({ msg, isMe, senderName }: { msg: GroupMessage; isMe: boolean; senderName: string }) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">
        {isMe ? "Vous" : senderName} · {relativeTime(msg.createdAt)}
      </p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#14532D] rounded-br-md" : "bg-[#1E293B] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function AthleteGroupThreadView({ id }: { id: string }) {
  const { data: meta, isLoading: metaLoading } = useGroupThreadMeta(id, "ATHLETE");
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
        // La RLS filtre déjà (annonces 'ALL' + envois de l'athlète) — pas de re-filtre client.
        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at, retracted_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        setMessages((msgs ?? []).map((m) => ({
          id: m.id as string,
          senderId: m.sender_id as string,
          content: (m.content as string) || "",
          createdAt: m.created_at as string,
          retracted: !!m.retracted_at,
        })));
      } catch (err) {
        console.error("[AthleteGroupThread] load failed:", err);
      } finally {
        if (!cancelled) setMsgsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // Mark-read : SA ligne participant (l'athlète n'a aucune policy UPDATE sur messages).
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
    const optimistic: GroupMessage = { id: `tmp-${Date.now()}`, senderId: meId, content: body, createdAt: new Date().toISOString(), retracted: false };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const supabase = createClient();
      // Le trigger DB estampille audience='STAFF' (réponse privée aux entraîneurs).
      const { data: inserted } = await supabase
        .from("messages")
        .insert({ conversation_id: id, sender_id: meId, content: body })
        .select("id, sender_id, content, created_at, retracted_at")
        .single();
      if (inserted) {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? {
          id: inserted.id as string, senderId: inserted.sender_id as string, content: inserted.content as string,
          createdAt: inserted.created_at as string, retracted: false,
        } : m));
      }
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", id);
    } catch (err) {
      console.error("[AthleteGroupThread] send failed:", err);
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
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (meta?.notFound) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Conversation introuvable</p>
        <Link href="/athlete/messages" className="text-[#E63946] text-[14px] font-bold hover:text-[#ff4d5a]">Retour aux messages</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/athlete/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <div className="w-9 h-9 rounded-full bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-white truncate">{meta?.groupName || "Groupe"}</p>
            <p className="text-[12px] text-[#6b7280] truncate">Groupe d&apos;équipe{(meta?.memberCount ?? 0) > 0 ? ` · ${meta?.memberCount} membres` : ""}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-[900px] mx-auto w-full flex flex-col px-6 py-6">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {messages.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b7280] py-10">Aucun message pour l&apos;instant.</p>
          ) : (
            groups.map((g, gi) => (
              <div key={gi}>
                <DaySeparator date={g.date} />
                <div className="space-y-4">
                  {g.msgs.map((m) => (
                    <GroupBubble key={m.id} msg={m} isMe={m.senderId === meId} senderName={meta?.names?.[m.senderId] || "Entraîneur"} />
                  ))}
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
              placeholder="Écrire une réponse..."
              rows={2}
              className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#22C55E] outline-none transition-colors resize-none"
            />
            <button type="button" onClick={handleSend} disabled={!reply.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-[#E63946] flex items-center justify-center text-white transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#E63946]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </div>
          <p className="text-[10px] text-[#4a4d56] mt-2 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Ta réponse ne sera visible que par les entraîneurs · Ctrl + Entrée pour envoyer
          </p>
        </div>
      </div>
    </div>
  );
}
