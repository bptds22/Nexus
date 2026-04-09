import Link from "next/link";
import type { RecruiterKpiData } from "../../_data/mockDashboardData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";
import { StatusIcon } from "../../_components/RecruitmentStatusBadge";

/* ─────────────────────────────────────────────────────────────────
   Zone 2 — PIPELINE + METRICS
   Unified view: pipeline funnel + compact messaging stats.
───────────────────────────────────────────────────────────────── */

const PIPELINE_STATUSES: RecruitmentStatus[] = [
  "identifie", "contacte", "en_discussion", "visite_planifiee", "engage", "lettre_signee",
];

export default function KpiCards({ data, pipelineCounts }: { data: RecruiterKpiData; pipelineCounts?: Record<string, number> }) {
  const counts = (pipelineCounts || {}) as Record<RecruitmentStatus, number>;
  const totalActive = PIPELINE_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);

  return (
    <div className="space-y-4">

      {/* ── Pipeline Funnel ─────────────────────────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Pipeline de recrutement</h2>
          <Link href="/recruteur/pipeline" className="text-[12px] font-bold text-[#E63946] hover:text-[#60A5FA] transition-colors flex items-center gap-1">
            Voir tout
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Status cards row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STATUSES.map((status, i) => {
            const cfg = getStatusConfig(status);
            const count = counts[status] || 0;
            const isCommitment = cfg.phase === "commitment";

            return (
              <Link
                key={status}
                href={`/recruteur/pipeline?stage=${status.toUpperCase()}`}
                className="relative group rounded-lg border p-3 text-center transition-all hover:-translate-y-0.5 cursor-pointer hover:brightness-110"
                style={{
                  borderColor: count > 0 ? (isCommitment ? "rgba(230,51,41,0.3)" : "rgba(107,114,128,0.25)") : "#2D3748",
                  background: count > 0 ? (isCommitment ? "rgba(230,51,41,0.06)" : "rgba(107,114,128,0.05)") : "transparent",
                }}
              >
                {/* Connector arrow between cards (hidden on first) */}
                {i > 0 && (
                  <div className="hidden lg:block absolute -left-2 top-1/2 -translate-y-1/2 text-[#2D3748]">
                    <svg width="7" height="10" viewBox="0 0 7 10" fill="none">
                      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="flex justify-center mb-2">
                  <StatusIcon icon={cfg.icon} color={count > 0 ? cfg.color : "#4a4d56"} size={16} />
                </div>
                <p className="text-[26px] font-head font-black leading-none" style={{ color: count > 0 ? cfg.color : "#4a4d56" }}>
                  {count}
                </p>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase mt-1" style={{ color: count > 0 ? (isCommitment ? "rgba(230,51,41,0.6)" : "rgba(107,114,128,0.7)") : "#4a4d56" }}>
                  {cfg.shortLabel}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Total + retired */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2D3748]/50">
          <span className="text-[12px] text-[#6b7280]">
            <span className="font-bold text-white">{totalActive}</span> athlète{totalActive !== 1 ? "s" : ""} actif{totalActive !== 1 ? "s" : ""} dans ton pipeline
            <span className="text-[10px] text-[#6B7280] ml-2">· 50 max en gratuit</span>
          </span>
          {counts.retire > 0 && (
            <span className="text-[12px] text-[#6b7280]">
              {counts.retire} retiré{counts.retire !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Messaging Metrics (compact row) ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div>
            <p className="text-[26px] font-head font-black text-white leading-none">{data.messagesSent}</p>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Messages envoyés</p>
          </div>
        </div>

        <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 00-4-4H4" />
            </svg>
          </div>
          <div>
            <p className="text-[26px] font-head font-black text-white leading-none">{data.responsesReceived}</p>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Réponses reçues</p>
          </div>
        </div>

        {(() => {
          // Conversion: contacted (all who passed contacte) vs committed (engage + lettre_signee)
          const total = totalActive;
          const committed = (counts.engage || 0) + (counts.lettre_signee || 0);
          const rate = total > 0 ? Math.round((committed / total) * 100) : 0;
          return (
            <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-[26px] font-head font-black text-white leading-none">{rate}%</p>
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Taux de conversion</p>
                </div>
                {/* fraction hidden */}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
