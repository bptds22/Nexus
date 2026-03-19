"use client";

import { useState, useMemo } from "react";
import { PIPELINE_AGGREGATED, PIPELINE_RETIRED, PIPELINE_STAGE_DAYS, PIPELINE_BY_SCHOOL } from "@/lib/mock/admin";
import type { PipelineAggregated } from "@/lib/mock/admin";

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

export default function AdminPipelinePage() {
  const [typeFilter, setTypeFilter] = useState<"all" | "secondaire" | "cegep">("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  const schoolsForType = useMemo(() => {
    if (typeFilter === "all") return PIPELINE_BY_SCHOOL;
    return PIPELINE_BY_SCHOOL.filter((s) => s.type === typeFilter);
  }, [typeFilter]);

  // Active data based on filters
  const selectedSchool = schoolFilter !== "all" ? PIPELINE_BY_SCHOOL.find((s) => s.schoolId === schoolFilter) : null;

  const funnel: PipelineAggregated[] = selectedSchool ? selectedSchool.funnel : PIPELINE_AGGREGATED;
  const retired = selectedSchool ? selectedSchool.retired : PIPELINE_RETIRED;
  const stageDays = selectedSchool ? selectedSchool.stageDays : PIPELINE_STAGE_DAYS;
  const conversionRate = selectedSchool ? selectedSchool.conversionRate : 9.4;
  const conversionTrend = selectedSchool ? selectedSchool.conversionTrend : 2.1;

  const maxCount = funnel[0].count;
  const subtitle = selectedSchool
    ? `Saison 2025-2026 · ${selectedSchool.schoolName}`
    : "Saison 2025-2026 · Tous les recruteurs";

  const secCount = PIPELINE_BY_SCHOOL.filter((s) => s.type === "secondaire").length;
  const cegCount = PIPELINE_BY_SCHOOL.filter((s) => s.type === "cegep").length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Pipeline de recrutement — Vue globale</h1>
        <p className="text-[13px] text-[#6b7280] mt-1">{subtitle}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Type tabs */}
        <div className="flex gap-1 bg-[#111317] rounded-lg border border-[#2D3748] p-1">
          {([
            ["all", "Tous"] as const,
            ["secondaire", `Secondaires (${secCount})`] as const,
            ["cegep", `CÉGEPs (${cegCount})`] as const,
          ]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setTypeFilter(key); setSchoolFilter("all"); }}
              className="nx-pill-tab"
              data-active={typeFilter === key}
            >
              {label}
            </button>
          ))}
        </div>

        {/* School dropdown */}
        <select
          title="Établissement"
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className={selectBase + " min-w-[240px]"}
        >
          <option value="all">Tous les établissements</option>
          {schoolsForType.map((s) => (
            <option key={s.schoolId} value={s.schoolId}>{s.schoolName}</option>
          ))}
        </select>

        {/* Clear filter */}
        {schoolFilter !== "all" && (
          <button
            type="button"
            onClick={() => { setSchoolFilter("all"); setTypeFilter("all"); }}
            className="px-3 py-2 rounded-lg text-[12px] font-bold text-[#E63946] hover:bg-[#E63946]/10 transition-colors"
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Funnel */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Entonnoir de recrutement</p>
          {selectedSchool && (
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${selectedSchool.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
              {selectedSchool.type === "cegep" ? "CÉGEP" : "Secondaire"}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {funnel.map((stage, i) => {
            const widthPct = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 12) : 12;
            const next = funnel[i + 1];
            const convRate = next && stage.count > 0 ? Math.round((next.count / stage.count) * 100) : null;

            return (
              <div key={stage.status}>
                {/* Bar row */}
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-[#9CA3AF] w-[140px] shrink-0 text-right">{stage.label_fr}</span>
                  <div className="flex-1 relative">
                    <div
                      className="h-10 rounded-lg flex items-center px-4 transition-all"
                      style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                    >
                      <span className="text-[14px] font-head font-black text-white">{stage.count}</span>
                    </div>
                  </div>
                  <div className="w-[120px] shrink-0 flex items-center gap-2">
                    <span className="text-[13px] text-[#9CA3AF] font-bold">{stage.percentage}%</span>
                    {stage.trend > 0 ? (
                      <span className="text-[12px] text-[#22C55E] font-bold">↑{stage.trend}</span>
                    ) : stage.trend < 0 ? (
                      <span className="text-[12px] text-[#EF4444] font-bold">↓{Math.abs(stage.trend)}</span>
                    ) : (
                      <span className="text-[12px] text-[#6b7280] font-bold">—</span>
                    )}
                  </div>
                </div>

                {/* Conversion rate between stages */}
                {convRate !== null && (
                  <div className="flex items-center gap-4 py-1">
                    <span className="w-[140px]" />
                    <div className="flex items-center gap-2 pl-4">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
                      <span className="text-[11px] text-[#6b7280] font-bold">{convRate}% conversion</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Retired */}
        <div className="mt-6 pt-4 border-t border-[#2D3748]/50 flex items-center gap-4">
          <span className="text-[13px] font-bold text-[#9CA3AF] w-[140px] shrink-0 text-right">Retirés</span>
          <div className="flex items-center gap-3">
            <span className="text-[20px] font-head font-black text-[#EF4444]">{retired.count}</span>
            {retired.trend > 0 ? (
              <span className="text-[12px] text-[#EF4444] font-bold">↑{retired.trend}</span>
            ) : retired.trend < 0 ? (
              <span className="text-[12px] text-[#22C55E] font-bold">↓{Math.abs(retired.trend)}</span>
            ) : (
              <span className="text-[12px] text-[#6b7280] font-bold">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global conversion */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-4">Taux de conversion global</p>
          <p className="text-[56px] font-head font-black text-[#E63946] leading-none">{conversionRate}%</p>
          <p className="text-[14px] text-[#9CA3AF] mt-2">Identifiés → Lettre signée</p>
          <p className={`text-[13px] font-bold mt-1 ${conversionTrend >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
            {conversionTrend >= 0 ? "↑" : "↓"} {Math.abs(conversionTrend)} pts vs l&apos;an dernier
          </p>
        </div>

        {/* Time per stage */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-4">Temps moyen par étape</p>
          <div className="space-y-3">
            {stageDays.map((s) => (
              <div key={s.from} className="flex items-center justify-between py-2 border-b border-[#2D3748]/30 last:border-b-0">
                <span className="text-[13px] text-[#9CA3AF]">{s.from} → {s.to}</span>
                <span className="text-[14px] font-bold text-white">{s.days} jours</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* School comparison table (only when viewing all) */}
      {schoolFilter === "all" && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]">
          <div className="p-6 pb-4">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Comparaison par établissement</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D3748]">
                  {["Établissement", "Type", "Identifiés", "Contactés", "Discussion", "Visite", "Engagés", "Signés", "Retirés", "Conversion"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(typeFilter === "all" ? PIPELINE_BY_SCHOOL : PIPELINE_BY_SCHOOL.filter((s) => s.type === typeFilter)).map((s, i) => (
                  <tr
                    key={s.schoolId}
                    className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors cursor-pointer ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}
                    onClick={() => { setSchoolFilter(s.schoolId); setTypeFilter(s.type); }}
                  >
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-bold text-white hover:text-[#E63946] transition-colors">{s.schoolName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
                        {s.type === "cegep" ? "CÉGEP" : "Sec."}
                      </span>
                    </td>
                    {s.funnel.map((f) => (
                      <td key={f.status} className="px-4 py-3 text-[13px] font-bold text-white">{f.count}</td>
                    ))}
                    <td className="px-4 py-3 text-[13px] font-bold text-[#EF4444]">{s.retired.count}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[13px] font-bold ${s.conversionRate > 0 ? "text-[#22C55E]" : "text-[#6b7280]"}`}>
                        {s.conversionRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[12px] text-[#4B5563] text-center italic">Vue agrégée — les pipelines individuels sont gérés par chaque recruteur dans leur portail.</p>
    </div>
  );
}
