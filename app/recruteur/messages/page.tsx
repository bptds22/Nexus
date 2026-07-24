"use client";

import FeatureGate from "@/components/subscription/FeatureGate";
import { useState, useMemo } from "react";
import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { useConversations } from "@/lib/queries/recruiter/useConversations";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { RecruteurMessagesMobile } from "@/components/shared/RecruteurMessagesMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Messages — Thread List (Recruiter perspective)
   Wired to Supabase: conversations + messages + users + athletes
═══════════════════════════════════════════════════════════════ */

interface ThreadData {
  id: string;
  conversationType: string;
  coachName: string;
  coachInitials: string;
  coachSchool: string;
  coachId: string;
  athleteName: string;
  athleteInitials: string;
  athleteId: string;
  athletePosition: string;
  athleteVerified: boolean;
  athleteStars: number;
  athleteRecruitmentStatus: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status: string;
}

type FilterPreset = "tous" | "non_lu" | "sans_reponse" | "archive";

const PILLS: { key: FilterPreset; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "non_lu", label: "Non lu" },
  { key: "sans_reponse", label: "Sans réponse" },
  { key: "archive", label: "Archivé" },
];

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
  return `Il y a ${days} jours`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
  return (
    <span className={`inline-block px-3 py-1.5 rounded-full text-[12px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  );
}

function ThreadCard({ thread: t }: { thread: ThreadData }) {
  // RECRUTEUR_ATHLETE is a DIRECT thread — the athlete IS the counterparty.
  // No coach, no "about-athlete" context panel.
  const isDirect = t.conversationType === "RECRUTEUR_ATHLETE";
  const primaryName = isDirect ? t.athleteName : t.coachName;
  const primaryInitials = isDirect ? t.athleteInitials : t.coachInitials;
  const primarySub = isDirect ? t.athletePosition : t.coachSchool;
  return (
    <Link
      href={`/recruteur/messages/${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unreadCount > 0
          ? "bg-[#1E2430] border-l-[3px] border-l-[#E63946]"
          : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Counterparty avatar + identity */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${isDirect ? "bg-[#22C55E]/15 border border-[#22C55E]/30" : "bg-[#2D3748]"}`}>
          <span className={`text-[13px] font-bold ${isDirect ? "text-[#22C55E]" : "text-[#9CA3AF]"}`}>{primaryInitials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[15px] font-bold truncate ${t.unreadCount > 0 ? "text-white" : "text-[#e0e0e0]"}`}>
              {primaryName}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${isDirect ? "bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E]" : "bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6]"}`}>
              {isDirect ? "Athlète" : "Coach"}
            </span>
            {primarySub && <span className="text-[12px] text-[#6b7280] shrink-0 hidden sm:inline">{primarySub}</span>}
          </div>
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessage}</p>
        </div>
      </div>

      {/* Athlete context — ONLY for about-athlete (RECRUTEUR_COACH) threads. */}
      {!isDirect && (
        <div className="hidden md:flex items-center gap-2 shrink-0 w-[260px]">
          <div className="w-8 h-8 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-[#6b7280]">{t.athleteInitials}</span>
          </div>
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-[#9CA3AF] truncate block">{t.athleteName}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#6b7280] font-bold uppercase">{t.athletePosition}</span>
              {t.athleteVerified && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              <StarRating rating={t.athleteStars} size="sm" />
            </div>
            <RecruitmentStatusBadge status={t.athleteRecruitmentStatus as GlobalRecruitmentStatus} size="sm" />
          </div>
        </div>
      )}

      {/* Timestamp + status */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 w-[130px]">
        <span className={`text-[12px] ${t.unreadCount > 0 ? "text-white font-semibold" : "text-[#6b7280]"}`}>
          {relativeTime(t.lastMessageAt)}
        </span>
        <StatusBadge status={t.status} />
      </div>
    </Link>
  );
}

export default function Page() {
  // Iter 7.8a — mobile early return AVANT le FeatureGate desktop : la mobile
  // gère son propre gating Free (blur + tease) en interne.
  if (IS_CAPACITOR) return <RecruteurMessagesMobile />;
  return (
    <FeatureGate feature="messaging" requiredTier="pro">
      <MessagesPageContent />
    </FeatureGate>
  );
}

function MessagesPageContent() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterPreset>("tous");
  // Migration TanStack (iter 5.2) — fetch + transformation déléguées au hook
  const { data: threads = [], isLoading: loading } = useConversations();
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.authUser.id;

  const unreadCount = threads.filter(t => t.unreadCount > 0).length;

  const filtered = useMemo(() => {
    let list = [...threads];

    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.coachName.toLowerCase().includes(q) ||
        t.coachSchool.toLowerCase().includes(q) ||
        t.athleteName.toLowerCase().includes(q)
      );
    }

    switch (activeFilter) {
      case "non_lu": list = list.filter(t => t.unreadCount > 0); break;
      // "Sans réponse" : dernier message du recruteur courant → en attente (def. (a)).
      case "sans_reponse": list = list.filter(t => t.lastSenderId != null && t.lastSenderId === userId && t.status !== "ARCHIVE"); break;
      case "archive": list = list.filter(t => t.status === "ARCHIVE"); break;
    }

    return list;
  }, [search, activeFilter, threads, userId]);

  if (loading) {
    return <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>;
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Messages</h1>
            <p className="text-[14px] text-[#9CA3AF] mt-1">Tes conversations avec les coachs</p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#E63946] text-white text-[13px] font-bold px-3.5 py-1.5 rounded-full self-start">
              {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Link
          href="/recruteur/messages/nouveau"
          className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-5 py-2.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Nouveau message
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-[40%] min-w-[200px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par coach, école ou athlète..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {PILLS.map(pill => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setActiveFilter(pill.key)}
              className={`px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
                activeFilter === pill.key
                  ? "bg-[#E63946] text-white"
                  : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun message</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed">
            Explore les profils d&apos;athlètes et contacte un coach pour démarrer une conversation.
          </p>
        </div>
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden divide-y divide-[#2D3748]/50">
          {filtered.map(t => <ThreadCard key={t.id} thread={t} />)}
        </div>
      )}
    </div>
  );
}
