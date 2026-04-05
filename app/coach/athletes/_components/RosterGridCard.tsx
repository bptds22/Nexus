import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import type { RosterAthlete } from "../_data/mockRosterData";
import { COMMITMENT_CONFIG as COMMIT_CFG } from "../_data/mockRosterData";
import VerificationBadge from "./VerificationBadge";
import FavoriteSignal from "./FavoriteSignal";

/* ─────────────────────────────────────────────────────────────────
   Roster Grid Card — visual card for the grid/card view toggle
───────────────────────────────────────────────────────────────── */

export default function RosterGridCard({ athlete: a }: { athlete: RosterAthlete }) {
  const commit = COMMIT_CFG[a.commitmentStatus];

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.02] transition-all duration-300 ease-out flex flex-col">
      {/* Avatar area */}
      <div className="relative h-[140px] bg-[#2F3440] overflow-hidden">
        {a.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photo} alt={`${a.firstName} ${a.lastName}`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[48px] font-head font-black text-white/5 tracking-wide">
              {a.firstName[0]}{a.lastName[0]}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1/2" style={{ background: "linear-gradient(to top, rgba(26,29,36,0.95), transparent)" }} />

        {/* Position chip */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-wider">
            {a.position}
          </span>
        </div>

        {/* Verified badge */}
        <div className="absolute top-3 left-3 z-10">
          <VerificationBadge
            isVerified={a.isVerified}
            verification={a.verification}
            size="lg"
            iconOnly
          />
        </div>

        {/* Favorites */}
        {a.favorites > 0 && (
          <div className="absolute top-3 right-3 z-10">
            <FavoriteSignal count={a.favorites} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1 gap-1.5">
        {/* Name + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/coach/athletes/${a.id}/modifier`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
            {a.firstName} {a.lastName}
          </Link>
          {a.badgeIcons && a.badgeIcons.length > 0 && (
            <span className="text-[12px] leading-none">{a.badgeIcons.join("")}</span>
          )}
        </div>

        {/* Grad year */}
        <p className="text-[13px] text-[#9CA3AF]">
          Promotion {a.gradYear}
        </p>

        {/* Stars */}
        <StarRating rating={a.stars} size="sm" />

        {/* Profile completeness bar */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-[#6b7280]">Profil</span>
            <span className="text-[12px] font-bold text-white">{a.profilePercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#2D3748]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${a.profilePercent}%`,
                background: a.profilePercent >= 70 ? "#3B82F6" : a.profilePercent >= 40 ? "#6B7280" : "#EF4444",
              }}
            />
          </div>
        </div>

        {/* Commitment status */}
        {a.commitmentStatus !== "aucun" && (
          <div className="mt-1">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
              style={{
                color: commit.color,
                background: `${commit.borderColor}20`,
                border: `1px solid ${commit.borderColor}`,
              }}
            >
              {commit.label}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-auto border-t border-[#2D3748]/60">
          {a.views > 0 ? (
            <div className="flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="text-[13px] text-[#9CA3AF]">{a.views} vues</span>
            </div>
          ) : <div />}

          <div className="flex items-center gap-1">
            <Link href={`/coach/athletes/${a.id}/modifier`}
              className="text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors flex items-center gap-1">
              Modifier
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
