/* ═══════════════════════════════════════════════════════════════
   AthleteParticipantHeader — coach-side context card for an
   ATHLETE_COACH thread. Replaces the recruiter 3-party panels
   (CoachInfoCard/AthleteInfoCard/reputation) which don't apply to a
   2-party athlete↔coach conversation. Light identity + link to the
   coach's existing athlete view.
═══════════════════════════════════════════════════════════════ */

import Link from "next/link";

export interface AthleteParticipantHeaderProps {
  athleteId: string;
  name: string;
  photoUrl?: string | null;
  position?: string;
  school?: string;
  initials?: string;
}

export default function AthleteParticipantHeader({
  athleteId,
  name,
  photoUrl,
  position,
  school,
  initials,
}: AthleteParticipantHeaderProps) {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5">
      <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-3">Athlète</p>
      <div className="flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-[#6b7280]">{initials || (name?.[0] ?? "?")}</span>
          </div>
        )}
        <div className="min-w-0">
          <Link href={`/coach/athletes/${athleteId}`} className="text-[15px] font-bold text-white hover:text-[#E63946] transition-colors">
            {name}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            {position && <span className="text-[11px] text-[#6b7280] font-bold uppercase">{position}</span>}
            {school && <span className="text-[11px] text-[#6b7280] truncate">{school}</span>}
          </div>
        </div>
      </div>
      <Link
        href={`/coach/athletes/${athleteId}`}
        className="inline-block mt-3 pt-3 border-t border-[#2D3748] w-full text-[11px] font-bold text-[#E63946] hover:text-[#ff4d5a] transition-colors"
      >
        Voir le profil →
      </Link>
    </div>
  );
}
