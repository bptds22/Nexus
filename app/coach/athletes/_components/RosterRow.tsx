import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import type { RosterAthlete } from "../_data/mockRosterData";
import { COMMITMENT_CONFIG } from "../_data/mockRosterData";
import VerificationBadge from "./VerificationBadge";
import FavoriteSignal from "./FavoriteSignal";

/* ─────────────────────────────────────────────────────────────────
   Roster Row — single athlete table row
───────────────────────────────────────────────────────────────── */

/* Stars: use shared StarRating component */

interface RosterRowProps {
  athlete: RosterAthlete;
  even: boolean;
}

export default function RosterRow({ athlete: a, even }: RosterRowProps) {
  const commitment = COMMITMENT_CONFIG[a.commitmentStatus];

  return (
    <tr className={`group border-b border-[#2D3748]/40 hover:bg-[#252D3A] transition-colors ${even ? "bg-[#1E2430]" : "bg-[#1A1D24]"}`}>
      {/* Nom */}
      <td className="px-4 py-3.5">
        <Link href={`/coach/athletes/${a.id}/modifier`}>
          <div className="flex items-center gap-2">
            <p className="text-[16px] font-bold text-white group-hover:text-[#E63946] transition-colors">
              {a.firstName} {a.lastName}
            </p>
            {a.badgeIcons && a.badgeIcons.length > 0 && (
              <span className="text-[12px] leading-none">{a.badgeIcons.join("")}</span>
            )}
          </div>
          <StarRating rating={a.stars} size="sm" />
        </Link>
      </td>

      {/* Position */}
      <td className="px-4 py-3.5">
        <span className="inline-block bg-[#2D3748]/60 text-[#9CA3AF] text-[12px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md">
          {a.position}
        </span>
      </td>

      {/* Graduation */}
      <td className="px-4 py-3.5">
        <span className="text-[14px] font-semibold text-[#9CA3AF]">
          {a.gradYear}
        </span>
      </td>

      {/* Statut */}
      <td className="px-4 py-3.5">
        <VerificationBadge
          isVerified={a.isVerified}
          verification={a.verification}
        />
      </td>

      {/* Recrutement (Commitment Status) */}
      <td className="px-4 py-3.5">
        {a.commitmentStatus !== "aucun" ? (
          <span
            className={`inline-block px-3 py-1 rounded-full text-[12px] font-bold tracking-wider uppercase border ${commitment.bg}`}
            style={{ color: commitment.color, borderColor: commitment.borderColor }}
          >
            {commitment.label}
          </span>
        ) : (
          <span className="text-[13px] text-[#2D3748]">&mdash;</span>
        )}
      </td>

      {/* Vues */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        {a.views > 0 ? (
          <div className="flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-[13px] font-bold text-[#9CA3AF]">
              {a.views}
            </span>
          </div>
        ) : (
          <span className="text-[13px] text-[#2D3748]">&mdash;</span>
        )}
      </td>

      {/* Favoris */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        <FavoriteSignal count={a.favorites} />
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1">
          <Link
            href={`/coach/athletes/${a.id}/modifier`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Modifier"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </Link>
          <Link
            href={`/coach/athletes/${a.id}/apercu`}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/5 transition-colors"
            title="Aperçu recruteur"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M10 14L21 3" />
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            </svg>
          </Link>
          {a.profilePercent < 100 && (
            <Link
              href={`/coach/athletes/${a.id}/modifier?step=missing`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F59E0B] hover:text-[#FBBF24] hover:bg-[#F59E0B]/10 transition-colors"
              title="Compléter le profil"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
