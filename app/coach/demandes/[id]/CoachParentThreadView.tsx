"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import RetractedMessageRow from "@/components/messaging/RetractedMessageRow";

/* ═══════════════════════════════════════════════════════════════
   CoachParentThreadView — coach side of a PARENT_COACH thread.
   Direct 2-party conversation ; the parent is the counterparty, the
   header names the child it is about. No à-propos sidebar (simple
   participant header, per the P2 spec). Content immutable → mark-read
   via mark_conversation_read.
═══════════════════════════════════════════════════════════════ */

interface MessageData { id: string; senderId: string; content: string; createdAt: string; retracted: boolean; }

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function MessageBubble({ msg, isMe, otherName }: { msg: MessageData; isMe: boolean; otherName: string }) {
  if (msg.retracted) return <RetractedMessageRow text={msg.content} />;
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">{isMe ? "Vous" : otherName} · {relativeTime(msg.createdAt)}</p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#0A84FF] rounded-br-md" : "bg-[#262628] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
}

export default function CoachParentThreadView({ id }: { id: string }) {
  const [parent, setParent] = useState<{ name: string; initials: string; childName: string } | null>(null);
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
          .select("id, parent_id, parent:users!parent_id(first_name, last_name), child:athletes!athlete_id(first_name, last_name)")
          .eq("id", id)
          .maybeSingle();
        if (!conv) { setNotFoundState(true); setLoading(false); return; }

        const pRaw = (conv as Record<string, unknown>).parent;
        const p = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as Record<string, unknown> | null;
        const chRaw = (conv as Record<string, unknown>).child;
        const ch = (Array.isArray(chRaw) ? chRaw[0] : chRaw) as Record<string, unknown> | null;
        const pf = (p?.first_name as string) || "";
        const pl = (p?.last_name as string) || "";
        setParent({
          name: `${pf} ${pl}`.trim() || "Parent",
          initials: `${pf[0] || ""}${pl[0] || ""}`.toUpperCase() || "P",
          childName: `${(ch?.first_name as string) || ""} ${(ch?.last_name as string) || ""}`.trim() || "l'athlète",
        });

        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_id, content, created_at, retracted_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true });
        setMessages((msgs ?? []).map((m) => ({
          id: m.id as string, senderId: m.sender_id as string, content: (m.content as string) || "",
          createdAt: m.created_at as string, retracted: !!m.retracted_at,
        })));

        await supabase.rpc("mark_conversation_read", { p_conv: id });
      } catch (err) {
        console.error("[CoachParentThread] load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
      console.error("[CoachParentThread] send failed:", err);
    }
  }

  if (loading) return <div className="min-h-screen bg-[#111317] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" /></div>;
  if (notFoundState || !parent) {
    return (
      <div className="min-h-screen bg-[#111317] flex flex-col items-center justify-center gap-4">
        <p className="text-[#9CA3AF] text-[14px]">Conversation introuvable</p>
        <Link href="/coach/demandes" className="text-[#E63946] text-[14px] font-bold hover:text-[#ff4d5a]">Retour aux demandes</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      {/* Header */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[900px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/coach/demandes" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
            Retour
          </Link>
          <div className="w-9 h-9 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0"><span className="text-[12px] font-bold text-[#E63946]">{parent.initials}</span></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-white truncate">{parent.name}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] shrink-0">Parent</span>
            </div>
            <p className="text-[12px] text-[#6b7280] truncate">À propos de {parent.childName}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 max-w-[900px] mx-auto w-full flex flex-col px-6 py-6">
        <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {messages.length === 0 ? (
            <p className="text-center text-[13px] text-[#6b7280] py-10">Écris ton premier message à {parent.name}.</p>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} msg={m} isMe={m.senderId === meId} otherName={parent.name} />)
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
            <button type="button" onClick={handleSend} disabled={!reply.trim()} className="shrink-0 w-11 h-11 rounded-xl bg-[#E63946] flex items-center justify-center text-white transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
            </button>
          </div>
          <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
        </div>
      </div>
    </div>
  );
}
