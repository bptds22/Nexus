"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { mockDirectorActivitiesCegep } from "@/lib/mock";
import type { DirectorActivity, DirectorActivityType } from "@/lib/types/models";

/* ── constants ───────────────────────────────────────────── */

const PAGE_SIZE = 15;

type FilterKey = "all" | "recruit" | "favorite" | "message" | "alert";

const FILTER_PILLS: { key: FilterKey; label: string; types: DirectorActivityType[] }[] = [
  { key: "all", label: "Tous", types: [] },
  { key: "recruit", label: "Recrutements", types: ["recruit_confirmed"] },
  { key: "favorite", label: "Favoris", types: ["new_favorite"] },
  { key: "message", label: "Messages", types: ["message_sent"] },
  { key: "alert", label: "Alertes", types: ["recruiter_inactive"] },
];

/* ── helpers ─────────────────────────────────────────────── */

const MONTHS_FR = [
  "janvier", "f\u00e9vrier", "mars", "avril", "mai", "juin",
  "juillet", "ao\u00fbt", "septembre", "octobre", "novembre", "d\u00e9cembre",
];

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTimeFr(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function getTimePeriodLabel(iso: string): string {
  const now = new Date("2026-03-12T12:00:00Z");
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd\u2019hui";
  if (diffDays === 1) return "Hier";
  if (diffDays <= 6) return "Cette semaine";
  if (diffDays <= 13) return "La semaine derni\u00e8re";
  return "Plus ancien";
}

function getActivityText(a: DirectorActivity): string {
  switch (a.type) {
    case "recruit_confirmed":
      return `${a.athleteName} a sign\u00e9 sa lettre d\u2019intention pour ${a.sportName}!`;
    case "new_favorite":
      return `${a.recruiterName} a ajout\u00e9 ${a.athleteName} \u00e0 ses favoris`;
    case "message_sent":
      return `${a.recruiterName} a contact\u00e9 le coach de ${a.athleteName}`;
    case "recruiter_inactive":
      return `${a.recruiterName} ne s\u2019est pas connect\u00e9 depuis ${a.daysInactive} jours`;
    case "recruiter_joined":
      return `${a.recruiterName} a rejoint la plateforme`;
    case "coach_deactivated":
      return `${a.coachName || a.recruiterName} a été désactivé`;
    case "coach_reactivated":
      return `${a.coachName || a.recruiterName} a été réactivé`;
    case "athlete_reassigned":
      return `${a.athleteName} a été réassigné à un nouvel entraîneur`;
    case "pipeline_transferred":
      return `Pipeline de ${a.athleteName} transféré à ${a.recruiterName}`;
    case "pipeline_frozen":
      return `Pipeline de ${a.athleteName} gelé — recruteur désactivé`;
    default:
      return "";
  }
}

function getActivityIcon(type: DirectorActivityType): {
  path: string;
  color: string;
} {
  switch (type) {
    case "recruit_confirmed":
      return {
        path: "M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0V7H7.5v6zM7.5 7H4a1 1 0 00-1 1v1a4 4 0 004 4h.5m9-6H20a1 1 0 011 1v1a4 4 0 01-4 4h-.5",
        color: "#E63946",
      };
    case "new_favorite":
      return {
        path: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
        color: "#F59E0B",
      };
    case "message_sent":
      return {
        path: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
        color: "#3B82F6",
      };
    case "recruiter_inactive":
      return {
        path: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        color: "#F59E0B",
      };
    case "recruiter_joined":
      return {
        path: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
        color: "#22C55E",
      };
    case "coach_deactivated":
      return {
        path: "M12 12m-10 0a10 10 0 1020 0a10 10 0 10-20 0M4.93 4.93l14.14 14.14",
        color: "#E63946",
      };
    case "coach_reactivated":
      return {
        path: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
        color: "#22C55E",
      };
    case "athlete_reassigned":
    case "pipeline_transferred":
      return {
        path: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
        color: "#F59E0B",
      };
    case "pipeline_frozen":
      return {
        path: "M3 11h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V11zM7 11V7a5 5 0 0110 0v4",
        color: "#6B7280",
      };
    default:
      return {
        path: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        color: "#6B7280",
      };
  }
}

/* ── page ────────────────────────────────────────────────── */

export default function CegepActivitesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedRecruiter, setSelectedRecruiter] = useState<string>("all");
  const [page, setPage] = useState(1);

  /* unique recruiter names for dropdown */
  const recruiterNames = useMemo(() => {
    const names = new Set<string>();
    for (const a of mockDirectorActivitiesCegep) {
      if (a.recruiterName) names.add(a.recruiterName);
    }
    return Array.from(names).sort();
  }, []);

  /* filter + search */
  const filtered = useMemo(() => {
    let list = mockDirectorActivitiesCegep;

    if (filter !== "all") {
      const types = FILTER_PILLS.find((p) => p.key === filter)!.types;
      list = list.filter((a) => types.includes(a.type));
    }

    if (selectedRecruiter !== "all") {
      list = list.filter((a) => a.recruiterName === selectedRecruiter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.athleteName?.toLowerCase().includes(q) ?? false) ||
          (a.recruiterName?.toLowerCase().includes(q) ?? false) ||
          (a.sportName?.toLowerCase().includes(q) ?? false),
      );
    }

    return list;
  }, [filter, search, selectedRecruiter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* group by time period */
  const grouped = useMemo(() => {
    const map = new Map<string, DirectorActivity[]>();
    for (const a of paginated) {
      const label = getTimePeriodLabel(a.timestamp);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(a);
    }
    return Array.from(map.entries());
  }, [paginated]);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <h1
        className="text-[22px] font-bold uppercase tracking-wide text-white"
        style={{ fontFamily: "var(--wl-font-head, Montserrat, sans-serif)" }}
      >
        Activit&eacute;s
      </h1>

      {/* ── Search + Filters ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher..."
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors w-full sm:w-64"
        />
        <div className="flex flex-wrap gap-2">
          {FILTER_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setFilter(p.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                filter === p.key
                  ? "bg-[#E63946] text-white"
                  : "bg-transparent border border-[#2A2D35] text-[#9CA3AF] hover:border-[#E63946] hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          aria-label="Filtrer par recruteur"
          value={selectedRecruiter}
          onChange={(e) => {
            setSelectedRecruiter(e.target.value);
            setPage(1);
          }}
          className="bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors appearance-none cursor-pointer"
        >
          <option value="all">Tous les recruteurs</option>
          {recruiterNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Activity feed ─────────────────────────────── */}
      {grouped.length === 0 ? (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 flex flex-col items-center justify-center gap-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#6B7280"
            strokeWidth={1.5}
            className="opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-[14px] text-[#6B7280]">
            Aucune activit&eacute; trouv&eacute;e.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([label, activities]) => (
            <div key={label}>
              <h3 className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-3">
                {label}
              </h3>
              <div className="space-y-2">
                {activities.map((a) => {
                  const icon = getActivityIcon(a.type);
                  return (
                    <Link
                      key={a.id}
                      href={a.ctaRoute || "/directeur-cegep/activites"}
                      className={`block bg-[#1A1D24] rounded-xl border p-4 transition-colors cursor-pointer hover:bg-[#22262E] ${
                        a.isHighlighted
                          ? "border-[#E63946]/40 bg-[rgba(230,57,70,0.04)] hover:bg-[rgba(230,57,70,0.08)]"
                          : "border-[#1e2128]"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* icon */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${icon.color}15` }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke={icon.color}
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={icon.path}
                            />
                          </svg>
                        </div>

                        {/* text */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] leading-relaxed ${
                              a.isHighlighted
                                ? "text-white font-semibold"
                                : "text-[#e0e0e0]"
                            }`}
                          >
                            {getActivityText(a)}
                          </p>
                          <p className="text-[11px] text-[#6B7280] mt-1">
                            {formatDateFr(a.timestamp)} &agrave;{" "}
                            {formatTimeFr(a.timestamp)}
                            {a.sportName && (
                              <span className="ml-2 bg-[#2A2D35] text-[#9CA3AF] rounded-full px-2 py-0.5 text-[10px]">
                                {a.sportName}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* unread dot */}
                        {!a.isRead && (
                          <div className="w-2 h-2 rounded-full bg-[#E63946] flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-[13px] text-[#9CA3AF] border border-[#2A2D35] hover:border-[#E63946] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Pr&eacute;c&eacute;dent
          </button>
          <span className="text-[13px] text-[#6B7280]">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-[13px] text-[#9CA3AF] border border-[#2A2D35] hover:border-[#E63946] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
