"use client";

import React from "react";
import KpiCard from "@/components/director/KpiCard";
import KpiCardRow from "@/components/director/KpiCardRow";
import {
  mockCegepDashboardStats,
  mockCegepPipelineBySport,
  mockCegepRegions,
  mockTrainerOverviews,
  mockDirectorActivitiesCegep,
} from "@/lib/mock";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";

/* ── Helpers ──────────────────────────────────────────────── */

function relativeTime(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "hier";
  if (diffD < 30) return `il y a ${diffD}j`;
  const diffM = Math.floor(diffD / 30);
  return `il y a ${diffM} mois`;
}

/* ── Activity icon + text (SVG line icons, matches HS dashboard) ── */

import type { DirectorActivity } from "@/lib/types/models";

function activityIcon(type: DirectorActivity["type"]): React.ReactNode {
  const base = "w-8 h-8 rounded-full flex items-center justify-center shrink-0";
  switch (type) {
    case "recruit_confirmed":
    case "letter_of_intent":
      return (
        <span className={`${base} bg-[rgba(230,57,70,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </span>
      );
    case "new_favorite":
      return (
        <span className={`${base} bg-[rgba(230,57,70,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </span>
      );
    case "message_sent":
      return (
        <span className={`${base} bg-[rgba(34,197,94,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </span>
      );
    case "recruiter_inactive":
      return (
        <span className={`${base} bg-[rgba(245,158,11,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
      );
    case "recruiter_joined":
      return (
        <span className={`${base} bg-[rgba(59,130,246,0.15)]`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
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

function CegepAthleteLink({ id, name }: { id?: string; name?: string }) {
  if (!name) return null;
  if (!id) return <span className="text-white font-medium">{name}</span>;
  return (
    <Link
      href={`/directeur-cegep/athletes/${id}`}
      className="text-white font-medium hover:text-[#E63946] transition-colors underline decoration-transparent hover:decoration-[#E63946]"
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

function activityText(a: DirectorActivity): React.ReactNode {
  switch (a.type) {
    case "recruit_confirmed":
    case "letter_of_intent":
      return (
        <>
          <CegepAthleteLink id={a.athleteId} name={a.athleteName} />{" "}
          a signé sa lettre d&apos;intention pour{" "}
          <span className="text-white font-medium">{a.sportName}</span>
        </>
      );
    case "new_favorite":
      return (
        <>
          <span className="text-white font-medium">{a.recruiterName}</span>{" "}
          a ajouté <CegepAthleteLink id={a.athleteId} name={a.athleteName} /> à ses favoris
        </>
      );
    case "message_sent":
      return (
        <>
          <span className="text-white font-medium">{a.recruiterName}</span>{" "}
          a contacté le coach de{" "}
          <CegepAthleteLink id={a.athleteId} name={a.athleteName} />
        </>
      );
    case "recruiter_inactive":
      return (
        <>
          <span className="text-white font-medium">{a.recruiterName}</span>{" "}
          ne s&apos;est pas connecté depuis {a.daysInactive} jours
        </>
      );
    case "recruiter_joined":
      return (
        <>
          <span className="text-white font-medium">{a.recruiterName}</span>{" "}
          a rejoint la plateforme
        </>
      );
    default:
      return <span>{a.type}</span>;
  }
}

/* ── Provenance donut ─────────────────────────────────────── */

const totalRecruits = mockCegepRegions.reduce((s, r) => s + r.count, 0);
const DONUT_COLORS = ["#E63946", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"];

function DonutChart({ data, colors, total }: { data: { region: string; count: number }[]; colors: string[]; total: number }) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerR = 52;

  // Build arc segments
  let cumAngle = -90; // start at top
  const segments = data.map((d, i) => {
    const angle = (d.count / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    return { ...d, startAngle, endAngle, color: colors[i % colors.length] };
  });

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number, rOuter: number, rInner: number) {
    const s1 = polarToXY(startDeg, rOuter);
    const e1 = polarToXY(endDeg, rOuter);
    const s2 = polarToXY(endDeg, rInner);
    const e2 = polarToXY(startDeg, rInner);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M${s1.x},${s1.y} A${rOuter},${rOuter} 0 ${large} 1 ${e1.x},${e1.y} L${s2.x},${s2.y} A${rInner},${rInner} 0 ${large} 0 ${e2.x},${e2.y} Z`;
  }

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {segments.map((seg, i) => (
          <path
            key={i}
            d={arcPath(seg.startAngle, seg.endAngle, outerR, innerR)}
            fill={seg.color}
            className="transition-opacity duration-200 hover:opacity-80"
            stroke="#1A1D24"
            strokeWidth="2"
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="28" fontWeight="900" fontFamily="var(--wl-font-head)">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#6B7280" fontSize="11">
          recrues
        </text>
      </svg>
      {/* Legend */}
      <div className="space-y-2.5 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[12px] text-[#9CA3AF] truncate flex-1">{seg.region}</span>
            <span className="text-[13px] font-bold text-white">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recruiter bar data (sorted desc) ─────────────────────── */

const recruiterBarData = [...mockTrainerOverviews]
  .map((t) => ({
    short: `${t.firstName.charAt(0)}. ${t.lastName}`,
    name: `${t.firstName} ${t.lastName}`,
    messages: t.messagesSent30d,
  }))
  .sort((a, b) => b.messages - a.messages);

/* ── Custom Recharts Tooltip (matches HS dashboard) ────────── */

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1D24] border border-[#2A2D35] rounded-lg px-3 py-2 text-[12px] shadow-lg">
      {label && <p className="text-[#9CA3AF] mb-0.5">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-white font-bold">
          {p.name ? `${p.name}: ` : ""}{p.value}
        </p>
      ))}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────── */

export default function DirecteurCegepDashboardPage() {
  const stats = mockCegepDashboardStats;
  const recentActivities = mockDirectorActivitiesCegep.slice(0, 5);

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1
          className="font-head font-black text-white"
          style={{ fontSize: "28px" }}
        >
          Tableau de bord
        </h1>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase bg-[#E63946]/15 text-[#E63946] px-3 py-1 rounded-full">
          CÉGEP Garneau
        </span>
      </div>

      {/* ── Section 1: KPI Cards ────────────────────────────── */}
      <KpiCardRow>
        {/* 1. Recrues confirmées — boss number */}
        <KpiCard
          label="Recrues confirmées"
          value={stats.recruitsConfirmed ?? 0}
          valueFontSize="48px"
          valueColor="#E63946"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E63946"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
              <path d="M12 3v12" />
              <path d="M5 21h14" />
              <circle cx="12" cy="3" r="2" />
            </svg>
          }
        />

        {/* 2. Athlètes dans le pipeline */}
        <KpiCard
          label="Athlètes dans le pipeline"
          value={stats.activePipeline ?? 0}
          valueColor="#E63946"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E63946"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          }
        />

        {/* 3. Messages envoyés (30j) */}
        <KpiCard
          label="Messages envoyés (30j)"
          value={stats.messagesSent30d ?? 0}
          valueColor="#22C55E"
          iconBgColor="rgba(34,197,94,0.15)"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22C55E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />

        {/* 4. Profils consultés (30j) */}
        <KpiCard
          label="Profils consultés (30j)"
          value={stats.profilesViewed30d ?? 0}
          iconBgColor="rgba(255,255,255,0.1)"
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
      </KpiCardRow>

      {/* ── Section 2: Charts ───────────────────────────────── */}

      {/* Chart 1 — Pipeline par sport (horizontal stacked bar) */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-head font-bold text-[15px]">
            Pipeline par sport
          </h2>
          <div className="flex items-center gap-4">
            {[
              { label: "Consultés", color: "#6B7280" },
              { label: "Favorisés", color: "#3B82F6" },
              { label: "Contactés", color: "#F59E0B" },
              { label: "Recrutés", color: "#E63946" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[11px] text-[#6B7280]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={mockCegepPipelineBySport}
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
            <Bar dataKey="consulted" name="Consultés" stackId="a" fill="#6B7280" radius={[0, 0, 0, 0]} barSize={18} />
            <Bar dataKey="favorited" name="Favorisés" stackId="a" fill="#3B82F6" />
            <Bar dataKey="contacted" name="Contactés" stackId="a" fill="#F59E0B" />
            <Bar dataKey="recruited" name="Recrutés" stackId="a" fill="#E63946" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2 + 3 — two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 2 — Activité des recruteurs (vertical bar) */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-white font-head font-bold text-[15px] mb-5">
            Activité des recruteurs (30j)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={recruiterBarData}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <XAxis
                dataKey="short"
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: "#6B7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<DarkTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ""}
              />
              <Bar
                dataKey="messages"
                name="Messages"
                fill="#E63946"
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Provenance des recrues (donut) */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-white font-head font-bold text-[15px] mb-5">
            Provenance des recrues
          </h2>
          <DonutChart data={mockCegepRegions} colors={DONUT_COLORS} total={totalRecruits} />
        </div>
      </div>

      {/* ── Section 3: Activité récente ─────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-head font-bold text-[16px]">
            Activité récente
          </h2>
          <Link
            href="/directeur-cegep/activites"
            className="text-[13px] text-[#E63946] hover:text-[#D93C3C] font-semibold transition-colors"
          >
            Voir tout →
          </Link>
        </div>
        <div className="space-y-0">
          {recentActivities.map((a) => (
            <Link
              key={a.id}
              href={a.ctaRoute || "/directeur-cegep/activites"}
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
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
