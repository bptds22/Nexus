"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getRecruiterThread, RECRUITER_STATUS_CONFIG, type RecruiterMessage, type RecruiterThreadStatus } from "../../_data/mockMessages";
import EntityLink from "@/components/shared/EntityLink";
import { REVIEW_WIDGET_STATES, SUBMITTED_REVIEWS } from "@/lib/mock/reviewWidget";
import ReviewWidgetTeaser from "@/components/review/ReviewWidgetTeaser";
import ReviewWidgetForm from "@/components/review/ReviewWidgetForm";
import ReviewWidgetConfirmation from "@/components/review/ReviewWidgetConfirmation";
import StarRating from "@/components/ui/StarRating";

/* ═══════════════════════════════════════════════════════════════
   Thread Detail — Recruiter side
   2-column: conversation left, context cards right
   Layout mirrors coach/demandes/[id] with roles flipped.
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

function StatusBadge({ status }: { status: RecruiterThreadStatus }) {
  const cfg = RECRUITER_STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  );
}

/* ── Message Bubble ────────────────────────────────────────── */

function MessageBubble({ msg, coachName }: { msg: RecruiterMessage; coachName?: string }) {
  const isRecruiter = msg.sender === "recruiter";

  return (
    <div className={`flex flex-col ${isRecruiter ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">
        {isRecruiter ? "Vous" : coachName} · {relativeTime(msg.timestamp)}
      </p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
        isRecruiter
          ? "bg-[#1E3A5F] rounded-br-md"
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

/* ── Review widget state machine ──────────────────────────── */
type WidgetView = "hidden" | "teaser" | "form" | "confirmation";

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function RecruiterThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const thread = getRecruiterThread(id);

  const [messages, setMessages] = useState<RecruiterMessage[]>(thread?.messages ?? []);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState<RecruiterThreadStatus>(thread?.status ?? "envoye");
  const endRef = useRef<HTMLDivElement>(null);

  // Review widget state
  const widgetState = REVIEW_WIDGET_STATES[id];
  const submittedReview = SUBMITTED_REVIEWS[id];
  const initialView: WidgetView =
    widgetState?.reviewSubmitted && submittedReview ? "confirmation" :
    widgetState?.showWidget ? "teaser" :
    "hidden";
  const [widgetView, setWidgetView] = useState<WidgetView>(initialView);
  const [dismissCount, setDismissCount] = useState(widgetState?.dismissCount ?? 0);
  const [submittedScore, setSubmittedScore] = useState(submittedReview?.overallScore ?? 0);
  const [submittedRecommend, setSubmittedRecommend] = useState(submittedReview?.wouldRecommend ?? true);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!thread) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <p className="text-[14px] text-[#9CA3AF]">Conversation introuvable.</p>
        <Link href="/recruteur/messages" className="text-[13px] text-[#3B82F6] hover:underline mt-2 inline-block">Retour aux messages</Link>
      </div>
    );
  }

  const c = thread.coach;
  const a = thread.athlete;
  const coachFullName = `Coach ${c.lastName}`;

  function handleSend() {
    if (!reply.trim()) return;
    const newMsg: RecruiterMessage = {
      id: `rm-new-${Date.now()}`,
      sender: "recruiter",
      text: reply.trim(),
      timestamp: NOW.toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setReply("");
    if (status === "reponse_recue") {
      setStatus("envoye");
    }
  }

  function handleDismiss() {
    const next = dismissCount + 1;
    setDismissCount(next);
    setWidgetView("hidden");
  }

  function handleSubmit(data: {
    profileQuality: number;
    responsiveness: number;
    evaluationHonesty: number;
    professionalism: number;
    wouldRecommend: boolean;
    comment: string;
  }) {
    const avg = (data.profileQuality + data.responsiveness + data.evaluationHonesty + data.professionalism) / 4;
    setSubmittedScore(Math.round(avg * 10) / 10);
    setSubmittedRecommend(data.wouldRecommend);
    setWidgetView("confirmation");
  }

  // Group messages by day for separators
  const messageGroups: { date: string; msgs: RecruiterMessage[] }[] = [];
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
            <Link href="/recruteur/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Retour
            </Link>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-white truncate">
                <EntityLink type="coach" id={c.id} name={`${c.firstName} ${c.lastName}`} portal="recruiter" className="text-[14px]" />
                {" "}— à propos de{" "}
                <EntityLink type="athlete" id={a.id} name={`${a.firstName} ${a.lastName}`} portal="recruiter" className="text-[14px]" />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={status} />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RecruiterThreadStatus)}
              aria-label="Changer le statut"
              className="bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-1.5 text-[12px] text-[#9CA3AF] focus:border-[#3B82F6] outline-none cursor-pointer"
            >
              <option value="reponse_recue">Réponse reçue</option>
              <option value="envoye">Envoyé</option>
              <option value="lu">Lu</option>
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
                    <MessageBubble key={msg.id} msg={msg} coachName={`${c.firstName} ${c.lastName}`} />
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* ── Review widget (between messages and composer) ── */}
          {widgetView === "teaser" && (
            <ReviewWidgetTeaser
              coachName={coachFullName}
              coachId={c.id}
              onExpand={() => setWidgetView("form")}
              onDismiss={handleDismiss}
            />
          )}
          {widgetView === "form" && (
            <ReviewWidgetForm
              coachName={coachFullName}
              coachId={c.id}
              athleteName={`${a.firstName} ${a.lastName}`}
              athletePosition={a.position}
              onSubmit={handleSubmit}
              onDismiss={handleDismiss}
            />
          )}
          {widgetView === "confirmation" && (
            <ReviewWidgetConfirmation
              coachName={coachFullName}
              coachId={c.id}
              overallScore={submittedScore}
              wouldRecommend={submittedRecommend}
            />
          )}

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
                aria-label="Envoyer"
                className="shrink-0 w-11 h-11 rounded-xl bg-[#3B82F6] flex items-center justify-center text-white
                  transition-all hover:bg-[#3B82F6] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#3B82F6]"
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

          {/* ── Coach card ── */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Coach</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[14px] font-bold text-[#9CA3AF]">{c.firstName[0]}{c.lastName[0]}</span>
              </div>
              <div>
                <EntityLink
                  type="coach"
                  id={c.id}
                  name={`${c.firstName} ${c.lastName}`}
                  portal="recruiter"
                  className="text-[15px]"
                />
                <p className="text-[12px] text-[#9CA3AF]">{c.title}</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <path d="M9 22V12h6v10" />
                </svg>
                <span className="text-[#e0e0e0]">{c.school}</span>
              </div>
              <div className="flex items-center gap-2">
                {c.division && (
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                    c.division === "Div. 1" ? "bg-[#3B82F6]/15 text-[#3B82F6]" : "bg-[#4B5563]/15 text-[#9CA3AF]"
                  }`}>
                    {c.division}
                  </span>
                )}
                <span className="text-[#6b7280]">{c.sport}</span>
              </div>
              <p className="text-[12px] text-[#6b7280]">{c.region}</p>
            </div>

            {/* Contact info */}
            <div className="mt-3 pt-3 border-t border-[#2D3748] space-y-2">
              <a href={`mailto:${c.email}`} className="flex items-center gap-2 group/link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{c.email}</span>
              </a>
              <a href={`tel:${c.phone}`} className="flex items-center gap-2 group/link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{c.phone}</span>
              </a>
            </div>

            {/* Action link */}
            <div className="mt-3 pt-3 border-t border-[#2D3748]">
              <Link href={`/recruteur/coach/${c.id}`} className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">
                Voir le profil →
              </Link>
            </div>
          </div>

          {/* ── Athlete card ── */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Athlète concerné</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#6b7280]">{a.firstName[0]}{a.lastName[0]}</span>
              </div>
              <div>
                <EntityLink
                  type="athlete"
                  id={a.id}
                  name={`${a.firstName} ${a.lastName}`}
                  portal="recruiter"
                  className="text-[14px]"
                />
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-[#6b7280] font-bold uppercase">{a.position}</span>
                  {a.gradYear && <span className="text-[11px] text-[#6b7280]">Promotion {a.gradYear}</span>}
                </div>
              </div>
            </div>

            {/* Badges */}
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
              {a.jerseyNumber && (
                <span className="inline-flex items-center gap-1 bg-[#E63946]/15 text-[#E63946] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  #{a.jerseyNumber}
                </span>
              )}
            </div>

            {/* Stars */}
            <div className="mb-3">
              <StarRating rating={a.stars} size="sm" />
            </div>

            {/* School */}
            {a.school && (
              <p className="text-[12px] text-[#6b7280] mb-3">{a.school}</p>
            )}

            {/* Action link */}
            <div className="pt-3 border-t border-[#2D3748]">
              <Link href={`/recruteur/athletes/${a.id}`} className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">
                Voir le profil →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
