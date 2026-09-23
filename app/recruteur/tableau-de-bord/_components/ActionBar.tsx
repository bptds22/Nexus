import Link from "next/link";
import type { RecruiterActionBarData } from "../../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 1 — ACTION BAR
   Réponses de coachs seulement. Le bandeau « nouveaux athlètes » est
   devenu la tuile « Nouveaux (10 j) » (TuilesTableauDeBord) — décision BP
   2026-09-23. Même patron que l'ActionBar coach (barre border-l-4).
───────────────────────────────────────────────────────────────── */

export default function ActionBar({ data }: { data: RecruiterActionBarData }) {
  return (
    <div className="space-y-3">
      {/* ── Coach replies ────────────────────────────────────── */}
      <Link
        href="/recruteur/messages?filtre=reponse"
        className={`group flex items-center gap-4 rounded-xl px-6 py-5 transition-all border-l-4 ${
          data.coachReplies > 0
            ? "bg-[#22C55E]/[0.08] border-l-[#22C55E] hover:bg-[#22C55E]/[0.14]"
            : "bg-[#1A1D24] border-l-[#2D3748] hover:bg-[#22252c]"
        }`}
      >
        {/* Icon */}
        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
          data.coachReplies > 0 ? "bg-[#22C55E]/20" : "bg-[#2D3748]/50"
        }`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={data.coachReplies > 0 ? "#22C55E" : "#6b7280"}
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
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-[#22C55E] text-white text-[13px] font-black">
              {data.coachReplies}
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
