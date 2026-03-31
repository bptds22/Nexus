"use client";

import { useState, useCallback } from "react";
import SchoolGate from "@/components/subscription/SchoolGate";
import {
  mockRecruitmentStatsBySport,
  mockInterestedCegeps,
  mockCohortData,
  mockTopAthletes,
} from "@/lib/mock";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/* ── helpers ─────────────────────────────────────────────── */

const SPORTS_LIST = [
  "Tous",
  ...Array.from(new Set(mockRecruitmentStatsBySport.map((s) => s.sport))),
];

type Period = "2025-2026" | "2024-2025" | "2023-2024";
const PERIODS: { value: Period; label: string }[] = [
  { value: "2025-2026", label: "2025-2026" },
  { value: "2024-2025", label: "2024-2025" },
  { value: "2023-2024", label: "2023-2024" },
];

/* ── page ────────────────────────────────────────────────── */

export default function StatsPageWrapper() {
  return <SchoolGate><StatsPage /></SchoolGate>;
}

function StatsPage() {
  const [period, setPeriod] = useState<Period>("2025-2026");
  const [sportFilter, setSportFilter] = useState("Tous");
  const [toast, setToast] = useState(false);

  const handleExport = useCallback(() => {
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }, []);

  /* filtered data */
  const stats =
    sportFilter === "Tous"
      ? mockRecruitmentStatsBySport
      : mockRecruitmentStatsBySport.filter((s) => s.sport === sportFilter);

  const totals = stats.reduce(
    (acc, s) => ({
      athletes: acc.athletes + s.athletes,
      profilesCompleted: acc.profilesCompleted + s.profilesCompleted,
      views: acc.views + s.views,
      contacts: acc.contacts + s.contacts,
      placements: acc.placements + s.placements,
    }),
    { athletes: 0, profilesCompleted: 0, views: 0, contacts: 0, placements: 0 },
  );

  const selectClass =
    "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Toast ───────────────────────────────────────── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1A1D24] border border-[#E63946] text-white text-[13px] px-5 py-3 rounded-lg shadow-lg animate-fade-in">
          Export en cours...
        </div>
      )}

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1
          className="text-[22px] font-bold uppercase tracking-wide text-white"
          style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
        >
          Statistiques de recrutement
        </h1>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 border border-[#E63946] text-[#E63946] rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-[#E63946] hover:text-white transition-colors"
        >
          {/* download icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            />
          </svg>
          Exporter en PDF
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className={selectClass}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className={selectClass}
        >
          {SPORTS_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* ── Section 1: Par sport ────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-white font-semibold text-[15px]">
            Statistiques par sport
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">Sport</th>
                <th className="text-left px-4 py-3">Athlètes</th>
                <th className="text-left px-4 py-3">Profils complétés</th>
                <th className="text-left px-4 py-3">Vues</th>
                <th className="text-left px-4 py-3">Contacts</th>
                <th className="text-left px-4 py-3">Placements</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => {
                const pct =
                  s.athletes > 0
                    ? Math.round((s.profilesCompleted / s.athletes) * 100)
                    : 0;
                return (
                  <tr
                    key={s.sport}
                    className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] text-white font-medium">
                      {s.sport}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {s.athletes}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {s.profilesCompleted} ({pct}%)
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {s.views}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                      {s.contacts}
                    </td>
                    <td
                      className={`px-4 py-3 text-[13px] font-bold ${
                        s.placements > 0 ? "text-[#E63946]" : "text-[#6B7280]"
                      }`}
                    >
                      {s.placements}
                    </td>
                  </tr>
                );
              })}

              {/* totals */}
              <tr className="bg-[#22262E] border-t border-[#1e2128]">
                <td className="px-4 py-3 text-[13px] text-white font-bold">
                  Total
                </td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">
                  {totals.athletes}
                </td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">
                  {totals.profilesCompleted} (
                  {totals.athletes > 0
                    ? Math.round(
                        (totals.profilesCompleted / totals.athletes) * 100,
                      )
                    : 0}
                  %)
                </td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">
                  {totals.views}
                </td>
                <td className="px-4 py-3 text-[13px] text-white font-bold">
                  {totals.contacts}
                </td>
                <td
                  className={`px-4 py-3 text-[13px] font-bold ${
                    totals.placements > 0 ? "text-[#E63946]" : "text-[#6B7280]"
                  }`}
                >
                  {totals.placements}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 2: CÉGEPs intéressés ───────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-white font-semibold text-[15px]">
            CÉGEPs intéressés
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-[#13151a] text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280]">
                <th className="text-left px-4 py-3">CÉGEP</th>
                <th className="text-left px-4 py-3">Vues</th>
                <th className="text-left px-4 py-3">Sports regardés</th>
              </tr>
            </thead>
            <tbody>
              {mockInterestedCegeps.slice(0, 10).map((c) => (
                <tr
                  key={c.cegep}
                  className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors"
                >
                  <td className="px-4 py-3 text-[13px] text-white font-medium">
                    {c.cegep}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                    {c.views}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">
                    {c.sports.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mockInterestedCegeps.length > 10 && (
          <div className="px-5 py-3 border-t border-[#1e2128]">
            <button className="text-[13px] text-[#E63946] hover:underline">
              Voir la liste complète
            </button>
          </div>
        )}
      </div>

      {/* ── Section 3: Par cohorte (bar chart) ──────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-white font-semibold text-[15px]">
            Répartition par cohorte
          </h2>
        </div>
        <div className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={mockCohortData}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="year"
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={{ stroke: "#2a2d36" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#9CA3AF", fontSize: 12 }}
                axisLine={{ stroke: "#2a2d36" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#13151a",
                  border: "1px solid #2a2d36",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#e0e0e0",
                }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Legend
                verticalAlign="top"
                wrapperStyle={{ fontSize: 12, color: "#9CA3AF", paddingBottom: 8 }}
              />
              <Bar
                dataKey="profiles"
                name="Profils"
                fill="#6B7280"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="viewed"
                name="Vus"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="placed"
                name="Placés"
                fill="#E63946"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 4: Top 10 athlètes ─────────────────── */}
      <div>
        <h2 className="text-white font-semibold text-[15px] mb-4">
          Top 10 — Athlètes les plus consultés ({period})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mockTopAthletes
            .filter((a) => a.season === period)
            .slice(0, 10)
            .map((a, i) => (
            <div
              key={a.id}
              className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-4 flex items-center gap-4"
            >
              {/* rank */}
              <span
                className="text-[24px] font-bold min-w-[32px] text-center"
                style={{ color: i === 0 ? "#F59E0B" : "#ffffff" }}
              >
                #{i + 1}
              </span>

              {/* avatar placeholder */}
              <div className="w-10 h-10 rounded-full bg-[#2A2D35] flex-shrink-0" />

              {/* info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-[14px] truncate">
                  {a.name}
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  {a.sport} · {a.position}
                </p>
              </div>

              {/* views */}
              <span
                className="text-[#E63946] font-bold text-[18px] flex-shrink-0"
                style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
              >
                {a.views}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
