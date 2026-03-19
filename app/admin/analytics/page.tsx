"use client";

import { useState, useMemo } from "react";
import { ANALYTICS, ANALYTICS_BY_SCHOOL } from "@/lib/mock/admin";

const selectBase = "bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none focus:border-[#E63946]/50";

export default function AdminAnalyticsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "secondaire" | "cegep">("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");

  function showToast() { setToast("Action simulée — POC"); setTimeout(() => setToast(null), 3000); }

  const schoolsForType = useMemo(() => {
    if (typeFilter === "all") return ANALYTICS_BY_SCHOOL;
    return ANALYTICS_BY_SCHOOL.filter((s) => s.type === typeFilter);
  }, [typeFilter]);

  const selected = schoolFilter !== "all" ? ANALYTICS_BY_SCHOOL.find((s) => s.schoolId === schoolFilter) : null;

  // Resolved data
  const d = selected ?? ANALYTICS;
  const maxMonthly = Math.max(...d.monthly_signups.flatMap((m) => [m.coaches, m.recruiters]), 1);
  const totalViews = d.top_sports.reduce((s, sp) => s + sp.views, 0);

  const secCount = ANALYTICS_BY_SCHOOL.filter((s) => s.type === "secondaire").length;
  const cegCount = ANALYTICS_BY_SCHOOL.filter((s) => s.type === "cegep").length;

  const subtitle = selected
    ? `Saison 2025-2026 · ${selected.schoolName}`
    : "Saison 2025-2026";

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Analytique plateforme</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{subtitle}</p>
        </div>
        <button type="button" onClick={showToast} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-bold text-[13px] uppercase tracking-wider hover:text-white hover:border-[#E63946]/40 transition-colors">
          Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
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

      {/* Conversion funnel */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Entonnoir de conversion</p>
          {selected && (
            <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${selected.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
              {selected.type === "cegep" ? "CÉGEP" : "Secondaire"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {d.conversion_funnel.map((step, i) => (
            <div key={step.step} className="flex items-center gap-2 shrink-0">
              <div className="text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">{step.count}</p>
                <p className="text-[11px] text-[#6b7280] font-bold mt-1 whitespace-nowrap">{step.step}</p>
                <p className="text-[10px] text-[#9CA3AF]">{step.rate}%</p>
              </div>
              {i < d.conversion_funnel.length - 1 && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Response metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
          <p className="text-[48px] font-head font-black text-[#22C55E] leading-none">{d.response_rate}%</p>
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">Taux de réponse</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">des demandes de contact reçoivent une réponse</p>
        </div>
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
          <p className="text-[48px] font-head font-black text-white leading-none">{d.avg_response_time_hours}h</p>
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">Temps moyen de réponse</p>
          <p className="text-[13px] text-[#9CA3AF] mt-1">délai moyen première réponse coach</p>
        </div>
      </div>

      {/* Top sports */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <div className="p-5 border-b border-[#2D3748]">
          <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Sports les plus actifs</p>
        </div>
        <table className="w-full text-left">
          <thead><tr className="border-b border-[#2D3748]">
            {["Sport", "Athlètes", "Vues (30j)", "% du total"].map((h) => <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>)}
          </tr></thead>
          <tbody>
            {d.top_sports.map((sp, i) => (
              <tr key={sp.sport} className={`border-b border-[#2D3748]/40 ${i === 0 ? "border-l-2 border-l-[#E63946]" : ""}`}>
                <td className="px-5 py-3 text-[14px] font-bold text-white">{sp.sport}</td>
                <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{sp.athletes}</td>
                <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{sp.views.toLocaleString()}</td>
                <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{totalViews > 0 ? Math.round((sp.views / totalViews) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top CÉGEPs — only when viewing all or cegep type */}
      {!selected && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
          <div className="p-5 border-b border-[#2D3748]">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">CÉGEPs les plus engagés</p>
          </div>
          <table className="w-full text-left">
            <thead><tr className="border-b border-[#2D3748]">
              {["CÉGEP", "Contacts initiés", "Lettres signées", "Taux conversion"].map((h) => <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>)}
            </tr></thead>
            <tbody>
              {ANALYTICS.top_cegeps.map((c) => (
                <tr key={c.name} className="border-b border-[#2D3748]/40">
                  <td className="px-5 py-3 text-[14px] font-bold text-white">{c.name}</td>
                  <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{c.contacts}</td>
                  <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{c.signed}</td>
                  <td className="px-5 py-3 text-[14px] text-[#9CA3AF]">{c.contacts > 0 ? Math.round((c.signed / c.contacts) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparison table — when no school selected */}
      {!selected && (
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
          <div className="p-5 border-b border-[#2D3748]">
            <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">Comparaison par établissement</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-[#2D3748]">
                {["Établissement", "Type", "Taux réponse", "Temps réponse", "Athlètes", "Vues (30j)", "Contactés"].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280]">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(typeFilter === "all" ? ANALYTICS_BY_SCHOOL : ANALYTICS_BY_SCHOOL.filter((s) => s.type === typeFilter)).map((s, i) => {
                  const totalAthletes = s.top_sports.reduce((acc, sp) => acc + sp.athletes, 0);
                  const totalSchoolViews = s.top_sports.reduce((acc, sp) => acc + sp.views, 0);
                  const contacted = s.conversion_funnel.find((f) => f.step === "Contacté");
                  return (
                    <tr
                      key={s.schoolId}
                      className={`border-b border-[#2D3748]/40 hover:bg-white/[0.03] transition-colors cursor-pointer ${i % 2 === 0 ? "bg-[#1A1D24]" : "bg-[#111317]/50"}`}
                      onClick={() => { setSchoolFilter(s.schoolId); setTypeFilter(s.type); }}
                    >
                      <td className="px-5 py-3 text-[13px] font-bold text-white hover:text-[#E63946] transition-colors">{s.schoolName}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.type === "cegep" ? "bg-[#A855F7]/15 text-[#A855F7]" : "bg-[#3B82F6]/15 text-[#3B82F6]"}`}>
                          {s.type === "cegep" ? "CÉGEP" : "Sec."}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[13px] font-bold text-[#22C55E]">{s.response_rate}%</td>
                      <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">{s.avg_response_time_hours}h</td>
                      <td className="px-5 py-3 text-[13px] text-white font-bold">{totalAthletes}</td>
                      <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">{totalSchoolViews.toLocaleString()}</td>
                      <td className="px-5 py-3 text-[13px] text-[#9CA3AF]">{contacted?.count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly trends chart */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6">
        <p className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-6">Inscriptions mensuelles — 6 derniers mois</p>
        <div className="flex items-end gap-4 h-[200px]">
          {d.monthly_signups.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-1 items-end w-full justify-center" style={{ height: 180 }}>
                <div className="w-5 bg-[#3B82F6] rounded-t transition-all" style={{ height: `${(m.coaches / maxMonthly) * 100}%` }} />
                <div className="w-5 bg-[#A855F7] rounded-t transition-all" style={{ height: `${(m.recruiters / maxMonthly) * 100}%` }} />
              </div>
              <span className="text-[10px] text-[#6b7280] font-bold">{m.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <span className="flex items-center gap-2 text-[11px] text-[#9CA3AF]"><span className="w-3 h-3 rounded-sm bg-[#3B82F6]" /> Coachs</span>
          <span className="flex items-center gap-2 text-[11px] text-[#9CA3AF]"><span className="w-3 h-3 rounded-sm bg-[#A855F7]" /> Recruteurs</span>
        </div>
      </div>

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
