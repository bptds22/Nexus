"use client";

import React from "react";
import Link from "next/link";
import SchoolGate from "@/components/subscription/SchoolGate";
import KpiCard from "@/components/director/KpiCard";
import KpiCardRow from "@/components/director/KpiCardRow";
import FunnelChart from "@/components/director/FunnelChart";
import {
  mockHSDashboardStats,
  mockViewsBySport,
  mockViewsTrend,
  mockFunnelData,
  mockCoachOverviews,
  mockDirectorActivitiesHS,
} from "@/lib/mock";
import type { DirectorActivity } from "@/lib/types/models";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

/* ─── Helpers ──────────────────────────────────────────────── */

function relativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffD === 1) return "Hier";
  if (diffD < 7) return `Il y a ${diffD} jours`;
  if (diffD < 30) return `Il y a ${Math.floor(diffD / 7)} sem.`;
  return `Il y a ${Math.floor(diffD / 30)} mois`;
}

function completionColor(pct: number): string {
  if (pct >= 60) return "#3B82F6";
  return "#6B7280";
}

function activityIcon(type: DirectorActivity["type"]): React.ReactNode {
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

function activityHref(a: DirectorActivity): string {
  return a.ctaRoute || "/coach/ecole/activites";
}

function AthleteLink({ id, name }: { id?: string; name?: string }) {
  if (!name) return null;
  if (!id) return <span className="text-white font-medium">{name}</span>;
  return (
    <Link
      href={`/coach/ecole/athletes/${id}`}
      className="text-white font-medium hover:text-[#E63946] transition-colors underline decoration-transparent hover:decoration-[#E63946]"
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

function activityText(a: DirectorActivity): React.ReactNode {
  switch (a.type) {
    case "coach_added_athlete":
      return (
        <>
          <span className="text-white font-medium">{a.coachName}</span>{" "}
          a ajout&eacute; <AthleteLink id={a.athleteId} name={a.athleteName} />{" "}
          ({a.sportName})
        </>
      );
    case "athlete_viewed":
      return (
        <>
          Le profil de <AthleteLink id={a.athleteId} name={a.athleteName} />{" "}
          a &eacute;t&eacute; consult&eacute; par{" "}
          <span className="text-white font-medium">{a.cegepName}</span>
        </>
      );
    case "letter_of_intent":
      return (
        <>
          <AthleteLink id={a.athleteId} name={a.athleteName} />{" "}
          a &eacute;t&eacute; recrut&eacute; par{" "}
          <span className="text-white font-medium">{a.cegepName}</span> !
        </>
      );
    case "coach_inactive":
      return (
        <>
          <span className="text-white font-medium">{a.coachName}</span>{" "}
          ne s&apos;est pas connect&eacute; depuis {a.daysInactive} jours
        </>
      );
    case "profile_verified":
      return (
        <>
          <AthleteLink id={a.athleteId} name={a.athleteName} />{" "}
          est maintenant un profil v&eacute;rifi&eacute;
        </>
      );
    case "coach_joined":
      return (
        <>
          <span className="text-white font-medium">{a.coachName}</span>{" "}
          a rejoint la plateforme
        </>
      );
    default:
      return <span>{a.type}</span>;
  }
}

/* ─── Custom Recharts Tooltip ──────────────────────────────── */

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D24] border border-[#2A2D35] rounded-lg px-3 py-2 text-[12px]">
      <p className="text-[#9CA3AF]">{label}</p>
      <p className="text-white font-bold">{payload[0].value} vues</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE COMPONENT
═══════════════════════════════════════════════════════════ */

export default function SchoolDashboardPage() {
  return <SchoolGate><SchoolDashboardContent /></SchoolGate>;
}

function SchoolDashboardContent() {
  const stats = mockHSDashboardStats;

  /* Coach ranking: top 5 by recruiterViews30d */
  const rankedCoaches = [...mockCoachOverviews]
    .sort((a, b) => b.recruiterViews30d - a.recruiterViews30d)
    .slice(0, 5);

  /* Recent activity: first 5 */
  const recentActivities = mockDirectorActivitiesHS.slice(0, 5);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
            Tableau de bord — Mon école
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            Vue d&apos;ensemble de votre programme sportif
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 bg-[#1A1D24] border border-[#2A2D35] rounded-full px-4 py-1.5 text-[13px] text-[#9CA3AF]">
            &Eacute;cole sec. De Rochebelle
          </span>
          <button className="relative p-2 text-[#6B7280] hover:text-white transition-colors">
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#E63946] rounded-full" />
          </button>
        </div>
      </div>

      {/* ── Section 1: KPI Cards ───────────────────────────── */}
      <KpiCardRow>
        {/* 1 — Athletes inscrits */}
        <KpiCard
          label="Athl&egrave;tes inscrits"
          value={stats.totalAthletes ?? 0}
          href="/coach/ecole/athletes"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx={9} cy={7} r={4} />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          iconBgColor="rgba(255,255,255,0.1)"
          trend={stats.athletesTrend}
          trendLabel="vs mois dernier"
        />

        {/* 2 — Profils completes */}
        <KpiCard
          label="Profils compl&eacute;t&eacute;s"
          value={`${stats.avgProfileCompletion ?? 0}%`}
          href="/coach/ecole/athletes?statut=completes"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={completionColor(stats.avgProfileCompletion ?? 0)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          iconBgColor={
            (stats.avgProfileCompletion ?? 0) >= 60
              ? "rgba(37,99,235,0.15)"
              : "rgba(107,114,128,0.15)"
          }
          trend={stats.completionTrend}
          trendLabel="%"
          progressPercent={stats.avgProfileCompletion}
          progressColor={completionColor(stats.avgProfileCompletion ?? 0)}
        />

        {/* 3 — Vues recruteurs */}
        <KpiCard
          label="Vues recruteurs (30j)"
          value={stats.recruiterViews30d ?? 0}
          href="/coach/ecole/athletes?statut=vus"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx={12} cy={12} r={3} />
            </svg>
          }
          iconBgColor="rgba(255,255,255,0.1)"
          trend={stats.viewsTrend}
        />

        {/* 4 — Placements saison */}
        <KpiCard
          label="Placements cette année"
          value={stats.placementsSeason ?? 0}
          href="/coach/ecole/placements"
          icon={
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          }
          iconBgColor="rgba(230,57,70,0.15)"
          valueFontSize="36px"
          valueColor="#E63946"
        />
      </KpiCardRow>

      {/* ── Section 2: Charts ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Left — Vues par sport */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h3 className="font-head text-[15px] font-bold text-white mb-4">
            Vues par sport (30 derniers jours)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={mockViewsBySport}
              layout="vertical"
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="sport"
                width={90}
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="views" fill="#E63946" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Right — Vues recruteurs trend */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h3 className="font-head text-[15px] font-bold text-white mb-4">
            Vues recruteurs &mdash; 6 derniers mois
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={mockViewsTrend}
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(230,57,70,0.25)" />
                  <stop offset="100%" stopColor="rgba(230,57,70,0)" />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<DarkTooltip />} cursor={false} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#E63946"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#FFFFFF", stroke: "#E63946", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 3: Funnel ──────────────────────────────── */}
      <FunnelChart
        title="Pipeline de recrutement &mdash; Saison 2025-2026"
        data={mockFunnelData}
      />

      {/* ── Section 4: Coach ranking table ─────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="mb-4">
          <h3 className="font-head text-[15px] font-bold text-white">
            Performance des coachs
          </h3>
          <p className="text-[12px] text-[#6B7280] mt-0.5">
            Class&eacute; par activit&eacute; de recrutement
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11px] text-[#6B7280] uppercase tracking-wider border-b border-[#2A2D35]">
                <th className="pb-2 pr-3 w-8">#</th>
                <th className="pb-2 pr-3">Coach</th>
                <th className="pb-2 pr-3">Sport</th>
                <th className="pb-2 pr-3 text-center">Athl&egrave;tes</th>
                <th className="pb-2 pr-3">Compl&eacute;tude</th>
                <th className="pb-2 text-right">Vues 30j</th>
              </tr>
            </thead>
            <tbody>
              {rankedCoaches.map((c, i) => {
                const pColor = completionColor(c.profileCompletionRate);
                const isFirst = i === 0;
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-[#2A2D35] last:border-0 cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.04)] ${
                      isFirst ? "bg-[rgba(230,57,70,0.06)]" : ""
                    }`}
                    onClick={() => window.location.href = `/coach/ecole/coachs/${c.id}`}
                  >
                    <td className="py-3 pr-3 text-[#6B7280] font-medium">{i + 1}</td>
                    <td className="py-3 pr-3">
                      <Link
                        href={`/coach/ecole/coachs/${c.id}`}
                        className="text-white font-medium hover:text-[#E63946] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-[#9CA3AF]">{c.sport}</td>
                    <td className="py-3 pr-3 text-center text-[#9CA3AF]">{c.athleteCount}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#2A2D35] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${c.profileCompletionRate}%`,
                              backgroundColor: pColor,
                            }}
                          />
                        </div>
                        <span className="text-[12px]" style={{ color: pColor }}>
                          {c.profileCompletionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-white font-semibold">
                      {c.recruiterViews30d}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-right">
          <Link
            href="/coach/ecole/coachs"
            className="text-[13px] text-[#E63946] hover:underline"
          >
            Voir tous les coachs &rarr;
          </Link>
        </div>
      </div>

      {/* ── Section 5: Recent activity ─────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-head text-[15px] font-bold text-white">
            Activit&eacute; r&eacute;cente
          </h3>
          <Link
            href="/coach/ecole/activites"
            className="text-[13px] text-[#E63946] hover:underline"
          >
            Voir tout &rarr;
          </Link>
        </div>

        <div className="space-y-0">
          {recentActivities.map((a) => (
            <Link
              key={a.id}
              href={activityHref(a)}
              className={`flex items-start gap-3 py-3 border-b border-[#2A2D35] last:border-0 cursor-pointer rounded-lg transition-colors duration-150 hover:bg-[rgba(255,255,255,0.04)] ${
                !a.isRead ? "border-l-[3px] border-l-[#E63946] pl-3" : ""
              } ${a.isHighlighted ? "bg-[rgba(230,57,70,0.06)] px-3 -mx-3 hover:bg-[rgba(230,57,70,0.10)]" : ""}`}
            >
              {activityIcon(a.type)}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#9CA3AF] leading-snug">
                  {activityText(a)}
                </p>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  {relativeTime(a.timestamp)}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
