"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getThread, MOCK_THREADS, STATUS_CONFIG, type Message, type ThreadStatus } from "../_data/mockThreadsData";
import EntityLink from "@/components/shared/EntityLink";

/* ═══════════════════════════════════════════════════════════════
   Thread Detail — Conversation View
   2-column: messages left, context cards right.
═══════════════════════════════════════════════════════════════ */

const NOW = new Date("2026-03-10T10:00:00");

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const diffMs = NOW.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return dayNames[d.getDay()];
  }
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  return d.toLocaleDateString("fr-CA", opts);
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

/* ── Status Badge ──────────────────────────────────────────── */

function StatusBadge({ status }: { status: ThreadStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  );
}

/* ── Message Bubble ────────────────────────────────────────── */

function MessageBubble({ msg, recruiterName }: { msg: Message; recruiterName?: string }) {
  const isCoach = msg.sender === "coach";

  return (
    <div className={`flex flex-col ${isCoach ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">
        {isCoach ? "Vous" : recruiterName} · {relativeTime(msg.timestamp)}
      </p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
        isCoach
          ? "bg-[#14532D] rounded-br-md"
          : "bg-[#1E293B] rounded-bl-md"
      }`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.text}</p>
      </div>
    </div>
  );
}

/* ── Day Separator ─────────────────────────────────────────── */

function DaySeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]/50" />
      <span className="text-[11px] text-[#6b7280] font-medium capitalize">{formatDay(date)}</span>
      <div className="flex-1 h-px bg-[#2D3748]/50" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const thread = getThread(id) || MOCK_THREADS[0];
  const r = thread.recruiter;
  const a = thread.athlete;

  const [messages, setMessages] = useState<Message[]>(thread.messages);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<ThreadStatus>(thread.status);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!reply.trim()) return;
    const newMsg: Message = {
      id: `m-new-${Date.now()}`,
      sender: "coach",
      text: reply.trim(),
      timestamp: NOW.toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setReply("");
    if (status === "reponse_recue") {
      setStatus("envoye");
    }
  }

  // Group messages by day for separators
  const messageGroups: { date: string; msgs: Message[] }[] = [];
  messages.forEach((msg) => {
    const dk = getDateKey(msg.timestamp);
    const last = messageGroups[messageGroups.length - 1];
    if (last && last.date === dk) {
      last.msgs.push(msg);
    } else {
      messageGroups.push({ date: msg.timestamp, msgs: [msg] });
    }
  });

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/coach/demandes" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Retour
            </Link>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white truncate">
                <EntityLink type="recruiter" id={r.id} name={`${r.firstName} ${r.lastName}`} portal="coach" className="text-[14px]" />
                {" "}— à propos de{" "}
                <EntityLink type="athlete" id={a.id} name={`${a.firstName} ${a.lastName}`} portal="coach" className="text-[14px]" />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={status} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ThreadStatus)}
              className="bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-1.5 text-[12px] text-[#9CA3AF] focus:border-[#E63946] outline-none cursor-pointer"
            >
              <option value="reponse_recue">Réponse reçue</option>
              <option value="envoye">Envoyé</option>
              <option value="archive">Archivé</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 2-Column Layout ─────────────────────────────────── */}
      <div className="flex-1 max-w-[1280px] mx-auto w-full flex flex-col xl:flex-row gap-0 xl:gap-6 px-6 py-6">

        {/* ── Messages Column ───────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                <DaySeparator date={group.date} />
                <div className="space-y-4">
                  {group.msgs.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} recruiterName={`${r.firstName} ${r.lastName}`} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Reply composer */}
          <div className="bg-[#1A1D24] border-t border-[#2D3748] p-4 rounded-b-xl">
            <div className="flex items-end gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Écrire une réponse..."
                rows={2}
                className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#3B82F6] outline-none transition-colors resize-none"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!reply.trim()}
                className="shrink-0 w-11 h-11 rounded-xl bg-[#E63946] flex items-center justify-center text-white
                  transition-all hover:bg-[#D42B22] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#E63946]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
          </div>
        </div>

        {/* ── Sidebar: Context Cards ────────────────────────── */}
        <div className="xl:w-[320px] shrink-0 space-y-4 mt-6 xl:mt-0">

          {/* Recruiter card */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Recruteur</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[14px] font-bold text-[#9CA3AF]">{r.firstName[0]}{r.lastName[0]}</span>
              </div>
              <div>
                <EntityLink
                  type="recruiter"
                  id={r.id}
                  name={`${r.firstName} ${r.lastName}`}
                  portal="coach"
                  className="text-[15px]"
                />
                <p className="text-[12px] text-[#9CA3AF]">{r.title}</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <path d="M9 22V12h6v10" />
                </svg>
                <span className="text-[#e0e0e0]">{r.cegep}</span>
                {r.cegepTeamName && <span className="text-[#6b7280]">({r.cegepTeamName})</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                  r.division === "Div. 1" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#4B5563]/15 text-[#9CA3AF]"
                }`}>
                  {r.division}
                </span>
                <span className="text-[#6b7280]">{r.sport}</span>
              </div>
              <p className="text-[12px] text-[#6b7280]">{r.region}</p>
            </div>

            {/* Contact info */}
            <div className="mt-3 pt-3 border-t border-[#2D3748] space-y-2">
              <a href={`mailto:${r.email}`} className="flex items-center gap-2 group/link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{r.email}</span>
              </a>
              <a href={`tel:${r.phone}`} className="flex items-center gap-2 group/link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{r.phone}</span>
              </a>
            </div>
          </div>

          {/* Athlete context card */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Athlète concerné</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#6b7280]">{a.firstName[0]}{a.lastName[0]}</span>
              </div>
              <div>
                <Link href={`/coach/athletes/${a.id}/apercu`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors">
                  {a.firstName} {a.lastName}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#6b7280] font-bold uppercase">{a.position}</span>
                  <span className="text-[11px] text-[#6b7280]">{a.niveau}</span>
                </div>
              </div>
            </div>

            {/* Badges — binary verification */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {a.isVerified ? (
                <span className="inline-flex items-center gap-1 bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  Vérifié
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-[#6B7280]/15 text-[#6B7280] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  Non vérifié
                </span>
              )}
              {a.favorites > 0 && (
                <span className="inline-flex items-center gap-1 bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  {a.favorites}
                </span>
              )}
            </div>

            {/* Views */}
            {a.views > 0 && (
              <p className="text-[11px] text-[#6b7280] mb-3">{a.views} vues ce mois</p>
            )}

            {/* Profile percent */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1 rounded-full bg-[#2D3748] overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${a.profilePercent}%`,
                  backgroundColor: a.isVerified ? "#3B82F6" : "#6B7280",
                }} />
              </div>
              <span className="text-[11px] font-bold text-[#9CA3AF]">{a.profilePercent}%</span>
            </div>

            {/* Missing fields hint */}
            {a.missingFields && a.missingFields.length > 0 && (
              <p className="text-[10px] text-[#9CA3AF] mb-3">Manque: {a.missingFields.join(", ")}</p>
            )}

            {/* Action links */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#2D3748]">
              <Link href={`/coach/athletes/${a.id}/apercu`} className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">
                Voir le profil →
              </Link>
              <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[11px] font-bold text-[#6b7280] hover:text-white transition-colors flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Modifier
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
