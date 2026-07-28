"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CoachDemandesThread from "./[id]/PageClient";
import StarRating from "@/components/ui/StarRating";
import { STATUS_CONFIG, mapDbStatus, type ConversationThread, type ThreadStatus } from "./_data/mockThreadsData";
import EntityLink from "@/components/shared/EntityLink";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { CoachDemandesMobile } from "@/components/shared/CoachDemandesMobile";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";
import { MessagesToolbar } from "@/components/shared/messaging/MessagesToolbar";
import {
  STATUS_SORT_PRIORITY,
  matchesStatusPreset,
  mapUrlStatusPreset,
  type StatusPreset,
} from "@/lib/messaging/threadStatus";
import { deriveTypeSegments, matchesTypeSegment } from "@/lib/messaging/typeSegments";
import { loadSenderBroadcastSummaries, type AnnonceSummary } from "@/lib/queries/coach/loadSenderBroadcasts";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Gérer les Demandes — Thread List
   Triage tool for recruiter conversations.
═══════════════════════════════════════════════════════════════ */

const NOW = new Date();

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
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  return d.toLocaleDateString("fr-CA", opts);
}

/* ── Status Badge ──────────────────────────────────────────── */

function StatusBadge({ status }: { status: ThreadStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-3 py-1.5 rounded-full text-[12px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  );
}

/* ── Type Badge (Recruteur / Athlète) ──────────────────────── */

function TypeBadge({ isAthlete }: { isAthlete: boolean }) {
  return isAthlete ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] shrink-0">Athlète</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] shrink-0">Recruteur</span>
  );
}

/* ── Athlete Thread Card (ATHLETE_COACH) — counterparty = athlete ── */

function AthleteThreadCard({ thread: t }: { thread: ConversationThread }) {
  const a = t.athlete;
  const initials = `${a.firstName[0] || ""}${a.lastName[0] || ""}`;
  return (
    <Link
      href={`/coach/demandes?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unread ? "bg-[#1E2430] border-l-[3px] border-l-[#22C55E]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AthletePhoto photoUrl={(a as { photoUrl?: string | null }).photoUrl} firstName={a.firstName} lastName={a.lastName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] truncate ${t.unread ? "text-white font-bold" : "text-[#e0e0e0] font-semibold"}`}>{a.firstName} {a.lastName}</span>
            <TypeBadge isAthlete />
            {a.position && <span className="text-[11px] text-[#6b7280] font-bold uppercase shrink-0 hidden sm:inline">{a.position}</span>}
          </div>
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessagePreview}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${t.unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageTime)}</span>
      </div>
    </Link>
  );
}

/* ── Coach↔Coach Thread Card (COACH_COACH) — counterparty = a coach ── */

function CoachCoachThreadCard({ thread: t, meta }: { thread: ConversationThread; meta?: { isDirector: boolean; athleteName: string } }) {
  const name = t.recruiter.firstName || "Coach"; // full name lives in firstName
  const parts = name.split(" ");
  const initials = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}` || "?";
  const isDir = meta?.isDirector;
  const athleteName = meta?.athleteName;
  return (
    <Link
      href={`/coach/demandes?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unread ? "bg-[#1E2430] border-l-[3px] border-l-[#14B8A6]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-full bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-[#14B8A6]">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] truncate ${t.unread ? "text-white font-bold" : "text-[#e0e0e0] font-semibold"}`}>{name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[#14B8A6]/15 border border-[#14B8A6]/30 text-[#14B8A6]`}>
              {isDir ? "Directeur" : "Coach"}
            </span>
          </div>
          {athleteName && <p className="text-[12px] text-[#6b7280] truncate">Au sujet de {athleteName}</p>}
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessagePreview}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${t.unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageTime)}</span>
      </div>
    </Link>
  );
}

/* ── Parent Thread Card (PARENT_COACH) — counterparty = a parent ── */

function ParentThreadCard({ thread: t, meta }: { thread: ConversationThread; meta?: { parentName: string; childName: string } }) {
  const name = meta?.parentName || t.recruiter.firstName || "Parent";
  const parts = name.split(" ");
  const initials = `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}` || "?";
  return (
    <Link
      href={`/coach/demandes?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unread ? "bg-[#1E2430] border-l-[3px] border-l-[#E63946]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-[#E63946]">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] truncate ${t.unread ? "text-white font-bold" : "text-[#e0e0e0] font-semibold"}`}>{name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946]">Parent</span>
          </div>
          {meta?.childName && <p className="text-[12px] text-[#6b7280] truncate">Parent de {meta.childName}</p>}
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessagePreview}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${t.unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(t.lastMessageTime)}</span>
      </div>
    </Link>
  );
}

/* ── Thread Card (recruiter — unchanged layout + a Recruteur pill) ── */

function ThreadCard({ thread: t }: { thread: ConversationThread }) {
  const r = t.recruiter;
  const a = t.athlete;
  const initials = `${r.firstName[0]}${r.lastName[0]}`;

  return (
    <Link
      href={`/coach/demandes?id=${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unread
          ? "bg-[#1E2430] border-l-[3px] border-l-[#E63946]"
          : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Recruiter avatar + identity */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-[#9CA3AF]">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <EntityLink
              type="recruiter"
              id={r.id}
              name={`${r.firstName} ${r.lastName}`}
              portal="coach"
              nested
              className={`text-[15px] truncate ${t.unread ? "" : "!text-[#e0e0e0]"}`}
            />
            <TypeBadge isAthlete={false} />
            <span className="text-[12px] text-[#6b7280] shrink-0 hidden sm:inline">{r.cegep} · {r.division}</span>
          </div>
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessagePreview}</p>
        </div>
      </div>

      {/* Athlete context */}
      <div className="hidden md:flex items-center gap-2 shrink-0 w-[200px]">
        <AthletePhoto
          photoUrl={(a as { photoUrl?: string | null }).photoUrl}
          firstName={a.firstName}
          lastName={a.lastName}
          size={32}
        />
        <div className="min-w-0">
          <EntityLink
            type="athlete"
            id={a.id}
            name={`${a.firstName} ${a.lastName}`}
            portal="coach"
            nested
            className="text-[13px] !font-semibold !text-[#9CA3AF] truncate"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#6b7280] font-bold uppercase">{a.position}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill={a.isVerified ? "#3B82F6" : "#6B7280"} stroke="none" aria-label={a.isVerified ? "Profil vérifié" : "Profil non vérifié"}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            {a.favorites > 0 && (
              <div className="flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#E63946" stroke="none">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                {a.favorites > 1 && <span className="text-[10px] font-bold text-[#E63946]">{a.favorites}</span>}
              </div>
            )}
            <StarRating rating={a.stars} size="sm" />
          </div>
        </div>
      </div>

      {/* Timestamp + status */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${t.unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>
          {relativeTime(t.lastMessageTime)}
        </span>
        <StatusBadge status={t.status} />
      </div>
    </Link>
  );
}

/* ── Annonce Card (broadcast — REPLACES the N member rows) ────── */

function AnnonceCard({ a }: { a: AnnonceSummary }) {
  const unread = a.unreadReplies > 0;
  return (
    <Link
      href={`/coach/demandes/annonce?id=${a.broadcastId}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        unread ? "bg-[#1E2430] border-l-[3px] border-l-[#8B5CF6]" : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      <div className="w-11 h-11 rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[15px] truncate ${unread ? "text-white font-bold" : "text-[#e0e0e0] font-semibold"}`}>Annonce</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#A78BFA] shrink-0">Diffusion</span>
        </div>
        <p className="text-[12px] text-[#9CA3AF] truncate mt-0.5">{a.targetLabel} · Envoyé à {a.recipientCount}</p>
        {a.content && <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{a.content}</p>}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${unread ? "text-white font-semibold" : "text-[#6b7280]"}`}>{relativeTime(a.lastActivityAt)}</span>
        {a.replyCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-[#8B5CF6]/15 text-[#A78BFA]">
            {a.replyCount} réponse{a.replyCount > 1 ? "s" : ""}
            {unread && <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />}
          </span>
        ) : (
          <span className="text-[11px] text-[#4a4d56]">Aucune réponse</span>
        )}
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function DemandesPage() {
  return (
    <Suspense fallback={null}>
      <DemandesRouter />
    </Suspense>
  );
}

// STRATÉGIE A — query-param routing : ?id=<uuid> → le fil, sinon l'inbox.
function DemandesRouter() {
  const threadId = useSearchParams().get("id");
  if (threadId) return <CoachDemandesThread />;
  return <DemandesDispatch />;
}

function DemandesDispatch() {
  // Phase 2 — mobile early return AVANT le rendu desktop. Comme côté
  // recruteur (cf. /recruteur/messages/page.tsx), la mobile possède
  // son propre flux iOS (MessagesListShell + recruteur-first row).
  // Pas de FeatureGate ici : coach Free CAN messaging (CLAUDE.md +
  // useSubscription.ts can_receive_messages: true sur Free).
  if (IS_CAPACITOR) return <CoachDemandesMobile />;
  return (
    <Suspense>
      <DemandesContent />
    </Suspense>
  );
}

function DemandesContent() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filtre");
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [activeFilter, setActiveFilter] = useState<StatusPreset>(mapUrlStatusPreset(urlFilter));
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [annonces, setAnnonces] = useState<AnnonceSummary[]>([]);
  const [convTypes, setConvTypes] = useState<Record<string, string>>({});
  /** COACH_COACH render meta : is the other party a director + optional attached athlete. */
  const [coachMeta, setCoachMeta] = useState<Record<string, { isDirector: boolean; athleteName: string }>>({});
  /** PARENT_COACH render meta : the linked parent's name + which child. */
  const [parentMeta, setParentMeta] = useState<Record<string, { parentName: string; childName: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadThreads() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        // Fetch conversations for this coach
        const { data: conversations, error: convError } = await supabase
          .from("conversations")
          .select("id, conversation_type, recruiter_id, coach_id, coach_b_id, parent_id, athlete_id, status, last_message_at, unread_count, created_at, athletes!athlete_id(id, first_name, last_name, verified, cote_globale_entraineur, profile_completion, annee_diplomation, photo_url, positions!position_id(nom, abreviation))")
          .or(`coach_id.eq.${user.id},coach_b_id.eq.${user.id}`)
          .order("last_message_at", { ascending: false });

        if (!conversations || conversations.length === 0) {
          setThreads([]);
          setLoading(false);
          return;
        }

        // Get latest message per conversation
        const conversationIds = conversations.map((c: any) => c.id);
        const { data: latestMessages, error: msgError } = await supabase
          .from("messages")
          .select("content, created_at, conversation_id, sender_id")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false });

        // Build maps: latest message + who replied per conversation
        const latestMsgMap: Record<string, { content: string; created_at: string; sender_id: string }> = {};
        const coachRepliedMap: Record<string, boolean> = {};
        const recruiterRepliedMap: Record<string, boolean> = {};
        const sendersByConv: Record<string, Set<string>> = {};
        if (latestMessages) {
          for (const msg of latestMessages as any[]) {
            if (!latestMsgMap[msg.conversation_id]) {
              latestMsgMap[msg.conversation_id] = msg;
            }
            (sendersByConv[msg.conversation_id] ||= new Set()).add(msg.sender_id);
            // Track who has sent messages
            const conv = conversations.find((c: any) => c.id === msg.conversation_id);
            if (conv && msg.sender_id === (conv as any).coach_id) coachRepliedMap[msg.conversation_id] = true;
            if (conv && msg.sender_id === (conv as any).recruiter_id) recruiterRepliedMap[msg.conversation_id] = true;
          }
        }

        // COACH_COACH — resolve the "other coach" (coach_b_id when I'm coach_id)
        // + whether they're a director (label only ; no separate type).
        const otherCoachIds = [...new Set(conversations
          .filter((c: any) => c.conversation_type === "COACH_COACH")
          .map((c: any) => (c.coach_id === user.id ? c.coach_b_id : c.coach_id))
          .filter(Boolean))] as string[];
        const coachInfoMap = new Map<string, { name: string; isDirector: boolean }>();
        if (otherCoachIds.length > 0) {
          const { data: coachUsers } = await supabase.from("users").select("id, first_name, last_name").in("id", otherCoachIds);
          const { data: dirRows } = await supabase.from("school_coaches").select("coach_id, role").in("coach_id", otherCoachIds);
          const directorSet = new Set((dirRows || []).filter((r: any) => r.role === "DIRECTEUR" || r.role === "DIRECTEUR_INTERIM").map((r: any) => r.coach_id));
          for (const u of coachUsers || []) {
            coachInfoMap.set((u as any).id, {
              name: `${(u as any).first_name || ""} ${(u as any).last_name || ""}`.trim() || "Coach",
              isDirector: directorSet.has((u as any).id),
            });
          }
        }

        // PARENT_COACH — resolve the linked parent's name (counterparty).
        const parentIds = [...new Set(conversations
          .filter((c: any) => c.conversation_type === "PARENT_COACH")
          .map((c: any) => c.parent_id)
          .filter(Boolean))] as string[];
        const parentInfoMap = new Map<string, string>();
        if (parentIds.length > 0) {
          const { data: parentUsers } = await supabase.from("users").select("id, first_name, last_name").in("id", parentIds);
          for (const u of parentUsers || []) {
            parentInfoMap.set((u as any).id, `${(u as any).first_name || ""} ${(u as any).last_name || ""}`.trim() || "Parent");
          }
        }

        // Load recruiter info separately (avoids ambiguous FK on users)
        const recruiterIds = [...new Set(conversations.map((c: any) => c.recruiter_id).filter(Boolean))];
        const recruiterMap = new Map<string, { first_name: string; last_name: string; email: string; school_name: string }>();
        if (recruiterIds.length > 0) {
          const { data: recruiters } = await supabase
            .from("users")
            .select("id, first_name, last_name, email, school_id")
            .in("id", recruiterIds);
          // Load school names separately
          const schoolIds = [...new Set((recruiters || []).map((r: any) => r.school_id).filter(Boolean))];
          const schoolNameMap = new Map<string, string>();
          if (schoolIds.length > 0) {
            const { data: schools } = await supabase.from("schools").select("id, name").in("id", schoolIds);
            for (const s of schools || []) schoolNameMap.set(s.id, s.name);
          }
          for (const r of recruiters || []) {
            recruiterMap.set(r.id, {
              first_name: (r.first_name as string) || "",
              last_name: (r.last_name as string) || "",
              email: (r.email as string) || "",
              school_name: schoolNameMap.get(r.school_id) || "",
            });
          }
        }

        // Map to ConversationThread
        const nextCoachMeta: Record<string, { isDirector: boolean; athleteName: string }> = {};
        const nextParentMeta: Record<string, { parentName: string; childName: string }> = {};
        const mapped: ConversationThread[] = conversations.map((c: any) => {
          const isCoachCoach = c.conversation_type === "COACH_COACH";
          const isParent = c.conversation_type === "PARENT_COACH";
          const otherCoachId = c.coach_id === user.id ? c.coach_b_id : c.coach_id;
          const otherCoach = isCoachCoach ? coachInfoMap.get(otherCoachId) : undefined;
          const parentName = isParent ? (parentInfoMap.get(c.parent_id) || "Parent") : "";
          const recruiterUser = recruiterMap.get(c.recruiter_id);
          const athleteData = c.athletes;
          const position = athleteData?.positions;
          const latestMsg = latestMsgMap[c.id];
          const athleteName = athleteData ? `${athleteData.first_name || ""} ${athleteData.last_name || ""}`.trim() : "";

          if (isCoachCoach) {
            nextCoachMeta[c.id] = { isDirector: !!otherCoach?.isDirector, athleteName };
          }
          if (isParent) {
            nextParentMeta[c.id] = { parentName, childName: athleteName };
          }

          return {
            id: c.id,
            recruiter: {
              // COACH_COACH / PARENT_COACH : the counterparty (coach or parent)
              // lives in `recruiter` so the shared search/sort/status pipeline
              // works unchanged. Full name in firstName ; cegep = role label.
              id: isCoachCoach ? (otherCoachId || "") : isParent ? (c.parent_id || "") : c.recruiter_id,
              firstName: isCoachCoach ? (otherCoach?.name || "Coach") : isParent ? parentName : (recruiterUser?.first_name || ""),
              lastName: "",
              title: "",
              cegep: isCoachCoach ? (otherCoach?.isDirector ? "Directeur" : "Entraîneur") : isParent ? "Parent" : (recruiterUser?.school_name || ""),
              cegepTeamName: "",
              division: "Div. 1" as const,
              sport: "",
              region: "",
              email: isCoachCoach ? "" : (recruiterUser?.email || ""),
              phone: "",
            },
            athlete: {
              id: athleteData?.id || c.athlete_id || "",
              firstName: athleteData?.first_name || "",
              lastName: athleteData?.last_name || "",
              photoUrl: athleteData?.photo_url || "",
              position: position?.abreviation || position?.nom || "",
              niveau: "Sec. 5" as const,
              profilePercent: athleteData?.profile_completion ?? 0,
              isVerified: athleteData?.verified ?? false,
              views: 0,
              favorites: 0,
              stars: athleteData?.cote_globale_entraineur ?? 0,
            },
            messages: [],
            status: isCoachCoach
              ? mapDbStatus(c.status, !!sendersByConv[c.id]?.has(user.id), !!sendersByConv[c.id]?.has(otherCoachId))
              : isParent
              ? mapDbStatus(c.status, !!sendersByConv[c.id]?.has(user.id), !!sendersByConv[c.id]?.has(c.parent_id))
              : mapDbStatus(c.status, coachRepliedMap[c.id], recruiterRepliedMap[c.id]),
            lastMessagePreview: latestMsg?.content ? latestMsg.content.slice(0, 80) + (latestMsg.content.length > 80 ? "..." : "") : "",
            lastMessageTime: latestMsg?.created_at || c.last_message_at || c.created_at,
            lastSenderId: latestMsg?.sender_id ?? null,
            unread: (c.unread_count ?? 0) > 0,
          };
        });

        // Annonce (broadcast) folding — one consolidated entry per broadcast
        // this coach sent, and DROP its N member threads from the list (they're
        // replaced by the Annonce row → no double-clutter).
        const { annonces: annonceList, memberConvIds } = await loadSenderBroadcastSummaries(supabase, user.id);
        const visible = memberConvIds.size > 0 ? mapped.filter((t) => !memberConvIds.has(t.id)) : mapped;

        setThreads(visible);
        setAnnonces(annonceList);
        setCoachMeta(nextCoachMeta);
        setParentMeta(nextParentMeta);
        setConvTypes(Object.fromEntries(conversations.map((c: any) => [c.id as string, (c.conversation_type as string) || "RECRUTEUR_COACH"])));
      } catch (err) {
        console.error("[Demandes] Error loading threads:", err);
      } finally {
        setLoading(false);
      }
    }
    loadThreads();
  }, []);

  const unreadCount = threads.filter((t) => t.unread).length;

  // Type-driven segments — "Parents" auto-appears when a PARENT_COACH
  // thread exists (P2-ready), with zero rework here.
  const typeSegments = useMemo(
    () => deriveTypeSegments(Object.values(convTypes), "coach"),
    [convTypes],
  );

  const filtered = useMemo(() => {
    let list = [...threads];

    // Type filter (derived segments : Recruteurs / Athlètes / Parents…)
    list = list.filter((t) => matchesTypeSegment(typeSegments, typeFilter, convTypes[t.id] || "RECRUTEUR_COACH"));

    // Search (participant names, CÉGEP, last message)
    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (t) =>
          `${t.recruiter.firstName} ${t.recruiter.lastName}`.toLowerCase().includes(q) ||
          t.recruiter.cegep.toLowerCase().includes(q) ||
          `${t.athlete.firstName} ${t.athlete.lastName}`.toLowerCase().includes(q) ||
          t.lastMessagePreview.toLowerCase().includes(q)
      );
    }

    // Status preset (shared with the athlete inbox)
    list = list.filter((t) => matchesStatusPreset(activeFilter, t, userId));

    // Sort: nouveau first, then reponse_recue, then by most recent
    list.sort((a, b) => {
      const sp = STATUS_SORT_PRIORITY[a.status] - STATUS_SORT_PRIORITY[b.status];
      if (sp !== 0) return sp;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return list;
  }, [debouncedSearch, activeFilter, typeFilter, typeSegments, threads, convTypes, userId]);

  // Annonces sit in the default inbox view (Tous · all types). A specific
  // status/type filter or a search term scopes them out — matching the
  // per-thread filters the sender is applying.
  const visibleAnnonces = useMemo(() => {
    if (activeFilter !== "tous" || typeFilter !== "all") return [];
    let list = [...annonces];
    if (debouncedSearch.trim().length >= 2) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((a) => a.targetLabel.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [annonces, activeFilter, typeFilter, debouncedSearch]);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Messages
            </h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">
              Tes conversations avec les recruteurs CÉGEP et tes athlètes
            </p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#E63946] text-white text-[13px] font-bold px-3.5 py-1.5 rounded-full self-start">
              {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Link
          href="/coach/demandes/nouveau"
          className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-5 py-2.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Nouveau message
        </Link>
      </div>

      {/* ── Toolbar (shared with the athlete inbox) ─────────── */}
      <MessagesToolbar
        search={search}
        onSearchChange={setSearch}
        typeSegments={typeSegments}
        typeValue={typeFilter}
        onTypeChange={setTypeFilter}
        statusValue={activeFilter}
        onStatusChange={setActiveFilter}
      />

      {/* ── Thread List ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 && visibleAnnonces.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">
            Aucune demande pour l&apos;instant
          </h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md mb-6 leading-relaxed">
            Quand un recruteur CÉGEP s&apos;intéressera à l&apos;un de tes athlètes, sa demande apparaîtra ici.
            Assure-toi que les profils de tes athlètes sont complets pour maximiser la visibilité.
          </p>
          <Link
            href="/coach/athletes"
            className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest
              transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95"
          >
            Voir mes athlètes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden divide-y divide-[#2D3748]/50">
          {visibleAnnonces.map((a) => <AnnonceCard key={a.broadcastId} a={a} />)}
          {filtered.map((t) => {
            const ct = convTypes[t.id];
            if (ct === "ATHLETE_COACH") return <AthleteThreadCard key={t.id} thread={t} />;
            if (ct === "COACH_COACH") return <CoachCoachThreadCard key={t.id} thread={t} meta={coachMeta[t.id]} />;
            if (ct === "PARENT_COACH") return <ParentThreadCard key={t.id} thread={t} meta={parentMeta[t.id]} />;
            return <ThreadCard key={t.id} thread={t} />;
          })}
        </div>
      )}
    </div>
  );
}
