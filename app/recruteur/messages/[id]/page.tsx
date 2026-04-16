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
  coachAvatarUrl: string;
  coachSchool: string;
  coachRegion: string;
  coachEmail: string;
  coachPhone: string;
  athleteId: string;
  athleteName: string;
  athleteInitials: string;
  athletePhotoUrl: string;
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
  athleteProgrammes: string[];
  athleteOpenRelocate: boolean;
  athleteOpenPrivate: boolean;
  athleteOpenAnglophone: boolean;
  athleteDistinctions: string[];
  status: string;
}

interface CoachReputation {
  count: number;
  avgNote: number;
  recommendCount: number;
  avgQualite: number;
  avgReactivite: number;
  avgHonnetete: number;
  avgProf: number;
}

interface CoachBadgeRow {
  badge: string;
}

const BADGE_STYLES: Record<string, { label: string; bg: string; border: string; fg: string }> = {
  RECOMMANDE:  { label: "Recommandé",   bg: "bg-[#22C55E]/15", border: "border-[#22C55E]/30", fg: "text-[#22C55E]" },
  COACH_ELITE: { label: "Coach élite",  bg: "bg-[#F59E0B]/15", border: "border-[#F59E0B]/30", fg: "text-[#F59E0B]" },
  PLACEUR:     { label: "Placeur",      bg: "bg-[#E63946]/15", border: "border-[#E63946]/30", fg: "text-[#E63946]" },
  EVALUE:      { label: "Évalué",       bg: "bg-[#3B82F6]/15", border: "border-[#3B82F6]/30", fg: "text-[#3B82F6]" },
};

function formatResponseTime(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}j`;
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = value >= i + 1;
        const partial = !filled && value > i && value < i + 1;
        return (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : partial ? "url(#half)" : "#4a4d56"} stroke="none">
            {partial && (
              <defs>
                <linearGradient id="half">
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#4a4d56" />
                </linearGradient>
              </defs>
            )}
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
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
  const [coachReputation, setCoachReputation] = useState<CoachReputation | null>(null);
  const [coachBadges, setCoachBadges] = useState<CoachBadgeRow[]>([]);
  const [coachPlacedCount, setCoachPlacedCount] = useState(0);
  const [coachVerifiedCount, setCoachVerifiedCount] = useState(0);
  const [coachAvgResponseHours, setCoachAvgResponseHours] = useState<number | null>(null);
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
          coach:users!coach_id(id, first_name, last_name, avatar_url, email, phone, schools!school_id(name, region)),
          athlete:athletes!athlete_id(
            id, first_name, last_name, photo_url, verified, cote_globale_entraineur,
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
        const rawDistinctions: unknown[] = Array.isArray(eval0?.distinctions) ? eval0!.distinctions as unknown[] : [];
        const distinctions: string[] = rawDistinctions
          .map((d) => (typeof d === "string" ? d : (d && typeof d === "object" ? ((d as { code?: string; id?: string }).code || (d as { code?: string; id?: string }).id || "") : "")))
          .filter((d): d is string => typeof d === "string" && d !== "");
        console.log('Athlete distinctions:', distinctions);

        const cf = (coach?.first_name as string) || "";
        const cl = (coach?.last_name as string) || "";
        const af = (athlete?.first_name as string) || "";
        const al = (athlete?.last_name as string) || "";

        // Normalize programme_cegep_vise JSONB: accept array of strings or legacy scalar
        const rawProg: unknown = athlete?.programme_cegep_vise;
        const programmes: string[] = Array.isArray(rawProg)
          ? (rawProg as unknown[]).filter((p): p is string => typeof p === "string" && p !== "")
          : (typeof rawProg === "string" && rawProg !== "" ? [rawProg] : []);

        const athleteData = {
          conversationId: conv.id,
          coachId: (coach?.id as string) || "",
          coachName: `${cf} ${cl}`.trim(),
          coachInitials: `${cf[0] || ""}${cl[0] || ""}`.toUpperCase(),
          coachAvatarUrl: (coach?.avatar_url as string) || "",
          coachSchool: coachSchool?.name || "",
          coachRegion: coachSchool?.region || "",
          coachEmail: (coach?.email as string) || "",
          coachPhone: (coach?.phone as string) || "",
          athleteId: (athlete?.id as string) || "",
          athleteName: `${af} ${al}`.trim(),
          athleteInitials: `${af[0] || ""}${al[0] || ""}`.toUpperCase(),
          athletePhotoUrl: (athlete?.photo_url as string) || "",
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
          athleteProgrammes: programmes,
          athleteOpenRelocate: !!(athlete?.pret_changer_region),
          athleteOpenPrivate: !!(athlete?.ouvert_cegep_prive),
          athleteOpenAnglophone: !!(athlete?.ouvert_cegep_anglophone),
          athleteDistinctions: distinctions,
          status: (conv.status as string) || "ACTIVE",
        };
        console.log('Athlete card data:', athleteData);
        setCtx(athleteData);
      }

      // Load coach reputation + badges + placement stats + response time
      if (conv) {
        const coachIdVal = (conv.coach_id as string) || "";

        // Reviews breakdown
        const { data: reviews } = await supabase
          .from("coach_reviews")
          .select("note_globale, recommande, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, recruiter_id")
          .eq("coach_id", coachIdVal);

        let reputation: CoachReputation | null = null;
        if (reviews && reviews.length > 0) {
          const rows = reviews as Array<Record<string, unknown>>;
          const n = rows.length;
          const avgOf = (key: string) =>
            rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n;
          reputation = {
            count: n,
            avgNote: Math.round(avgOf("note_globale") * 10) / 10,
            recommendCount: rows.filter((r) => r.recommande === true).length,
            avgQualite: Math.round(avgOf("qualite_profils") * 10) / 10,
            avgReactivite: Math.round(avgOf("reactivite") * 10) / 10,
            avgHonnetete: Math.round(avgOf("honnetete_evaluations") * 10) / 10,
            avgProf: Math.round(avgOf("professionnalisme") * 10) / 10,
          };
          setCoachReputation(reputation);
          setHasMyReview(rows.some((r) => (r.recruiter_id as string) === user.id));
        } else {
          setCoachReputation(null);
          setHasMyReview(false);
        }

        // Badges
        const { data: badgeRows } = await supabase
          .from("coach_badges")
          .select("badge")
          .eq("coach_id", coachIdVal);
        const badges: CoachBadgeRow[] = (badgeRows || []).map((b) => ({ badge: b.badge as string }));
        setCoachBadges(badges);

        // Placement stats
        const { data: coachAthletes } = await supabase
          .from("athletes")
          .select("verified, recruitment_status")
          .eq("coach_id", coachIdVal);
        const placed = (coachAthletes || []).filter((a) => a.recruitment_status === "RECRUTE").length;
        const verified = (coachAthletes || []).filter((a) => a.verified === true).length;
        setCoachPlacedCount(placed);
        setCoachVerifiedCount(verified);

        // Average response time (client-side from coach's conversations)
        const { data: coachConvs } = await supabase
          .from("conversations")
          .select("id")
          .eq("coach_id", coachIdVal);

        let avgHours: number | null = null;
        if (coachConvs && coachConvs.length > 0) {
          const convIds = coachConvs.map((c) => c.id as string);
          const { data: allMsgs } = await supabase
            .from("messages")
            .select("conversation_id, sender_id, created_at")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: true });

          if (allMsgs && allMsgs.length > 0) {
            const byConv = new Map<string, typeof allMsgs>();
            allMsgs.forEach((m) => {
              const cid = m.conversation_id as string;
              if (!byConv.has(cid)) byConv.set(cid, []);
              byConv.get(cid)!.push(m);
            });
            const diffs: number[] = [];
            byConv.forEach((msgs) => {
              for (let i = 1; i < msgs.length; i++) {
                const cur = msgs[i];
                const prev = msgs[i - 1];
                if ((cur.sender_id as string) === coachIdVal && (prev.sender_id as string) !== coachIdVal) {
                  const diffMs = new Date(cur.created_at as string).getTime() - new Date(prev.created_at as string).getTime();
                  diffs.push(diffMs / (1000 * 60 * 60));
                }
              }
            });
            if (diffs.length > 0) {
              avgHours = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            }
          }
        }
        setCoachAvgResponseHours(avgHours);

        console.log('Coach reputation data:', { reviewCount: reputation?.count ?? 0, avgNote: reputation?.avgNote ?? null, badges: badges.map((b) => b.badge) });
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
          {/* ── Coach card ─────────────────────────────── */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]/60 p-6">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[#E63946] mb-4">Coach</p>

            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              {ctx.coachAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ctx.coachAvatarUrl} alt={ctx.coachName} className="w-14 h-14 rounded-full object-cover shrink-0 border border-white/10" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#2a2d36] flex items-center justify-center shrink-0">
                  <span className="text-[16px] font-bold text-white">{ctx.coachInitials}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-white truncate">{ctx.coachName}</p>
                <p className="text-[12px] text-[#9CA3AF] truncate">
                  {ctx.coachSchool}{ctx.coachSchool && ctx.coachRegion ? " · " : ""}{ctx.coachRegion}
                </p>
              </div>
            </div>

            {/* Contact */}
            {(ctx.coachEmail || ctx.coachPhone) && (
              <div className="mt-3 space-y-1.5">
                {ctx.coachEmail && (
                  <a href={`mailto:${ctx.coachEmail}`} className="flex items-center gap-2 group/link">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>
                    <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors truncate">{ctx.coachEmail}</span>
                  </a>
                )}
                {ctx.coachPhone && (
                  <a href={`tel:${ctx.coachPhone}`} className="flex items-center gap-2 group/link">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                    <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{ctx.coachPhone}</span>
                  </a>
                )}
              </div>
            )}

            {/* Reputation */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              {coachReputation ? (
                <>
                  <div className="flex items-center gap-2">
                    <StarRow value={coachReputation.avgNote} />
                    <span className="text-[14px] font-bold text-white tabular-nums">{coachReputation.avgNote.toFixed(1)}/5</span>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">Note basée sur {coachReputation.count} avis de recruteurs</p>

                  <div className="mt-4 space-y-2.5">
                    {([
                      ["Qualité des profils", coachReputation.avgQualite],
                      ["Réactivité", coachReputation.avgReactivite],
                      ["Honnêteté des évaluations", coachReputation.avgHonnetete],
                      ["Professionnalisme", coachReputation.avgProf],
                    ] as [string, number][]).map(([label, value]) => (
                      <div key={label}>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-white/75">{label}</span>
                          <span className="text-white font-bold tabular-nums">{value.toFixed(1)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-[#2D3748] overflow-hidden">
                          {/* eslint-disable-next-line react/forbid-dom-props -- width is dynamic from DB */}
                          <div
                            className="h-full rounded-full bg-[#22C55E] w-[var(--bar-w)]"
                            style={{ "--bar-w": `${Math.min(100, Math.max(0, (value / 5) * 100))}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {coachReputation.recommendCount > 0 && (
                    <p className="text-[11px] text-[#22C55E] mt-4">
                      ✓ {coachReputation.recommendCount} {coachReputation.recommendCount === 1 ? "recruteur recommande" : "recruteurs recommandent"} ce coach
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-[13px] text-[#9CA3AF] italic">Aucun avis pour ce coach</p>
                  <p className="text-[11px] text-[#6b7280] mt-1.5 leading-relaxed">
                    Soyez le premier à évaluer la fiabilité de ce coach après votre interaction.
                  </p>
                </div>
              )}
            </div>

            {/* Placement stats */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[16px] font-bold text-white tabular-nums">{coachPlacedCount}</p>
                <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Athlètes placés</p>
              </div>
              <div className="text-center border-l border-white/[0.06]">
                <p className="text-[16px] font-bold text-white tabular-nums">{coachVerifiedCount}</p>
                <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Vérifiés</p>
              </div>
              <div className="text-center border-l border-white/[0.06]">
                <p className="text-[16px] font-bold text-white tabular-nums">{formatResponseTime(coachAvgResponseHours)}</p>
                <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Rép. moy.</p>
              </div>
            </div>

            {/* Badges */}
            {coachBadges.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                {coachBadges.map((b, idx) => {
                  const style = BADGE_STYLES[b.badge] || { label: b.badge, bg: "bg-white/5", border: "border-white/10", fg: "text-[#9CA3AF]" };
                  return (
                    <span
                      key={`${b.badge}-${idx}`}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.border} ${style.fg}`}
                    >
                      {style.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Review CTA */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#F59E0B] text-[#F59E0B] text-[13px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#F59E0B]/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                {hasMyReview ? "Modifier mon avis" : "Laisser un avis"}
              </button>
            </div>
          </div>

          {/* ── Athlete card ──────────────────────────────── */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]/60 p-6">
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[#E63946] mb-4">Athlète concerné</p>

            {/* Photo or initials */}
            <div className="flex justify-center">
              {ctx.athletePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ctx.athletePhotoUrl} alt={ctx.athleteName} className="w-20 h-20 rounded-full object-cover border border-white/10" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#2a2d36] flex items-center justify-center">
                  <span className="text-[24px] font-bold text-white">{ctx.athleteInitials}</span>
                </div>
              )}
            </div>

            {/* Name + jersey */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-[18px] font-bold text-white">{ctx.athleteName}</span>
              {ctx.athleteJersey && <span className="text-[16px] font-black text-[#E63946]">#{ctx.athleteJersey}</span>}
            </div>

            {/* Sport · Position · Promotion */}
            {(ctx.athleteSport || ctx.athletePosition || ctx.athleteGradYear > 0) && (
              <p className="text-[13px] text-[#9CA3AF] text-center mt-1">
                {[ctx.athleteSport, ctx.athletePosition, ctx.athleteGradYear > 0 ? ctx.athleteGradYear : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            {/* Status badges row */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <RecruitmentStatusBadge
                status={ctx.athleteRecruitmentStatus as GlobalRecruitmentStatus}
                committedSchoolName={ctx.athleteCommittedSchool || undefined}
                openToOffers={ctx.athleteOpenToOffers}
                size="sm"
              />
              {ctx.athleteVerified && (
                <span className="inline-flex items-center gap-1 bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                  Vérifié
                </span>
              )}
            </div>

            {/* Star rating */}
            {ctx.athleteStars > 0 && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <StarRating rating={ctx.athleteStars} size="sm" />
                <span className="text-[13px] font-bold text-white tabular-nums">{Number(ctx.athleteStars).toFixed(1)}</span>
              </div>
            )}

            {/* Location */}
            {ctx.athleteSchool && (
              <p className="text-[12px] text-[#6b7280] text-center mt-2">
                {ctx.athleteSchool}{ctx.athleteRegion ? ` · ${ctx.athleteRegion}` : ""}
              </p>
            )}

            {/* Académique */}
            {(ctx.athleteGpa > 0 || ctx.athleteProgrammes.length > 0 || ctx.athleteGradYear > 0) && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Académique</p>
                {ctx.athleteGpa > 0 && (
                  <p className="text-[20px] font-bold text-white mt-1.5 tabular-nums">{ctx.athleteGpa}%</p>
                )}
                {ctx.athleteProgrammes.length > 0 && (
                  <p className="text-[12px] text-[#9CA3AF] mt-1.5">
                    <span className="text-[#6b7280]">Programme visé : </span>
                    {ctx.athleteProgrammes.join(", ")}
                  </p>
                )}
                {ctx.athleteGradYear > 0 && (
                  <p className="text-[12px] text-[#6b7280] mt-1">Graduation : Juin {ctx.athleteGradYear}</p>
                )}
              </div>
            )}

            {/* Distinctions */}
            {ctx.athleteDistinctions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                {ctx.athleteDistinctions.map((d, idx) => {
                  const labels: Record<string, string> = { captain: "Capitaine", allstar: "Équipe d'étoiles", team_leader: "Leader", mvp: "MVP" };
                  return (
                    <span key={`${d}-${idx}`} className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] font-bold text-[#E63946]">
                      {labels[d] || d}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Préférences pills */}
            {(ctx.athleteOpenRelocate || ctx.athleteOpenPrivate || ctx.athleteOpenAnglophone) && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
                {ctx.athleteOpenRelocate && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
                    Ouvert à déménager
                  </span>
                )}
                {ctx.athleteOpenPrivate && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
                    Ouvert au privé
                  </span>
                )}
                {ctx.athleteOpenAnglophone && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
                    Ouvert anglophone
                  </span>
                )}
              </div>
            )}

            {/* Full profile CTA */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <Link
                href={`/recruteur/athletes/${ctx.athleteId}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E63946] text-[#E63946] text-[13px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors"
              >
                Voir le profil complet →
              </Link>
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
            const { data: reviews } = await supabase
              .from("coach_reviews")
              .select("note_globale, recommande, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, recruiter_id")
              .eq("coach_id", ctx.coachId);
            if (reviews && reviews.length > 0) {
              const rows = reviews as Array<Record<string, unknown>>;
              const n = rows.length;
              const avgOf = (key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) / n;
              setCoachReputation({
                count: n,
                avgNote: Math.round(avgOf("note_globale") * 10) / 10,
                recommendCount: rows.filter((r) => r.recommande === true).length,
                avgQualite: Math.round(avgOf("qualite_profils") * 10) / 10,
                avgReactivite: Math.round(avgOf("reactivite") * 10) / 10,
                avgHonnetete: Math.round(avgOf("honnetete_evaluations") * 10) / 10,
                avgProf: Math.round(avgOf("professionnalisme") * 10) / 10,
              });
              setHasMyReview(rows.some((r) => (r.recruiter_id as string) === user?.id));
            } else {
              setCoachReputation(null);
              setHasMyReview(false);
            }
          }}
        />
      )}
    </div>
  );
}
