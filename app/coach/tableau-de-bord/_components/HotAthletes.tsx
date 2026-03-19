import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import type { HotAthlete } from "../_data/mockDashboardData";

/* ─────────────────────────────────────────────────────────────────
   Zone 3 — ATHLÈTES EN DEMANDE
   Ranked by recruiter interest. The trending/signal section.
───────────────────────────────────────────────────────────────── */

const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);

export default function HotAthletes({ athletes }: { athletes: HotAthlete[] }) {
  // Max views for bar scaling
  const maxViews = Math.max(...athletes.map((a) => a.viewsThisWeek));

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-head font-bold text-[15px] tracking-[0.15em] uppercase text-white">
            Athlètes en demande
          </h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#E63946" stroke="none">
            <path d="M12 23c-4.97 0-9-3.58-9-8 0-3.19 2.13-6.17 3.37-7.54.34-.37.94-.13.94.38 0 1.6.73 3.33 1.87 4.27.14.11.33-.01.3-.18-.3-1.79.13-4.07 1.67-6.19.29-.4.88-.36 1.1.08.7 1.37 2.04 2.85 2.78 3.58 1.32 1.32 2.37 2.74 2.37 4.96 0 1.43-.54 2.7-1.42 3.64.51-.56.82-1.3.82-2.12 0-1.16-.64-2.08-1.6-2.95-.16-.14-.4-.02-.38.19.07.93-.35 1.74-1.16 2.27C11.5 21.82 12 23 12 23z" />
          </svg>
        </div>
        <p className="text-[13px] text-[#9CA3AF] mt-1">Les plus consultés cette semaine</p>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#2D3748]/50">
        {athletes.map((a) => (
          <Link
            key={a.id}
            href={`/coach/athletes/${a.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
          >
            {/* Rank */}
            <div className="w-8 flex items-center justify-center shrink-0">
              <span className="text-[16px] font-head font-black text-[#E63946]">#{a.rank}</span>
            </div>

            {/* Name + position + stars */}
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white truncate group-hover:text-[#E63946] transition-colors">
                {a.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[12px] text-[#6b7280] font-bold uppercase tracking-wider">{a.position}</span>
                <StarRating rating={a.stars} size="sm" />
              </div>
            </div>

            {/* Views */}
            <div className="flex items-center gap-1.5 text-[#9CA3AF] shrink-0 w-[65px] justify-end">
              <EyeIcon />
              <span className="text-[14px] font-bold text-white">{a.viewsThisWeek}</span>
              <span className="text-[12px]">vues</span>
            </div>

            {/* Unique recruiters */}
            <div className="hidden md:flex items-center gap-1.5 text-[#9CA3AF] shrink-0 w-[90px] justify-end">
              <HeartIcon />
              <span className="text-[14px] font-bold text-white">{a.uniqueRecruiters}</span>
              <span className="text-[12px]">recruteurs</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
