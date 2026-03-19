"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MOCK_RECRUITER_THREADS, RECRUITER_STATUS_CONFIG } from "../_data/mockMessages";
import type { RecruiterThread, RecruiterThreadStatus } from "../_data/mockMessages";
import EntityLink from "@/components/shared/EntityLink";

/* ═══════════════════════════════════════════════════════════════
   Messages — Thread List (Recruiter perspective)
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
  return `Il y a ${days} jours`;
}

type FilterPreset = "tous" | "reponse_recue" | "en_attente" | "archive";
const PILLS: { key: FilterPreset; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "reponse_recue", label: "Réponse reçue" },
  { key: "en_attente", label: "En attente" },
  { key: "archive", label: "Archivé" },
];

function StatusBadge({ status }: { status: RecruiterThreadStatus }) {
  const cfg = RECRUITER_STATUS_CONFIG[status];
  return (
    <span className={`inline-block px-3 py-1.5 rounded-full text-[12px] font-bold tracking-wide uppercase ${cfg.bg} ${cfg.textColor}`}>
      {cfg.label}
    </span>
  );
}

function ThreadCard({ thread: t }: { thread: RecruiterThread }) {
  const c = t.coach;
  const a = t.athlete;
  const initials = `${c.firstName[0]}${c.lastName[0]}`;

  return (
    <Link
      href={`/recruteur/messages/${t.id}`}
      className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#252D3A] ${
        t.unread
          ? "bg-[#1E2430] border-l-[3px] border-l-[#E63946]"
          : "bg-[#1A1D24] border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Coach avatar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-full bg-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[13px] font-bold text-[#9CA3AF]">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <EntityLink
              type="coach"
              id={c.id}
              name={`${c.firstName} ${c.lastName}`}
              portal="recruiter"
              className={`text-[15px] truncate ${t.unread ? "" : "!text-[#e0e0e0]"}`}
            />
            <span className="text-[12px] text-[#6b7280] shrink-0 hidden sm:inline">{c.school}</span>
          </div>
          <p className="text-[13px] text-[#6b7280] truncate mt-0.5">{t.lastMessagePreview}</p>
        </div>
      </div>

      {/* Athlete context */}
      <div className="hidden md:flex items-center gap-2 shrink-0 w-[200px]">
        <div className="w-8 h-8 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-[#6b7280]">{a.firstName[0]}{a.lastName[0]}</span>
        </div>
        <div className="min-w-0">
          <EntityLink
            type="athlete"
            id={a.id}
            name={`${a.firstName} ${a.lastName}`}
            portal="recruiter"
            className="text-[13px] !font-semibold !text-[#9CA3AF] truncate"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#6b7280] font-bold uppercase">{a.position}</span>
            {a.isVerified && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
            <div className="flex items-center gap-0.5 ml-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i < a.stars ? "#F59E0B" : "#374151"} stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>
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

export default function MessagesPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterPreset>("tous");

  const unreadCount = MOCK_RECRUITER_THREADS.filter((t) => t.unread).length;

  const filtered = useMemo(() => {
    let list = [...MOCK_RECRUITER_THREADS];

    if (search.trim().length >= 2) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        `${t.coach.firstName} ${t.coach.lastName}`.toLowerCase().includes(q) ||
        t.coach.school.toLowerCase().includes(q) ||
        `${t.athlete.firstName} ${t.athlete.lastName}`.toLowerCase().includes(q)
      );
    }

    switch (activeFilter) {
      case "reponse_recue": list = list.filter((t) => t.status === "reponse_recue"); break;
      case "en_attente": list = list.filter((t) => t.status === "envoye" || t.status === "lu"); break;
      case "archive": list = list.filter((t) => t.status === "archive"); break;
    }

    // Sort: reponse_recue first, then by most recent
    const priority: Record<RecruiterThreadStatus, number> = { reponse_recue: 0, envoye: 1, lu: 2, archive: 3 };
    list.sort((a, b) => {
      const sp = priority[a.status] - priority[b.status];
      if (sp !== 0) return sp;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    return list;
  }, [search, activeFilter]);

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
          {/* Compose / pen icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
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
          {PILLS.map((pill) => (
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
          {filtered.map((t) => <ThreadCard key={t.id} thread={t} />)}
        </div>
      )}
    </div>
  );
}
