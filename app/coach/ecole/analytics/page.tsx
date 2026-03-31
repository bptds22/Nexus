"use client";

import SchoolGate from "@/components/subscription/SchoolGate";
import { coachAnalytics } from "@/lib/mock/coach-analytics";

/* ═══════════════════════════════════════════════════════════════
   Coach Analytics — PRO feature
   Shows visibility metrics, CÉGEP interest, funnel, attention alerts.
═══════════════════════════════════════════════════════════════ */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

const SPORT_COLORS: Record<string, string> = {
  Football: "#3B82F6", Hockey: "#8B5CF6", Basketball: "#F97316",
  Volleyball: "#22C55E", Soccer: "#06B6D4",
};

const ATTENTION_STYLES: Record<string, { border: string; label: string; labelColor: string }> = {
  zero_views: { border: "border-l-[#EAB308]", label: "0 vues en 14+ jours", labelColor: "text-[#EAB308]" },
  incomplete: { border: "border-l-[#EF4444]", label: "Profil incomplet", labelColor: "text-[#EF4444]" },
  unverified: { border: "border-l-[#6B7280]", label: "Non vérifié depuis 30+ jours", labelColor: "text-[#9CA3AF]" },
  viewed_not_contacted: { border: "border-l-[#3B82F6]", label: "Vu mais pas contacté", labelColor: "text-[#3B82F6]" },
};

function TrendArrow({ trend, pct }: { trend: "up" | "down" | "flat"; pct: number }) {
  if (trend === "up") return <span className="text-[#22C55E] text-[11px] font-bold">↑ +{pct}%</span>;
  if (trend === "down") return <span className="text-[#E63946] text-[11px] font-bold">↓ {pct}%</span>;
  return <span className="text-[#6B7280] text-[11px] font-bold">→ {pct > 0 ? "+" : ""}{pct}%</span>;
}

export default function CoachAnalyticsWrapper() {
  return <SchoolGate><CoachAnalyticsPage /></SchoolGate>;
}

function CoachAnalyticsPage() {
  const d = coachAnalytics;
  const k = d.kpis;
  const funnel = d.funnel;
  const funnelSteps = [
    { label: "Créés", count: funnel.created },
    { label: "Vérifiés", count: funnel.verified },
    { label: "Vus", count: funnel.viewed },
    { label: "Favoris", count: funnel.favorited },
    { label: "Contactés", count: funnel.contacted },
    { label: "Discussion", count: funnel.in_discussion },
    { label: "Visite", count: funnel.visit_planned },
    { label: "Placés", count: funnel.placed },
  ];
  const maxFunnel = funnelSteps[0].count;
  const placementRate = maxFunnel > 0 ? Math.round((funnel.placed / maxFunnel) * 100) : 0;

  const maxWeekly = Math.max(...d.views_weekly, 1);
  const maxSportViews = Math.max(...d.sports_breakdown.views.map((s) => s.views), 1);
  const maxSportCount = Math.max(...d.sports_breakdown.athletes.map((s) => s.count), 1);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Analytique</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Performance de visibilité de tes athlètes — 30 derniers jours</p>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { val: k.views_30d, lbl: "Vues totales (30j)", trend: `+${k.views_trend}%`, trendColor: "#22C55E",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> },
          { val: k.favorites_30d, lbl: "Ajouts favoris (30j)", trend: `+${k.favorites_trend}`, trendColor: "#22C55E",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
          { val: k.contacts_30d, lbl: "Contacts reçus (30j)", trend: `+${k.contacts_trend}`, trendColor: "#22C55E",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
          { val: `${k.visibility_rate}%`, lbl: "Taux de visibilité", trend: `${k.athletes_with_views}/${k.total_athletes} vus`, trendColor: "#6B7280",
            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
        ].map((c, i) => (
          <div key={i} className="group bg-[#1A1D24] rounded-xl border border-[#1e2128] hover:border-[#E63946]/20 p-5 relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            <div className="w-9 h-9 rounded-full bg-[#E63946]/15 flex items-center justify-center mb-3">{c.icon}</div>
            <p className="font-head font-black text-[28px] text-white leading-none">{c.val}</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6B7280] mt-1">{c.lbl}</p>
            <p className="text-[10px] mt-1" style={{ color: c.trendColor }}>{c.trend}</p>
          </div>
        ))}
      </div>

      {/* ── Section 2: Views trend chart ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Vues de tes athlètes — 12 dernières semaines</h2>
        <div className="flex items-end gap-1.5 h-[140px]">
          {d.views_weekly.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[#6B7280]">{val}</span>
              <div className="w-full rounded-t-sm bg-[#E63946]" style={{ height: `${(val / maxWeekly) * 110}px`, minHeight: 4 }} />
              <span className="text-[8px] text-[#4a4d56]">S{i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Athlete performance table ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Performance par athlète</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Athlète</th>
                <th className="py-2 pr-3">Pos.</th>
                <th className="py-2 pr-3">Grad</th>
                <th className="py-2 pr-3">Profil</th>
                <th className="py-2 pr-3">Vues</th>
                <th className="py-2 pr-3">Tend.</th>
                <th className="py-2 pr-3">Favoris</th>
                <th className="py-2">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {d.athlete_performance.map((a, i) => {
                const compColor = a.completion >= 70 ? "#3B82F6" : a.completion >= 40 ? "#6B7280" : "#EF4444";
                return (
                  <tr key={i} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                    <td className="py-2.5 pr-3 text-[12px] text-[#6B7280]">{i + 1}</td>
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{a.name}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.pos}</td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.grad}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-[#2A2D35] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${a.completion}%`, backgroundColor: compColor }} /></div>
                        <span className="text-[11px] font-bold" style={{ color: compColor }}>{a.completion}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{a.views}</td>
                    <td className="py-2.5 pr-3"><TrendArrow trend={a.trend} pct={a.trend_pct} /></td>
                    <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{a.favorites}</td>
                    <td className="py-2.5 text-[12px]" style={{ color: a.contacts > 0 ? "#22C55E" : "#6B7280" }}>{a.contacts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: CÉGEPs interested ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Quels CÉGEPs regardent tes athlètes?</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#4a4d56]">
                <th className="py-2 pr-3">CÉGEP</th>
                <th className="py-2 pr-3">Vues</th>
                <th className="py-2 pr-3">Sports</th>
                <th className="py-2 pr-3">Athlètes vus</th>
                <th className="py-2">Dernier accès</th>
              </tr>
            </thead>
            <tbody>
              {d.cegeps_interested.map((c, i) => (
                <tr key={i} className="border-t border-[#1e2128] hover:bg-[#22262E] transition-colors">
                  <td className="py-2.5 pr-3 text-[13px] font-bold text-white">{c.name}</td>
                  <td className="py-2.5 pr-3 text-[13px] font-bold text-[#E63946]">{c.views}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex gap-1">{c.sports.map((s) => <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-[#9CA3AF]">{s}</span>)}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-[12px] text-[#9CA3AF]">{c.athletes_viewed}</td>
                  <td className="py-2.5 text-[12px] text-[#6B7280]">{c.last_access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Recruitment funnel ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Entonnoir de recrutement</h2>
        <div className="space-y-2">
          {funnelSteps.map((step, i) => {
            const widthPct = maxFunnel > 0 ? Math.max((step.count / maxFunnel) * 100, 8) : 8;
            const convPct = i > 0 && funnelSteps[i - 1].count > 0 ? Math.round((step.count / funnelSteps[i - 1].count) * 100) : null;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="text-[11px] text-[#9CA3AF] w-20 text-right shrink-0">{step.label}</span>
                <div className="flex-1 h-7 rounded overflow-hidden" style={{ width: `${widthPct}%` }}>
                  <div className="h-full rounded flex items-center px-3" style={{ background: "linear-gradient(90deg, #E63946 0%, #F06570 100%)" }}>
                    <span className="text-[11px] font-bold text-white">{step.count}</span>
                  </div>
                </div>
                {convPct !== null && (
                  <span className="text-[10px] text-[#6B7280] w-10 shrink-0">{convPct}%</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[13px] text-[#9CA3AF] mt-4 pt-3 border-t border-[#1e2128]">
          <span className="font-bold text-white">{placementRate}%</span> de tes athlètes ont été placés cette saison
        </p>
      </div>

      {/* ── Section 6: Attention needed ── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
        <h2 className={`${label} text-[#6B7280] mb-4`}>Athlètes qui ont besoin d&apos;attention</h2>
        <div className="space-y-3">
          {d.attention_needed.map((a, i) => {
            const style = ATTENTION_STYLES[a.type];
            return (
              <div key={i} className={`bg-[#111317] rounded-lg border-l-4 ${style.border} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-bold text-white">{a.name}</span>
                      <span className="text-[11px] text-[#6B7280]">{a.pos} · {a.grad}</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${style.labelColor}`}>{style.label}</span>
                    <p className="text-[12px] text-[#9CA3AF] mt-1">{a.detail}</p>
                    {a.missing && <p className="text-[11px] text-[#6B7280] mt-0.5">Manque : {a.missing}</p>}
                  </div>
                  <button type="button" className="shrink-0 text-[11px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors whitespace-nowrap">
                    Améliorer le profil →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 7: Sport breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Athletes by sport */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className={`${label} text-[#6B7280] mb-4`}>Athlètes par sport</h2>
          <div className="space-y-3">
            {d.sports_breakdown.athletes.map((s) => (
              <div key={s.sport}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{s.sport}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{s.count} ({s.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.count / maxSportCount) * 100}%`, backgroundColor: SPORT_COLORS[s.sport] || "#6B7280" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Views by sport */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
          <h2 className={`${label} text-[#6B7280] mb-4`}>Vues par sport</h2>
          <div className="space-y-3">
            {d.sports_breakdown.views.map((s) => (
              <div key={s.sport}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-white">{s.sport}</span>
                  <span className="text-[12px] text-[#9CA3AF]">{s.views} vues ({s.percent}%)</span>
                </div>
                <div className="w-full h-2 bg-[#2A2D35] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.views / maxSportViews) * 100}%`, backgroundColor: SPORT_COLORS[s.sport] || "#6B7280" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
