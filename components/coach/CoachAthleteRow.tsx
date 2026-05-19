"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { isValidationExpired } from "@/lib/utils/profileValidation";

/* ═══════════════════════════════════════════════════════════════
   CoachAthleteRow — shared list-view row used by both:
     - /coach/athletes (full roster, RosterAthlete)
     - /coach/equipes/[teamId] (team detail, TeamAthlete)

   Canonical visual = athletes page. Renders the fixed columns
   (avatar+verified, name+school, position, recruitment status,
   region+height, year, stars) and exposes a `children` slot for
   the trailing area where each caller diverges (badges/favorites/
   actions on athletes page; conditional Modifier + Voir + remove
   on team page).
═══════════════════════════════════════════════════════════════ */

export interface CoachAthleteRowProps {
  /** Athlete id used for the profile/modifier hrefs. */
  athleteId: string;
  firstName?: string;
  lastName?: string;
  /** Fallback display name when first/last aren't split (team page). */
  displayName?: string;
  photoUrl?: string | null;
  isVerified: boolean;
  /**
   * Profile validation timestamp. When provided, the verified badge
   * uses isValidationExpired() (athletes-page behavior). When
   * undefined, falls back to the raw isVerified boolean (team-page).
   */
  lastValidation?: string | null;
  /** School sub-line. Blank string is rendered as "—". */
  school?: string;
  position?: string;
  recruitmentStatus?: GlobalRecruitmentStatus | null;
  committedSchoolName?: string | null;
  openToOffers?: boolean | null;
  region?: string;
  heightWeight?: string;
  gradYear?: number | null;
  stars: number;
  /** Trailing slot for page-specific badges/actions. */
  children?: ReactNode;
  /** Show the Region + height/weight column. Default true. */
  showRegion?: boolean;
  /** Show the graduation year column. Default true. */
  showYear?: boolean;
}

function resolveName(p: CoachAthleteRowProps): string {
  if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`;
  if (p.firstName) return p.firstName;
  if (p.lastName) return p.lastName;
  return p.displayName || "—";
}

function resolveInitials(p: CoachAthleteRowProps): string {
  if (p.firstName || p.lastName) {
    const f = (p.firstName?.[0] ?? "").toUpperCase();
    const l = (p.lastName?.[0] ?? "").toUpperCase();
    return (f + l) || "?";
  }
  return (p.displayName ?? "").slice(0, 2).toUpperCase() || "?";
}

export default function CoachAthleteRow(props: CoachAthleteRowProps) {
  const {
    athleteId, firstName, lastName, photoUrl, isVerified, lastValidation,
    school, position, recruitmentStatus, committedSchoolName, openToOffers,
    region, heightWeight, gradYear, stars, children,
    showRegion = true, showYear = true,
  } = props;

  const verifiedActive =
    lastValidation === undefined
      ? isVerified
      : isVerified && !isValidationExpired({ verified: !!isVerified, last_profile_validation: lastValidation ?? null });

  const name = resolveName(props);
  const initials = resolveInitials(props);

  return (
    <div className="bg-[#1A1D24] rounded-lg border border-[#2D3748] hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] transition-all duration-300 ease-out flex flex-nowrap items-center px-4 py-3 gap-3 group overflow-hidden">
      {/* Avatar + verified */}
      <Link href={`/coach/athletes/${athleteId}`} className="relative w-10 h-10 shrink-0 block" style={{ overflow: "visible" }}>
        {photoUrl ? (
          <AthletePhoto
            photoUrl={photoUrl}
            firstName={firstName ?? null}
            lastName={lastName ?? null}
            size={40}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#2D3748] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#9CA3AF]">{initials}</span>
          </div>
        )}
        <div className="absolute -top-0.5 -right-0.5 z-10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill={verifiedActive ? "#3B82F6" : "#4a4d56"} stroke="none">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke={verifiedActive ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </Link>

      {/* Name + school */}
      <div className="w-[180px] shrink-0">
        <Link href={`/coach/athletes/${athleteId}`} className="text-[14px] font-bold text-white hover:text-[#E63946] transition-colors truncate block">
          {name}
        </Link>
        <p className="text-[12px] text-[#6b7280] truncate">{school || "—"}</p>
      </div>

      {/* Position */}
      <div className="w-[50px] shrink-0">
        {position ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc] text-[11px] font-bold uppercase tracking-wider">{position}</span>
        ) : <span className="text-[#4a4d56]">—</span>}
      </div>

      {/* Recruitment status */}
      <div className="w-[140px] shrink-0">
        <RecruitmentStatusBadge
          status={(recruitmentStatus || "OUVERT") as GlobalRecruitmentStatus}
          committedSchoolName={committedSchoolName || undefined}
          openToOffers={openToOffers ?? null}
          size="sm"
        />
      </div>

      {/* Region + height */}
      {showRegion && (
        <div className="w-[130px] shrink-0">
          <span className="text-[12px] text-[#9CA3AF] block truncate">{region || "—"}</span>
          {heightWeight && <span className="text-[11px] text-[#6b7280]">{heightWeight}</span>}
        </div>
      )}

      {/* Year */}
      {showYear && (
        <div className="w-[45px] shrink-0">
          <span className="text-[13px] text-[#9CA3AF]">{gradYear ?? "—"}</span>
        </div>
      )}

      {/* Stars */}
      <div className="w-[110px] shrink-0">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={stars >= i + 1 ? "#F59E0B" : "#374151"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
          <span className="text-[11px] font-bold text-[#F59E0B] ml-0.5">{stars.toFixed(1)}</span>
        </div>
      </div>

      {children}
    </div>
  );
}
