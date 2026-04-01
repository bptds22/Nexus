import Link from "next/link";
import type { KpiData } from "../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 2 — KPI CARDS
   Program health at a glance. 4 cards in a row.
   Gray & simple — only the trend badge gets color.
───────────────────────────────────────────────────────────────── */

const cardCls = "group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 p-6 flex flex-col gap-3 relative overflow-hidden transition-all duration-300";
const labelCls = "text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]";
const iconBox = "w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center";
const redBar = <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />;
const iconColor = "#E63946";

export default function KpiCards({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

      {/* ── Athlètes au roster ──────────────────────────────── */}
      <div className={cardCls}>
        {redBar}
        <div className="flex items-center justify-between">
          <span className={labelCls}>Athlètes au roster</span>
          <div className={iconBox}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
        </div>
        <div>
          <span className="text-[32px] font-head font-black text-white leading-none">{data.totalAthletes}</span>
          <p className="text-[13px] text-[#9CA3AF] mt-1">inscrits cette saison</p>
        </div>
      </div>

      {/* ── Profils vérifiés ─────────────────────────────────── */}
      <div className={cardCls}>
        {redBar}
        <div className="flex items-center justify-between">
          <span className={labelCls}>Profils vérifiés</span>
          <div className="w-10 h-10 rounded-full bg-[#3B82F6]/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        </div>
        <div>
          <span className="text-[32px] font-head font-black text-[#3B82F6] leading-none">
            {data.completeProfiles}
          </span>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            vérifiés sur {data.totalProfiles} athlètes
          </p>
        </div>
      </div>

      {/* ── Vues recruteurs ─────────────────────────────────── */}
      <div className={cardCls}>
        {redBar}
        <div className="flex items-center justify-between">
          <span className={labelCls}>Vues recruteurs</span>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
        </div>
        <div>
          <span className="text-[32px] font-head font-black text-white leading-none">{data.recruiterViews}</span>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[13px] text-[#9CA3AF]">ce mois-ci</p>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              data.viewsTrend > 0
                ? "bg-[#22C55E]/15 text-[#22C55E]"
                : data.viewsTrend < 0
                  ? "bg-[#E63946]/15 text-[#E63946]"
                  : "bg-[#6B7280]/15 text-[#6B7280]"
            }`}>
              {data.viewsTrend !== 0 && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  className={data.viewsTrend < 0 ? "rotate-180" : ""}>
                  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                </svg>
              )}
              {data.viewsTrend === 0 ? "→ " : data.viewsTrend > 0 ? "+" : ""}{data.viewsTrend}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Conversations actives ───────────────────────────── */}
      <Link href="/coach/demandes" className={cardCls}>
        {redBar}
        <div className="flex items-center justify-between">
          <span className={labelCls}>Conversations actives</span>
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
        </div>
        <div>
          <span className="text-[32px] font-head font-black text-white leading-none">{data.activeConversations}</span>
          <p className="text-[13px] text-[#9CA3AF] mt-1">fils de discussion en cours</p>
        </div>
      </Link>
    </div>
  );
}
