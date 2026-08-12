"use client";

import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import RecruitmentStatusBadge from "@/components/ui/RecruitmentStatusBadge";
import AthletePhoto from "@/components/shared/AthletePhoto";
import type { GlobalRecruitmentStatus } from "@/lib/types/models";

interface AthleteInfoCardProps {
  athleteId: string;
  athleteName: string;
  athleteInitials: string;
  athletePhotoUrl?: string;
  athleteJersey?: string;
  athleteSport?: string;
  athletePosition?: string;
  athleteGradYear?: number;
  athleteVerified?: boolean;
  athleteStars?: number;
  athleteSchool?: string;
  athleteRegion?: string;
  athleteRecruitmentStatus: string;
  athleteCommittedSchool?: string;
  athleteOpenToOffers?: boolean | null;
  athleteGpa?: number;
  athleteProgrammes?: string[];
  athleteOpenRelocate?: boolean;
  athleteOpenPrivate?: boolean;
  athleteOpenAnglophone?: boolean;
  athleteDistinctions?: string[];
  /** Route for the "Voir le profil complet" CTA. Defaults to the recruiter
      athlete route so existing recruiter callers render unchanged; the coach
      thread passes /coach/athletes/[id]. */
  profileHref?: string;
}

export default function AthleteInfoCard({
  athleteId,
  athleteName,
  // athleteInitials is now derived inside AthletePhoto — kept on the
  // props interface for backward compat with existing callers.
  athletePhotoUrl,
  athleteJersey,
  athleteSport,
  athletePosition,
  athleteGradYear = 0,
  athleteVerified = false,
  athleteStars = 0,
  athleteSchool,
  athleteRegion,
  athleteRecruitmentStatus,
  athleteCommittedSchool,
  athleteOpenToOffers = null,
  athleteGpa = 0,
  athleteProgrammes = [],
  athleteOpenRelocate = false,
  athleteOpenPrivate = false,
  athleteOpenAnglophone = false,
  athleteDistinctions = [],
  profileHref,
}: AthleteInfoCardProps) {
  // Split athleteName so AthletePhoto can compute initials in
  // its onError fallback path. The athleteInitials prop becomes
  // unused — kept on the interface to avoid breaking callers.
  const [firstNamePart, ...lastNameParts] = athleteName.split(/\s+/);
  const lastNamePart = lastNameParts.join(" ");

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]/60 p-6">
      <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[#E63946] mb-4">Athlète concerné</p>

      {/* Photo with onError → initials fallback */}
      <div className="flex justify-center">
        <AthletePhoto
          photoUrl={athletePhotoUrl}
          firstName={firstNamePart}
          lastName={lastNamePart}
          size={80}
          alt={athleteName}
          className="border border-white/10"
        />
      </div>

      {/* Name + jersey */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-[18px] font-bold text-white">{athleteName}</span>
        {athleteJersey && <span className="text-[16px] font-black text-[#E63946]">#{athleteJersey}</span>}
      </div>

      {/* Sport · Position · Promotion */}
      {(athleteSport || athletePosition || athleteGradYear > 0) && (
        <p className="text-[13px] text-[#9CA3AF] text-center mt-1">
          {[athleteSport, athletePosition, athleteGradYear > 0 ? athleteGradYear : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      {/* Status badges row */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <RecruitmentStatusBadge
          status={athleteRecruitmentStatus as GlobalRecruitmentStatus}
          committedSchoolName={athleteCommittedSchool || undefined}
          openToOffers={athleteOpenToOffers}
          size="sm"
        />
        {athleteVerified && (
          <span className="inline-flex items-center gap-1 bg-[#3B82F6]/15 text-[#3B82F6] text-[10px] font-bold px-2 py-0.5 rounded-full">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#3B82F6" stroke="none"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            Vérifié
          </span>
        )}
      </div>

      {/* Star rating */}
      {athleteStars > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <StarRating rating={athleteStars} size="sm" />
          <span className="text-[13px] font-bold text-white tabular-nums">{Number(athleteStars).toFixed(1)}</span>
        </div>
      )}

      {/* Location */}
      {athleteSchool && (
        <p className="text-[12px] text-[#6b7280] text-center mt-2">
          {athleteSchool}{athleteRegion ? ` · ${athleteRegion}` : ""}
        </p>
      )}

      {/* Académique */}
      {(athleteGpa > 0 || athleteProgrammes.length > 0 || athleteGradYear > 0) && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">Académique</p>
          {athleteGpa > 0 && (
            <p className="text-[20px] font-bold text-white mt-1.5 tabular-nums">{athleteGpa}%</p>
          )}
          {athleteProgrammes.length > 0 && (
            <p className="text-[12px] text-[#9CA3AF] mt-1.5">
              <span className="text-[#6b7280]">Programme visé : </span>
              {athleteProgrammes.join(", ")}
            </p>
          )}
          {athleteGradYear > 0 && (
            <p className="text-[12px] text-[#6b7280] mt-1">Graduation : Juin {athleteGradYear}</p>
          )}
        </div>
      )}

      {/* Distinctions */}
      {athleteDistinctions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
          {athleteDistinctions.map((d, idx) => {
            const labels: Record<string, string> = { captain: "Capitaine", allstar: "Équipe d'étoiles", team_leader: "Leader", mvp: "MVP" };
            return (
              <span key={`${d}-${idx}`} className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] font-bold text-[#E63946]">
                {labels[d] || d}
              </span>
            );
          })}
        </div>
      )}

      {/* Préférences pills */}
      {(athleteOpenRelocate || athleteOpenPrivate || athleteOpenAnglophone) && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
          {athleteOpenRelocate && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
              Ouvert à déménager
            </span>
          )}
          {athleteOpenPrivate && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
              Ouvert au privé
            </span>
          )}
          {athleteOpenAnglophone && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[11px] font-bold text-[#22C55E]">
              Ouvert anglophone
            </span>
          )}
        </div>
      )}

      {/* Full profile CTA */}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <Link
          href={profileHref ?? `/recruteur/athletes/${athleteId}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E63946] text-[#E63946] text-[13px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#E63946]/10 transition-colors"
        >
          Voir le profil complet →
        </Link>
      </div>
    </div>
  );
}
