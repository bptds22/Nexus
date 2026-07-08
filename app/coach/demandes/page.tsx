"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import { STATUS_CONFIG, mapDbStatus, type ConversationThread, type ThreadStatus } from "./_data/mockThreadsData";
import EntityLink from "@/components/shared/EntityLink";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { CoachDemandesMobile } from "@/components/shared/CoachDemandesMobile";

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

type FilterPreset = "tous" | "nouveau" | "reponse_recue" | "sans_reponse" | "archive";

const PILLS: { key: FilterPreset; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "nouveau", label: "Nouveau" },
  { key: "reponse_recue", label: "Réponse reçue" },
  { key: "sans_reponse", label: "Sans réponse" },
  { key: "archive", label: "Archivé" },
];

function mapUrlFilter(p: string | null): FilterPreset {
  if (p === "nouveau") return "nouveau";
  if (p === "reponse_recue") return "reponse_recue";
  if (p === "sans_reponse") return "sans_reponse";
  if (p === "archive") return "archive";
  return "tous";
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

/* ── Thread Card ───────────────────────────────────────────── */

function ThreadCard({ thread: t }: { thread: ConversationThread }) {
  const r = t.recruiter;
  const a = t.athlete;
  const initials = `${r.firstName[0]}${r.lastName[0]}`;

  return (
    <Link
      href={`/coach/demandes/${t.id}`}
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

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function DemandesPage() {
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
  const [activeFilter, setActiveFilter] = useState<FilterPreset>(mapUrlFilter(urlFilter));
  const [threads, setThreads] = useState<ConversationThread[]>([]);
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
          .select("id, recruiter_id, coach_id, athlete_id, status, last_message_at, unread_count, created_at, athletes!athlete_id(id, first_name, last_name, verified, cote_globale_entraineur, profile_completion, annee_diplomation, photo_url, positions!position_id(nom, abreviation))")
          .eq("coach_id", user.id)
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
        if (latestMessages) {
          for (const msg of latestMessages as any[]) {
            if (!latestMsgMap[msg.conversation_id]) {
              latestMsgMap[msg.conversation_id] = msg;
            }
            // Track who has sent messages
            const conv = conversations.find((c: any) => c.id === msg.conversation_id);
            if (conv && msg.sender_id === (conv as any).coach_id) coachRepliedMap[msg.conversation_id] = true;
            if (conv && msg.sender_id === (conv as any).recruiter_id) recruiterRepliedMap[msg.conversation_id] = true;
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
        const mapped: ConversationThread[] = conversations.map((c: any) => {
          const recruiterUser = recruiterMap.get(c.recruiter_id);
          const athleteData = c.athletes;
          const position = athleteData?.positions;
          const latestMsg = latestMsgMap[c.id];

          return {
            id: c.id,
            recruiter: {
              id: c.recruiter_id,
              firstName: recruiterUser?.first_name || "",
              lastName: recruiterUser?.last_name || "",
              title: "",
              cegep: recruiterUser?.school_name || "",
              cegepTeamName: "",
              division: "Div. 1" as const,
              sport: "",
              region: "",
              email: recruiterUser?.email || "",
              phone: "",
            },
            athlete: {
              id: athleteData?.id || c.athlete_id,
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
            status: mapDbStatus(c.status, coachRepliedMap[c.id], recruiterRepliedMap[c.id]),
            lastMessagePreview: latestMsg?.content ? latestMsg.content.slice(0, 80) + (latestMsg.content.length > 80 ? "..." : "") : "",
            lastMessageTime: latestMsg?.created_at || c.last_message_at || c.created_at,
            lastSenderId: latestMsg?.sender_id ?? null,
            unread: (c.unread_count ?? 0) > 0,
          };
        });

        setThreads(mapped);
      } catch (err) {
        console.error("[Demandes] Error loading threads:", err);
      } finally {
        setLoading(false);
      }
    }
    loadThreads();
  }, []);

  const unreadCount = threads.filter((t) => t.unread).length;

  const filtered = useMemo(() => {
    let list = [...threads];

    // Search
    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          `${t.recruiter.firstName} ${t.recruiter.lastName}`.toLowerCase().includes(q) ||
          t.recruiter.cegep.toLowerCase().includes(q) ||
          `${t.athlete.firstName} ${t.athlete.lastName}`.toLowerCase().includes(q)
      );
    }

    // Filter
    switch (activeFilter) {
      case "nouveau":
        list = list.filter((t) => t.status === "nouveau");
        break;
      case "reponse_recue":
        list = list.filter((t) => t.status === "reponse_recue");
        break;
      // "Sans réponse" : le dernier message vient du coach courant → on attend
      // la réponse du recruteur (def. (a)). Remplace l'ancien "Envoyé" (basé sur
      // mapDbStatus, qui ne renvoie jamais "envoye"). mapDbStatus/badges intacts.
      case "sans_reponse":
        list = list.filter((t) => t.lastSenderId != null && t.lastSenderId === userId && t.status !== "archive");
        break;
      case "archive":
        list = list.filter((t) => t.status === "archive");
        break;
    }

    // Sort: nouveau first, then reponse_recue, then by most recent
    const statusPriority: Record<ThreadStatus, number> = {
      nouveau: 0, reponse_recue: 1, repondu: 2, envoye: 3, archive: 4,
    };
    list.sort((a, b) => {
      const sp = statusPriority[a.status] - statusPriority[b.status];
      if (sp !== 0) return sp;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return list;
  }, [search, activeFilter, threads, userId]);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Demandes des recruteurs
            </h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">
              Tes conversations avec les recruteurs CÉGEP
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

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-[40%] min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par recruteur, CÉGEP ou athlète..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {PILLS.map((pill) => {
            const isActive = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setActiveFilter(pill.key)}
                className={`px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[#E63946] text-white"
                    : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Thread List ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
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
          {filtered.map((t) => (
            <ThreadCard key={t.id} thread={t} />
          ))}
        </div>
      )}
    </div>
  );
}
