import Link from "next/link";
import type { RecruiterActionBarData } from "../../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 1 — ACTION BAR
   Urgent alerts: coach replies + new athletes.
   Same pattern as coach ActionBar — border-l-4 alert bars.
───────────────────────────────────────────────────────────────── */

export default function ActionBar({ data }: { data: RecruiterActionBarData }) {
  return (
    <div className="space-y-3">
      {/* ── Coach replies ────────────────────────────────────── */}
      <Link
        href="/recruteur/messages?filtre=reponse"
        className={`group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 ${
          data.coachReplies > 0
            ? "bg-[#E63946]/[0.08] border-l-[#E63946] hover:bg-[#E63946]/[0.14]"
            : "bg-[#1A1D24] border-l-[#2D3748] hover:bg-[#22252c]"
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          data.coachReplies > 0 ? "bg-[#E63946]/20" : "bg-[#2D3748]/50"
        }`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={data.coachReplies > 0 ? "#E63946" : "#6b7280"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-bold ${data.coachReplies > 0 ? "text-white" : "text-[#6b7280]"}`}>
            {data.coachReplies > 0
              ? `${data.coachReplies} réponse${data.coachReplies > 1 ? "s" : ""} de coachs`
              : "Aucune nouvelle réponse"
            }
          </p>
          {data.coachReplies > 0 && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Cliquez pour consulter les messages</p>
          )}
        </div>

        {/* Count badge + arrow */}
        {data.coachReplies > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#E63946] text-white text-[13px] font-black">
              {data.coachReplies}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </Link>

      {/* ── New athletes ─────────────────────────────────────── */}
      <Link
        href="/recruteur/recherche?nouveau=true"
        className={`group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 ${
          data.newAthletesThisWeek > 0
            ? "bg-[#6B7280]/[0.06] border-l-[#6B7280] hover:bg-[#6B7280]/[0.12]"
            : "bg-[#3B82F6]/[0.06] border-l-[#3B82F6]"
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          data.newAthletesThisWeek > 0 ? "bg-[#6B7280]/20" : "bg-[#3B82F6]/20"
        }`}>
          {data.newAthletesThisWeek > 0 ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M20 8v6" /><path d="M23 11h-6" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
              <circle cx="12" cy="12" r="10" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[15px] font-bold ${data.newAthletesThisWeek > 0 ? "text-white" : "text-[#3B82F6]"}`}>
            {data.newAthletesThisWeek > 0
              ? `${data.newAthletesThisWeek} nouveaux athlètes cette semaine`
              : "Aucun nouvel athlète"
            }
          </p>
          {data.newAthletesThisWeek > 0 && (
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">De nouveaux profils sont disponibles</p>
          )}
        </div>

        {/* Count badge + arrow */}
        {data.newAthletesThisWeek > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#6B7280] text-white text-[13px] font-black">
              {data.newAthletesThisWeek}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
              className="opacity-0 group-hover:opacity-100 transition-opacity">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </Link>
    </div>
  );
}
