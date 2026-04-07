"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import CoachReviewModal from "@/components/ui/CoachReviewModal";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Thread Detail — Recruiter side
   Wired to Supabase: conversations + messages
═══════════════════════════════════════════════════════════════ */

interface MessageData {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ThreadContext {
  conversationId: string;
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachSchool: string;
  coachRegion: string;
  coachEmail: string;
  coachPhone: string;
  athleteId: string;
  athleteName: string;
  athleteInitials: string;
  athletePosition: string;
  athleteSport: string;
  athleteVerified: boolean;
  athleteStars: number;
  athleteSchool: string;
  athleteRegion: string;
  athleteGradYear: number;
  athleteJersey: string;
  athleteRecruitmentStatus: string;
  athleteCommittedSchool: string;
  athleteOpenToOffers: boolean | null;
  athleteGpa: number;
  athleteProgramme: string;
  athleteOpenRelocate: boolean;
  athleteOpenPrivate: boolean;
  athleteOpenAnglophone: boolean;
  athleteDistinctions: string[];
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; textColor: string }> = {
  ACTIVE: { label: "Actif", bg: "bg-[#22C55E]/15", textColor: "text-[#22C55E]" },
  ARCHIVE: { label: "Archivé", bg: "bg-[#374151]/30", textColor: "text-[#6B7280]" },
};

function relativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) {
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return dayNames[d.getDay()];
  }
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function formatDay(isoStr: string): string {
  const d = new Date(isoStr);
  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
  return <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>{cfg.label}</span>;
}

function MessageBubble({ msg, isMe, coachName }: { msg: MessageData; isMe: boolean; coachName: string }) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
      <p className="text-[11px] text-[#6b7280] mb-1.5">{isMe ? "Vous" : coachName} · {relativeTime(msg.createdAt)}</p>
      <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${isMe ? "bg-[#1E3A5F] rounded-br-md" : "bg-[#1E293B] rounded-bl-md"}`}>
        <p className="text-[14px] text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      </div>
    </div>
  );
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

export default function RecruiterThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [ctx, setCtx] = useState<ThreadContext | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reply, setReply] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [coachAvgRating, setCoachAvgRating] = useState<number | null>(null);
  const [coachReviewCount, setCoachReviewCount] = useState(0);
  const [hasMyReview, setHasMyReview] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // Load conversation with joins
      const { data: conv, error } = await supabase
        .from("conversations")
        .select(`
          id, status, recruiter_id, coach_id, athlete_id, created_at,
          coach:users!coach_id(id, first_name, last_name, schools!school_id(name, region)),
          athlete:athletes!athlete_id(
            id, first_name, last_name, verified, cote_globale_entraineur,
            annee_diplomation, numero_jersey, recruitment_status, committed_school_id, open_to_offers,
            moyenne_generale, programme_cegep_vise, pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region),
            committed_school:schools!committed_school_id(name),
            evaluations(distinctions)
          )
        `)
        .eq("id", id)
        .single();

      if (conv) {
        const coachRaw = conv.coach;
        const coach = (Array.isArray(coachRaw) ? coachRaw[0] : coachRaw) as Record<string, unknown> | null;
        const coachSchoolRaw = coach?.schools;
        const coachSchool = (Array.isArray(coachSchoolRaw) ? coachSchoolRaw[0] : coachSchoolRaw) as { name?: string; region?: string } | null;
        const athleteRaw = conv.athlete;
        const athlete = (Array.isArray(athleteRaw) ? athleteRaw[0] : athleteRaw) as Record<string, unknown> | null;
        const posRaw = athlete?.positions;
        const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { abreviation?: string } | null;
        const athSchoolRaw = athlete?.schools;
        const athSchool = (Array.isArray(athSchoolRaw) ? athSchoolRaw[0] : athSchoolRaw) as { name?: string; region?: string } | null;
        const sportRaw = athlete?.sports;
        const sport = (Array.isArray(sportRaw) ? sportRaw[0] : sportRaw) as { nom?: string } | null;
        const committedSchoolRaw = athlete?.committed_school;
        const committedSchool = (Array.isArray(committedSchoolRaw) ? committedSchoolRaw[0] : committedSchoolRaw) as { name?: string } | null;
        const evalRaw = athlete?.evaluations;
        const eval0 = (Array.isArray(evalRaw) ? evalRaw[0] : evalRaw) as { distinctions?: string[] } | null;
        const distinctions = (eval0?.distinctions || []).filter((d): d is string => d != null && d !== "");

        const cf = (coach?.first_name as string) || "";
        const cl = (coach?.last_name as string) || "";
        const af = (athlete?.first_name as string) || "";
        const al = (athlete?.last_name as string) || "";

        setCtx({
          conversationId: conv.id,
          coachId: (coach?.id as string) || "",
          coachName: `${cf} ${cl}`.trim(),
          coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase(),
          coachSchool: coachSchool?.name || "",
          coachRegion: coachSchool?.region || "",
          coachEmail: "",
          coachPhone: "",
          athleteId: (athlete?.id as string) || "",
          athleteName: `${af} ${al}`.trim(),
          athleteInitials: `${af[0] || ""}${al[0] || ""}`.toUpperCase(),
          athletePosition: pos?.abreviation || "",
          athleteSport: sport?.nom || "",
          athleteVerified: !!(athlete?.verified),
          athleteStars: (athlete?.cote_globale_entraineur as number) || 0,
          athleteSchool: athSchool?.name || "",
          athleteRegion: athSchool?.region || "",
          athleteGradYear: (athlete?.annee_diplomation as number) || 0,
          athleteJersey: athlete?.numero_jersey ? String(athlete.numero_jersey) : "",
          athleteRecruitmentStatus: (athlete?.recruitment_status as string) || "OUVERT",
          athleteCommittedSchool: committedSchool?.name || "",
          athleteOpenToOffers: (athlete?.open_to_offers as boolean | null) ?? null,
          athleteGpa: (athlete?.moyenne_generale as number) || 0,
          athleteProgramme: (athlete?.programme_cegep_vise as string) || "",
          athleteOpenRelocate: !!(athlete?.pret_changer_region),
          athleteOpenPrivate: !!(athlete?.ouvert_cegep_prive),
          athleteOpenAnglophone: !!(athlete?.ouvert_cegep_anglophone),
          athleteDistinctions: distinctions,
          status: (conv.status as string) || "ACTIVE",
        });
      }

      // Load coach review stats
      if (conv) {
        const coachIdVal = (conv.coach_id as string) || "";
        const { data: reviewStats } = await supabase
          .from("coach_reviews")
          .select("note_globale, recruiter_id")
          .eq("coach_id", coachIdVal);
        if (reviewStats && reviewStats.length > 0) {
          const avg = reviewStats.reduce((s: number, r: { note_globale: number }) => s + Number(r.note_globale), 0) / reviewStats.length;
          setCoachAvgRating(Math.round(avg * 10) / 10);
          setCoachReviewCount(reviewStats.length);
          setHasMyReview(reviewStats.some((r: { recruiter_id: string }) => r.recruiter_id === user.id));
        }
      }

      // Load messages
      const { data: msgData } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      console.log("[Thread data]", { conversation: conv, messageCount: msgData?.length });

      if (msgData) {
        setMessages(msgData.map(m => ({
          id: m.id,
          senderId: m.sender_id,
          content: m.content,
          createdAt: m.created_at,
        })));
      }

      // Mark as read
      await supabase.from("conversations").update({ unread_count: 0 }).eq("id", id);

      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!reply.trim() || !ctx) return;
    const supabase = createClient();
    const { data: newMsg } = await supabase
      .from("messages")
      .insert({ conversation_id: ctx.conversationId, sender_id: userId, content: reply.trim() })
      .select("id, sender_id, content, created_at")
      .single();

    if (newMsg) {
      setMessages(prev => [...prev, { id: newMsg.id, senderId: newMsg.sender_id, content: newMsg.content, createdAt: newMsg.created_at }]);
      await supabase.from("conversations").update({ last_message_at: newMsg.created_at, updated_at: new Date().toISOString() }).eq("id", ctx.conversationId);
      console.log("[Message sent]", { newMsg });
    }
    setReply("");
  }

  if (loading) return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;

  if (!ctx) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
        <p className="text-[14px] text-[#9CA3AF]">Conversation introuvable.</p>
        <Link href="/recruteur/messages" className="text-[13px] text-[#3B82F6] hover:underline mt-2 inline-block">Retour aux messages</Link>
      </div>
    );
  }

  // Group messages by day
  const messageGroups: { date: string; msgs: MessageData[] }[] = [];
  messages.forEach(msg => {
    const dk = new Date(msg.createdAt).toISOString().split("T")[0];
    const last = messageGroups[messageGroups.length - 1];
    if (last && new Date(last.date).toISOString().split("T")[0] === dk) {
      last.msgs.push(msg);
    } else {
      messageGroups.push({ date: msg.createdAt, msgs: [msg] });
    }
  });

  return (
    <div className="min-h-screen bg-[#111317] flex flex-col">
      {/* Header */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/recruteur/messages" className="text-[13px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5 shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
              Retour
            </Link>
            <p className="text-[14px] font-bold text-white truncate">
              {ctx.coachName} — à propos de {ctx.athleteName}
            </p>
          </div>
          <StatusBadge status={ctx.status} />
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex-1 max-w-[1280px] mx-auto w-full flex flex-col xl:flex-row gap-0 xl:gap-6 px-6 py-6">

        {/* Messages Column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {messageGroups.map((group, gi) => (
              <div key={gi}>
                <DaySeparator date={group.date} />
                <div className="space-y-4">
                  {group.msgs.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} isMe={msg.senderId === userId} coachName={ctx.coachName} />
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
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Écrire une réponse..."
                rows={2}
                className="flex-1 bg-[#111317] border border-[#2D3748] rounded-xl px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#3B82F6] outline-none transition-colors resize-none"
              />
              <button type="button" onClick={handleSend} disabled={!reply.trim()} aria-label="Envoyer" className="shrink-0 w-11 h-11 rounded-xl bg-[#3B82F6] flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4d56] mt-2">Ctrl + Entrée pour envoyer</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="xl:w-[340px] shrink-0 space-y-4 mt-6 xl:mt-0">
          {/* Coach card */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Coach</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[14px] font-bold text-[#9CA3AF]">{ctx.coachInitials}</span>
              </div>
              <div>
                <span className="text-[15px] font-bold text-white">{ctx.coachName}</span>
                <p className="text-[12px] text-[#9CA3AF]">{ctx.coachSchool}</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px]">
              {ctx.coachRegion && <p className="text-[12px] text-[#6b7280]">{ctx.coachRegion}</p>}
            </div>
            {(ctx.coachEmail || ctx.coachPhone) && (
              <div className="mt-3 pt-3 border-t border-[#2D3748] space-y-2">
                {ctx.coachEmail && (
                  <a href={`mailto:${ctx.coachEmail}`} className="flex items-center gap-2 group/link">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>
                    <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{ctx.coachEmail}</span>
                  </a>
                )}
                {ctx.coachPhone && (
                  <a href={`tel:${ctx.coachPhone}`} className="flex items-center gap-2 group/link">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                    <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{ctx.coachPhone}</span>
                  </a>
                )}
              </div>
            )}
            {/* Coach rating + review button */}
            <div className="mt-3 pt-3 border-t border-[#2D3748]">
              {coachAvgRating !== null ? (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={coachAvgRating >= i + 1 ? "#F59E0B" : "#4a4d56"} stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-[14px] font-bold text-white">{coachAvgRating}/5</span>
                  <span className="text-[11px] text-[#6b7280]">({coachReviewCount} avis)</span>
                </div>
              ) : (
                <p className="text-[11px] text-[#6b7280] italic mb-3">Aucun avis</p>
              )}
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[#F59E0B] text-[#F59E0B] text-[13px] font-bold rounded-lg hover:bg-[#F59E0B]/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                {hasMyReview ? "Modifier mon avis" : "Laisser un avis"}
              </button>
            </div>
          </div>

          {/* Athlete card */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Athlète concerné</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#6b7280]">{ctx.athleteInitials}</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-white">{ctx.athleteName}</span>
                  {ctx.athleteJersey && <span className="text-[12px] font-black text-[#E63946]">#{ctx.athleteJersey}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {ctx.athletePosition && <span className="text-[11px] text-[#6b7280] font-bold uppercase">{ctx.athletePosition}</span>}
                  {ctx.athleteSport && <span className="text-[11px] text-[#6b7280]">{ctx.athleteSport}</span>}
                  {ctx.athleteGradYear > 0 && <span className="text-[11px] text-[#6b7280]">· {ctx.athleteGradYear}</span>}
                </div>
              </div>
            </div>

            {/* Recruitment status — prominent */}
            <div className="mb-3">
              <RecruitmentStatusBadge
                status={ctx.athleteRecruitmentStatus as GlobalRecruitmentStatus}
                committedSchoolName={ctx.athleteCommittedSchool || undefined}
                openToOffers={ctx.athleteOpenToOffers}
                size="md"
              />
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {ctx.athleteVerified && (
                <span className="inline-flex items-center gap-1 bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                  Vérifié
                </span>
              )}
            </div>

            <StarRating rating={ctx.athleteStars} size="sm" />
            {ctx.athleteSchool && <p className="text-[12px] text-[#6b7280] mt-2">{ctx.athleteSchool} · {ctx.athleteRegion}</p>}

            {/* Academic */}
            {(ctx.athleteGpa > 0 || ctx.athleteProgramme) && (
              <div className="mt-3 pt-3 border-t border-[#2D3748] space-y-1.5">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Académique</p>
                {ctx.athleteGpa > 0 && <p className="text-[14px] font-bold text-white">{ctx.athleteGpa}%</p>}
                {ctx.athleteProgramme && <p className="text-[12px] text-[#9CA3AF]">{ctx.athleteProgramme}</p>}
                {ctx.athleteGradYear > 0 && <p className="text-[12px] text-[#6b7280]">Graduation: Juin {ctx.athleteGradYear}</p>}
              </div>
            )}

            {/* Distinctions */}
            {ctx.athleteDistinctions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#2D3748]">
                <div className="flex flex-wrap gap-1.5">
                  {ctx.athleteDistinctions.map(d => {
                    const labels: Record<string, string> = { captain: "Capitaine", allstar: "Équipe d'étoiles", team_leader: "Leader", mvp: "MVP" };
                    return (
                      <span key={d} className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] font-bold text-[#E63946]">
                        {labels[d] || d}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preferences */}
            {(ctx.athleteOpenRelocate || ctx.athleteOpenPrivate || ctx.athleteOpenAnglophone) && (
              <div className="mt-3 pt-3 border-t border-[#2D3748] space-y-1.5">
                {ctx.athleteOpenRelocate && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-[11px] text-[#22C55E]">Ouvert à déménager</span>
                  </div>
                )}
                {ctx.athleteOpenPrivate && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-[11px] text-[#22C55E]">Ouvert au privé</span>
                  </div>
                )}
                {ctx.athleteOpenAnglophone && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <span className="text-[11px] text-[#22C55E]">Ouvert anglophone</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 mt-3 border-t border-[#2D3748]">
              <Link href={`/recruteur/athletes/${ctx.athleteId}`} className="text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors">Voir le profil →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Coach review modal */}
      {showReviewModal && ctx && (
        <CoachReviewModal
          coachId={ctx.coachId}
          coachName={ctx.coachName}
          athleteId={ctx.athleteId}
          athleteName={ctx.athleteName}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            const { data: reviewStats } = await supabase
              .from("coach_reviews")
              .select("note_globale, recruiter_id")
              .eq("coach_id", ctx.coachId);
            if (reviewStats && reviewStats.length > 0) {
              const avg = reviewStats.reduce((s: number, r: { note_globale: number }) => s + Number(r.note_globale), 0) / reviewStats.length;
              setCoachAvgRating(Math.round(avg * 10) / 10);
              setCoachReviewCount(reviewStats.length);
              setHasMyReview(reviewStats.some((r: { recruiter_id: string }) => r.recruiter_id === user?.id));
            }
          }}
        />
      )}
    </div>
  );
}
