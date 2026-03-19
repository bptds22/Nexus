"use client";

import { useState, useMemo } from "react";
import KpiCard from "@/components/director/KpiCard";
import KpiCardRow from "@/components/director/KpiCardRow";
import {
  mockRecruitmentFunnel,
  mockRecruiterPerformance,
  mockCegepPipelineBySport,
  mockCegepCohortData,
  mockCegepTopTargets,
  mockCegepSeasonComparison,
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

/* ── Dark Recharts tooltip ───────────────────────────────── */

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

/* ── Funnel stage data ───────────────────────────────────── */

const funnel = mockRecruitmentFunnel;

const FUNNEL_STAGES = [
  { key: "identified",     label: "Identifiés",       value: funnel.identified,     color: "#6B7280" },
  { key: "contacted",      label: "Contactés",        value: funnel.contacted,      color: "#3B82F6" },
  { key: "in_discussion",  label: "En discussion",    value: funnel.in_discussion,  color: "#60A5FA" },
  { key: "visit_planned",  label: "Visite planifiée", value: funnel.visit_planned,  color: "#F59E0B" },
  { key: "engaged",        label: "Engagés",          value: funnel.engaged,        color: "#E63946" },
  { key: "signed",         label: "Signés",           value: funnel.signed,         color: "#E63946" },
];

/* ══════════════════════════════════════════════════════════════
   PAGE — Stats de recrutement
══════════════════════════════════════════════════════════════ */

export default function CegepStatsPage() {
  const [recruiterSort, setRecruiterSort] = useState<{ col: string; dir: "asc" | "desc" }>({ col: "signed", dir: "desc" });

  /* Sort recruiters */
  const sortedRecruiters = useMemo(() => {
    const copy = [...mockRecruiterPerformance];
    copy.sort((a, b) => {
      const aVal = a[recruiterSort.col as keyof typeof a] as number;
      const bVal = b[recruiterSort.col as keyof typeof b] as number;
      return recruiterSort.dir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return copy;
  }, [recruiterSort]);

  function toggleRecruiterSort(col: string) {
    setRecruiterSort((prev) =>
      prev.col === col
        ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "desc" }
    );
  }

  const sortArrow = (col: string) =>
    recruiterSort.col === col
      ? recruiterSort.dir === "asc" ? " ▲" : " ▼"
      : "";

  /* Sport breakdown totals */
  const sportData = mockCegepPipelineBySport;
  const sportTotals = sportData.reduce(
    (acc, s) => ({
      consulted: acc.consulted + s.consulted,
      favorited: acc.favorited + s.favorited,
      contacted: acc.contacted + s.contacted,
      recruited: acc.recruited + s.recruited,
    }),
    { consulted: 0, favorited: 0, contacted: 0, recruited: 0 },
  );

  /* Conversion rate */
  const conversionRate = funnel.identified > 0
    ? ((funnel.signed / funnel.identified) * 100).toFixed(1)
    : "0";

  return (
    <div className="px-5 sm:px-8 py-8 max-w-[1400px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1
          className="font-head font-black text-white"
          style={{ fontSize: "28px" }}
        >
          Statistiques de recrutement
        </h1>
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase bg-[#E63946]/15 text-[#E63946] px-3 py-1 rounded-full">
          CÉGEP Garneau
        </span>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 1 — Hero KPI Bar
      ══════════════════════════════════════════════════════════ */}
      <KpiCardRow>
        <KpiCard
          label="Athlètes découverts"
          value={funnel.identified}
          trend={18}
          trendLabel="vs l'an dernier"
          iconBgColor="rgba(107,114,128,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          }
        />
        <KpiCard
          label="Contacts initiés"
          value={funnel.contacted}
          trend={24}
          trendLabel="vs l'an dernier"
          iconBgColor="rgba(59,130,246,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
        />
        <KpiCard
          label="Visites planifiées"
          value={funnel.visit_planned}
          trend={50}
          trendLabel="vs l'an dernier"
          iconBgColor="rgba(245,158,11,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <KpiCard
          label="Lettres signées"
          value={funnel.signed}
          valueColor="#E63946"
          valueFontSize="48px"
          iconBgColor="rgba(230,57,70,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
        />
        <KpiCard
          label="Taux de conversion"
          value={`${conversionRate}%`}
          trend={2.1}
          trendLabel="pts"
          iconBgColor="rgba(34,197,94,0.15)"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
            </svg>
          }
        />
      </KpiCardRow>

      {/* ══════════════════════════════════════════════════════════
         SECTION 2 — Entonnoir de recrutement
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className="text-white font-head font-bold text-[16px] mb-6">
          Entonnoir de recrutement
        </h2>

        <div className="space-y-3">
          {FUNNEL_STAGES.map((stage, i) => {
            const widthPct = funnel.identified > 0 ? (stage.value / funnel.identified) * 100 : 0;
            const prevValue = i > 0 ? FUNNEL_STAGES[i - 1].value : null;
            const stageConversion = prevValue && prevValue > 0
              ? Math.round((stage.value / prevValue) * 100)
              : null;
            const dropOff = prevValue ? prevValue - stage.value : null;
            const overallPct = funnel.identified > 0
              ? ((stage.value / funnel.identified) * 100).toFixed(1)
              : "0";

            return (
              <div key={stage.key}>
                {i > 0 && dropOff !== null && stageConversion !== null && (
                  <div className="flex items-center gap-3 mb-1.5 ml-2">
                    <span className="text-[11px] text-[#6B7280]">
                      {stageConversion}% conversion
                    </span>
                    <span className="text-[10px] text-[#4a4d56]">
                      ({dropOff} retiré{dropOff > 1 ? "s" : ""})
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-medium text-[#e0e0e0] w-[130px] shrink-0">
                    {stage.label}
                  </span>
                  <div className="flex-1 h-7 rounded bg-[#2A2D35] overflow-hidden relative">
                    <div
                      className="h-full rounded transition-all duration-500 flex items-center justify-end pr-3"
                      style={{
                        width: `${Math.max(widthPct, 6)}%`,
                        backgroundColor: stage.color,
                        opacity: 0.85,
                      }}
                    >
                      {widthPct > 15 && (
                        <span className="text-[12px] font-bold text-white">
                          {stage.value}
                        </span>
                      )}
                    </div>
                    {widthPct <= 15 && (
                      <span className="absolute left-[calc(6%+8px)] top-1/2 -translate-y-1/2 text-[12px] font-bold text-white">
                        {stage.value}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px] text-[#6B7280] w-[50px] text-right shrink-0">
                    {overallPct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-[#2A2D35]">
          <p className="text-[13px] text-[#9CA3AF]">
            En moyenne, il faut{" "}
            <span className="text-white font-bold">{funnel.avg_contacts_to_sign} contacts</span>{" "}
            et{" "}
            <span className="text-white font-bold">{funnel.avg_visits_to_sign} visites</span>{" "}
            pour signer un athlète.{" "}
            <span className="text-[#6B7280]">
              (temps moyen : {funnel.avg_days_to_sign} jours)
            </span>
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 3 — Rendement par recruteur
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2 className="text-white font-head font-bold text-[16px]">
            Rendement par recruteur
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Recruteur</th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("identified")}>
                  Identifiés{sortArrow("identified")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("contacted")}>
                  Contactés{sortArrow("contacted")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("in_discussion")}>
                  En disc.{sortArrow("in_discussion")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("visits")}>
                  Visites{sortArrow("visits")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("signed")}>
                  Signés{sortArrow("signed")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("conversion_rate")}>
                  Taux{sortArrow("conversion_rate")}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:text-white transition-colors" onClick={() => toggleRecruiterSort("avg_days_to_sign")}>
                  Temps moy.{sortArrow("avg_days_to_sign")}
                </th>
                <th className="text-center px-4 py-3">Activité (7j)</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecruiters.map((r) => {
                const rateColor = r.conversion_rate >= 10 ? "#22C55E" : r.conversion_rate >= 5 ? "#F59E0B" : "#E63946";
                const daysColor = r.avg_days_to_sign <= 14 ? "#22C55E" : r.avg_days_to_sign <= 21 ? "#F59E0B" : "#E63946";
                const barW = Math.round(r.activity_7d * 100);

                return (
                  <tr key={r.recruiter_id} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/directeur-cegep/entraineurs/${r.recruiter_id}`}
                        className="text-[14px] font-semibold text-white hover:text-[#E63946] transition-colors"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.identified}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.contacted}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.in_discussion}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{r.visits}</td>
                    <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{r.signed}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-bold" style={{ color: rateColor }}>
                      {r.conversion_rate}%
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] font-bold" style={{ color: daysColor }}>
                      {r.avg_days_to_sign}j
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-20 h-2.5 rounded-full bg-[#2A2D35] overflow-hidden mx-auto">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barW}%`,
                            backgroundColor: barW >= 60 ? "#22C55E" : barW >= 30 ? "#F59E0B" : "#E63946",
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 4 — Recrutement par sport
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2128]">
          <h2 className="text-white font-head font-bold text-[16px]">
            Recrutement par sport
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Sport</th>
                <th className="text-right px-4 py-3">Consultés</th>
                <th className="text-right px-4 py-3">Favorisés</th>
                <th className="text-right px-4 py-3">Contactés</th>
                <th className="text-right px-4 py-3">Recrutés</th>
              </tr>
            </thead>
            <tbody>
              {sportData.map((s) => (
                <tr key={s.sport} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                  <td className="px-4 py-3 text-[14px] font-semibold text-white">{s.sport}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.consulted}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.favorited}</td>
                  <td className="px-4 py-3 text-right text-[13px] text-[#9CA3AF]">{s.contacted}</td>
                  <td className="px-4 py-3 text-right text-[14px] font-bold" style={{ color: s.recruited > 0 ? "#E63946" : "#6B7280" }}>
                    {s.recruited}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#2A2D35] bg-[#13151a]">
                <td className="px-4 py-3 text-[14px] font-bold text-white">Total</td>
                <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.consulted}</td>
                <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.favorited}</td>
                <td className="px-4 py-3 text-right text-[14px] font-bold text-white">{sportTotals.contacted}</td>
                <td className="px-4 py-3 text-right text-[14px] font-bold text-[#E63946]">{sportTotals.recruited}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 5 — Répartition par cohorte
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-head font-bold text-[16px]">
            Répartition par cohorte
          </h2>
          <div className="flex items-center gap-4">
            {[
              { label: "Identifiés", color: "#6B7280" },
              { label: "Contactés", color: "#F59E0B" },
              { label: "Signés", color: "#E63946" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[11px] text-[#6B7280]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={mockCegepCohortData}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <XAxis
              dataKey="year"
              tick={{ fill: "#9CA3AF", fontSize: 13, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6B7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="identified" name="Identifiés" fill="#6B7280" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="contacted" name="Contactés" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="signed" name="Signés" fill="#E63946" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 6 — Top 10 athlètes ciblés
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className="text-white font-head font-bold text-[16px] mb-5">
            Top 10 athlètes ciblés
          </h2>
          <div className="space-y-2">
            {mockCegepTopTargets.map((t) => {
              const fullStars = Math.floor(t.rating);
              const hasHalf = t.rating - fullStars >= 0.3;
              return (
                <div
                  key={t.athleteId}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                >
                  <span
                    className="text-[18px] font-head font-black w-[36px] shrink-0"
                    style={{ color: t.rank <= 3 ? "#E63946" : "#4a4d56" }}
                  >
                    #{t.rank}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-[#2A2D35] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/recruteur/athletes/${t.athleteId}`}
                      className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block"
                    >
                      {t.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-[#6B7280] truncate">
                        {t.sport} · {t.position} — {t.recruiterName}
                      </p>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < fullStars ? "#F59E0B" : (i === fullStars && hasHalf ? "url(#halfStar)" : "#374151")} stroke={i < fullStars ? "none" : "#F59E0B"} strokeWidth="1">
                            {i === fullStars && hasHalf && (
                              <defs>
                                <linearGradient id="halfStar">
                                  <stop offset="50%" stopColor="#F59E0B" />
                                  <stop offset="50%" stopColor="#374151" />
                                </linearGradient>
                              </defs>
                            )}
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                        <span className="text-[11px] text-[#9CA3AF] ml-1 font-semibold">{t.rating}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-1 rounded shrink-0 bg-[rgba(107,114,128,0.2)] text-[#9CA3AF]">
                    {t.pipelineStatus}
                  </span>
                </div>
              );
            })}
          </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
         SECTION 7 — Comparatif saisons
      ══════════════════════════════════════════════════════════ */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className="text-white font-head font-bold text-[16px] mb-5">
          Comparatif saisons
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-2" />
                <th className="text-right px-4 py-2">Cette saison</th>
                <th className="text-right px-4 py-2">Saison passée</th>
                <th className="text-right px-4 py-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {mockCegepSeasonComparison.map((row) => {
                const diff = row.current - row.previous;
                const isTime = row.metric === "Temps moyen";
                const isPositive = isTime ? diff < 0 : diff > 0;
                const pctChange = row.previous !== 0
                  ? Math.round(Math.abs(diff / row.previous) * 100)
                  : 0;
                const sign = isPositive ? (isTime ? "-" : "+") : (isTime ? "+" : "-");
                const deltaColor = isPositive ? "#22C55E" : "#E63946";

                return (
                  <tr key={row.metric} className="border-t border-[#2A2D35]">
                    <td className="px-4 py-3 text-[14px] font-semibold text-white">{row.metric}</td>
                    <td className="px-4 py-3 text-right text-[16px] font-bold text-white">
                      {row.current}{row.unit ? ` ${row.unit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-[14px] text-[#6B7280]">
                      {row.previous}{row.unit ? ` ${row.unit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-[14px] font-bold" style={{ color: deltaColor }}>
                      {sign}{pctChange}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
