"use client";

import {  useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useDynamicParam } from "@/lib/platform/useDynamicParam";
import { createClient } from "@/lib/supabase/client";
import CoachInfoCard from "@/components/recruteur/CoachInfoCard";
import AthleteInfoCard from "@/components/recruteur/AthleteInfoCard";
import FeatureGate from "@/components/subscription/FeatureGate";
import { RecruteurMessagesThreadMobile } from "@/components/shared/RecruteurMessagesThreadMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

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

const STATUS_CONFIG: Record<string, { label: string; bg: string; textColor: string }> = {
  ACTIVE: { label: "Actif", bg: "bg-[#22C55E]/15", textColor: "text-[#22C55E]" },
  ARCHIVE: { label: "Archivé", bg: "bg-[#374151]/30", textColor: "text-[#6B7280]" } };

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

export default function Page() {
  // Iter 7.8b — mobile early return wrappé dans FeatureGate (ceinture+bretelles).
  if (IS_CAPACITOR) {
    return (
      <FeatureGate feature="messaging" requiredTier="pro">
        <RecruteurMessagesThreadMobile />
      </FeatureGate>
    );
  }
  return (
    <FeatureGate feature="messaging" requiredTier="pro">
      <RecruiterThreadPage />
    </FeatureGate>
  );
}

function RecruiterThreadPage() {
  const id = useDynamicParam("id");
  const [ctx, setCtx] = useState<ThreadContext | null>(null);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reply, setReply] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
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
        setCtx(athleteData);
      }

      // Load messages
      const { data: msgData } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

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
          <CoachInfoCard
            coachId={ctx.coachId}
            coachName={ctx.coachName}
            coachInitials={ctx.coachInitials}
            coachAvatarUrl={ctx.coachAvatarUrl || undefined}
            coachSchool={ctx.coachSchool || undefined}
            coachRegion={ctx.coachRegion || undefined}
            coachEmail={ctx.coachEmail || undefined}
            coachPhone={ctx.coachPhone || undefined}
            athleteId={ctx.athleteId}
            athleteName={ctx.athleteName}
          />

          {/* ── Athlete card ──────────────────────────────── */}
          <AthleteInfoCard
            athleteId={ctx.athleteId}
            athleteName={ctx.athleteName}
            athleteInitials={ctx.athleteInitials}
            athletePhotoUrl={ctx.athletePhotoUrl || undefined}
            athleteJersey={ctx.athleteJersey || undefined}
            athleteSport={ctx.athleteSport || undefined}
            athletePosition={ctx.athletePosition || undefined}
            athleteGradYear={ctx.athleteGradYear}
            athleteVerified={ctx.athleteVerified}
            athleteStars={ctx.athleteStars}
            athleteSchool={ctx.athleteSchool || undefined}
            athleteRegion={ctx.athleteRegion || undefined}
            athleteRecruitmentStatus={ctx.athleteRecruitmentStatus}
            athleteCommittedSchool={ctx.athleteCommittedSchool || undefined}
            athleteOpenToOffers={ctx.athleteOpenToOffers}
            athleteGpa={ctx.athleteGpa}
            athleteProgrammes={ctx.athleteProgrammes}
            athleteOpenRelocate={ctx.athleteOpenRelocate}
            athleteOpenPrivate={ctx.athleteOpenPrivate}
            athleteOpenAnglophone={ctx.athleteOpenAnglophone}
            athleteDistinctions={ctx.athleteDistinctions}
          />
        </div>
      </div>

    </div>
  );
}
