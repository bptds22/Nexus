"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { mockDirectorActivitiesHS } from "@/lib/mock";
import type { DirectorActivity, DirectorActivityType } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Director HS Activities — /directeur-ecole/activites
   Full activity feed with filters, grouping, pagination
═══════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 15;

/* ── Filter pills ─────────────────────────────────────────── */
type FilterKey = "all" | "ajouts" | "consultations" | "placements" | "alertes" | "verifications";

const FILTERS: { key: FilterKey; label: string; types: DirectorActivityType[] }[] = [
  { key: "all", label: "Tous", types: [] },
  { key: "ajouts", label: "Ajouts", types: ["coach_added_athlete", "coach_joined"] },
  { key: "consultations", label: "Consultations", types: ["athlete_viewed"] },
  { key: "placements", label: "Placements", types: ["letter_of_intent"] },
  { key: "alertes", label: "Alertes", types: ["coach_inactive"] },
  { key: "verifications", label: "V\u00e9rifications", types: ["profile_verified"] },
];

/* ── Input style ──────────────────────────────────────────── */
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

/* ── Activity icons (SVG, matching dashboard) ────────────── */
function activityIcon(type: DirectorActivityType): React.ReactNode {
  const base = "w-8 h-8 rounded-full flex items-center justify-center shrink-0";
  switch (type) {
    case "coach_added_athlete":
      return (
        <span className={`${base} bg-[rgba(59,130,246,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </span>
      );
    case "athlete_viewed":
      return (
        <span className={`${base} bg-[rgba(255,255,255,0.08)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      );
    case "letter_of_intent":
      return (
        <span className={`${base} bg-[rgba(230,57,70,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </span>
      );
    case "coach_inactive":
      return (
        <span className={`${base} bg-[rgba(245,158,11,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
      );
    case "profile_verified":
      return (
        <span className={`${base} bg-[rgba(34,197,94,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      );
    case "coach_joined":
      return (
        <span className={`${base} bg-[rgba(59,130,246,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
        </span>
      );
    case "coach_deactivated":
      return (
        <span className={`${base} bg-[rgba(230,57,70,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </span>
      );
    case "coach_reactivated":
      return (
        <span className={`${base} bg-[rgba(34,197,94,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    case "athlete_reassigned":
      return (
        <span className={`${base} bg-[rgba(245,158,11,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </span>
      );
    default:
      return (
        <span className={`${base} bg-[rgba(255,255,255,0.08)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </span>
      );
  }
}

/* ── Activity text ────────────────────────────────────────── */
function activityText(a: DirectorActivity): string {
  switch (a.type) {
    case "coach_added_athlete":
      return `${a.coachName} a ajout\u00e9 ${a.athleteName} (${a.sportName}) \u00e0 la plateforme`;
    case "athlete_viewed":
      return `Le profil de ${a.athleteName} a \u00e9t\u00e9 consult\u00e9 par ${a.cegepName}`;
    case "letter_of_intent":
      return `${a.athleteName} a \u00e9t\u00e9 recrut\u00e9 par ${a.cegepName}!`;
    case "coach_inactive":
      return `${a.coachName} ne s\u2019est pas connect\u00e9 depuis ${a.daysInactive} jours`;
    case "profile_verified":
      return `${a.athleteName} est maintenant un profil v\u00e9rifi\u00e9`;
    case "coach_joined":
      return `${a.coachName} a rejoint la plateforme`;
    case "coach_deactivated":
      return `${a.coachName} a été désactivé`;
    case "coach_reactivated":
      return `${a.coachName} a été réactivé`;
    case "athlete_reassigned":
      return `${a.athleteName} a été réassigné à un nouvel entraîneur`;
    default:
      return "Activité";
  }
}

/* ── Relative time (French) ───────────────────────────────── */
function relativeTime(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "\u00c0 l\u2019instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `il y a ${diffD}j`;
  const diffW = Math.floor(diffD / 7);
  return `il y a ${diffW} sem.`;
}

/* ── Time grouping ────────────────────────────────────────── */
function getTimeGroup(iso: string): string {
  const now = new Date();
  const d = new Date(iso);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (d >= todayStart) return "Aujourd\u2019hui";
  if (d >= yesterdayStart) return "Hier";
  if (d >= weekStart) return "Cette semaine";
  if (d >= monthStart) return "Ce mois-ci";
  return "Plus ancien";
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function DirectorHSActivitesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  /* ── Sorted activities (desc) ───────────────────────────── */
  const allActivities = useMemo(
    () => [...mockDirectorActivitiesHS].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    []
  );

  /* ── Unread count ───────────────────────────────────────── */
  const unreadCount = allActivities.filter((a) => !a.isRead).length;

  /* ── Filtered activities ────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = allActivities;

    // Filter by type
    const filterDef = FILTERS.find((f) => f.key === activeFilter);
    if (filterDef && filterDef.types.length > 0) {
      list = list.filter((a) => filterDef.types.includes(a.type));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => activityText(a).toLowerCase().includes(q));
    }

    return list;
  }, [allActivities, activeFilter, search]);

  /* ── Paginated ──────────────────────────────────────────── */
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  /* ── Group by time ──────────────────────────────────────── */
  const grouped = useMemo(() => {
    const groups: { label: string; items: DirectorActivity[] }[] = [];
    for (const a of visible) {
      const label = getTimeGroup(a.timestamp);
      const existing = groups.find((g) => g.label === label);
      if (existing) {
        existing.items.push(a);
      } else {
        groups.push({ label, items: [a] });
      }
    }
    return groups;
  }, [visible]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Activit&eacute;s
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          {unreadCount} notification{unreadCount !== 1 ? "s" : ""} non lue{unreadCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setActiveFilter(f.key);
              setVisibleCount(PAGE_SIZE);
            }}
            className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
              activeFilter === f.key
                ? "bg-[#E63946] text-white"
                : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Rechercher dans les activit\u00e9s..."
          className={inputCls}
        />
      </div>

      {/* Activity list */}
      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[14px] text-[#6B7280]">Aucune activit&eacute; trouv&eacute;e</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-2">
                {group.label}
              </p>

              {/* Activity cards */}
              <div className="space-y-2">
                {group.items.map((a) => {
                  const isHighlighted = a.type === "letter_of_intent";
                  return (
                    <Link
                      key={a.id}
                      href={a.ctaRoute || "/directeur-ecole/activites"}
                      className={`
                        block rounded-xl border p-4 transition-colors cursor-pointer hover:bg-[rgba(255,255,255,0.04)]
                        ${isHighlighted
                          ? "bg-[rgba(230,57,70,0.06)] border-[#E63946]/30 hover:bg-[rgba(230,57,70,0.10)]"
                          : "bg-[#1A1D24] border-[#1e2128]"
                        }
                        ${!a.isRead ? "border-l-[3px] border-l-[#E63946]" : ""}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        {activityIcon(a.type)}

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[14px] leading-relaxed ${!a.isRead ? "text-white font-medium" : "text-[#d1d5db]"}`}>
                            {activityText(a)}
                          </p>
                        </div>

                        {/* Time */}
                        <span className="shrink-0 text-[12px] text-[#6B7280] whitespace-nowrap ml-2">
                          {relativeTime(a.timestamp)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946] hover:text-white rounded-lg px-6 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors"
          >
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
}
