import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import type { RosterAthlete } from "../_data/mockRosterData";
import VerificationBadge from "./VerificationBadge";
import FavoriteSignal from "./FavoriteSignal";

/* ─────────────────────────────────────────────────────────────────
   Roster Mobile Card — card layout for < 768px
───────────────────────────────────────────────────────────────── */

export default function RosterMobileCard({ athlete: a }: { athlete: RosterAthlete }) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-4 space-y-3">
      {/* Top row: name + position + favorite */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[16px] font-bold text-white hover:text-[#E63946] transition-colors">
              {a.firstName} {a.lastName}
            </Link>
            {a.badgeIcons && a.badgeIcons.length > 0 && (
              <span className="text-[12px] leading-none">{a.badgeIcons.join("")}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-block bg-[#2D3748]/60 text-[#9CA3AF] text-[12px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md">
              {a.position}
            </span>
            <span className="text-[12px] text-[#6b7280] font-semibold">{a.gradYear}</span>
          </div>
        </div>
        <FavoriteSignal count={a.favorites} />
      </div>

      {/* Stars */}
      <StarRating rating={a.stars} size="sm" />

      {/* Verification badge */}
      <VerificationBadge
        isVerified={a.isVerified}
        verification={a.verification}
      />

      {/* Profile % + views */}
      <div className="flex items-center justify-between pt-2 border-t border-[#2D3748]/40">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold text-white">{a.profilePercent}%</span>
          <span className="text-[12px] text-[#6b7280]">profil</span>
        </div>
        {a.views > 0 && (
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[12px] text-[#9CA3AF]">{a.views} vues</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Link href={`/coach/athletes/${a.id}/modifier`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Modifier">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>
          <Link href={`/coach/athletes/${a.id}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Aperçu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
