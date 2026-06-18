"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachHeroBlock — coach identity hero.

   Used by MaReputationMobile (own-view) and, eventually, the
   recruiter-side /recruteur/coach/[id] view (no implementation yet,
   see app/coach/reputation/page.tsx header note). The same block
   serves both surfaces — data shape passed in via props.

   PURE presentation : no fetching, no router, no auth. The parent
   decides who's being viewed.

   Layout :
   - 80×80 circular avatar (initials fallback via AthletePhoto)
   - Name : Outfit head, font-black, uppercase, tracking-tight
   - Optional school / team line underneath
   - Reserved slot for a future "Vérifié" coach pill (placeholder
     argument `verified` ; rendered when true)
═══════════════════════════════════════════════════════════════ */

import AthletePhoto from "@/components/shared/AthletePhoto";

export interface CoachHeroBlockProps {
  /** Coach's full display name (e.g. "Coach Bruno-Philippe Desfosses"). */
  name: string;
  /** Avatar URL — null/empty falls back to initials via AthletePhoto. */
  photoUrl?: string | null;
  /** First name for initials fallback. */
  firstName?: string;
  /** Last name for initials fallback. */
  lastName?: string;
  /** School name (école) — preferred over team. */
  school?: string | null;
  /** Team name — shown if school is empty. */
  team?: string | null;
  /** Future : verified-coach pill. False today. */
  verified?: boolean;
}

export function CoachHeroBlock({
  name, photoUrl, firstName, lastName, school, team, verified = false,
}: CoachHeroBlockProps) {
  const affiliation = school || team || "";
  return (
    <div className="flex flex-col items-center px-4 pt-4 pb-2">
      <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440] border border-white/[0.06]">
        <AthletePhoto
          photoUrl={photoUrl ?? null}
          firstName={firstName || ""}
          lastName={lastName || ""}
          size={80}
        />
      </div>
      <h1 className="mt-3 font-head text-[22px] font-black text-white uppercase tracking-tight leading-none text-center">
        {name || "—"}
      </h1>
      {affiliation && (
        <p className="mt-1.5 text-[13px] text-[#9CA3AF] text-center">{affiliation}</p>
      )}
      {verified && (
        <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[11px] font-bold uppercase tracking-wider text-[#3B82F6]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#3B82F6" stroke="none" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Coach vérifié
        </span>
      )}
    </div>
  );
}
