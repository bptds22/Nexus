import Link from "next/link";
import AthletePhoto from "@/components/shared/AthletePhoto";

/* ═══════════════════════════════════════════════════════════════
   NewsroomEventCard — editorial sports-broadcast aesthetic for
   partner newsroom events. One component, two visual variants
   driven by event_type:

     FIVE_STAR_SIGNUP — gold accent, 5-star rail at top, italic
       "a atteint 5 étoiles" subline, gold avatar ring. Evokes
       trading-card / "Top Performer" graphic.

     COMMITMENT — red accent, BadgeCheck glyph + "ENGAGEMENT
       CONFIRMÉ" label, "s'engage à <school>" subline with the
       destination school highlighted in red, red avatar ring.
       Evokes "Letter of Intent Signed" lower-third.

   Both variants share skeleton + typography. Hero-weight athlete
   name, scannable in a list of 10+, single-column on mobile.
═══════════════════════════════════════════════════════════════ */

export type NewsroomEventType = "FIVE_STAR_SIGNUP" | "COMMITMENT";

interface AthleteSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  sport_name: string | null;
  position_abbreviation: string | null;
  school_name: string | null;
}

export interface NewsroomEventCardProps {
  event: {
    id: string;
    event_type: NewsroomEventType;
    occurred_at: string;
    athlete: AthleteSummary;
    /** Destination school name. Only meaningful for COMMITMENT events. */
    committed_school_name?: string | null;
  };
}

function formatRelativeFrench(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours} h`;
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${Math.floor(days / 7) > 1 ? "s" : ""}`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

function StarRail() {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" stroke="none" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function BadgeCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function NewsroomEventCard({ event }: NewsroomEventCardProps) {
  const isFiveStar = event.event_type === "FIVE_STAR_SIGNUP";
  const accent = isFiveStar ? "#F59E0B" : "#E63946";
  const fullName = `${event.athlete.first_name ?? ""} ${event.athlete.last_name ?? ""}`.trim() || "Athlète";

  // Context metadata: "FOOTBALL · QB · COLLÈGE ST-JEAN-VIANNEY"
  // For COMMITMENT, prefix the school with "DE " to signal it's
  // the origin school (the destination already lives in the
  // headline subline).
  const sportPart = event.athlete.sport_name?.toUpperCase() ?? null;
  const positionPart = event.athlete.position_abbreviation?.toUpperCase() ?? null;
  const schoolPart = event.athlete.school_name
    ? isFiveStar
      ? event.athlete.school_name.toUpperCase()
      : `DE ${event.athlete.school_name.toUpperCase()}`
    : null;
  const metadataParts = [sportPart, positionPart, schoolPart].filter(Boolean) as string[];

  return (
    <Link href={`/partenaire/athletes/${event.athlete.id}`} className="block group">
      <article
        className="relative bg-[#1A1D24] hover:bg-[#1F2229] rounded-xl px-5 py-5 sm:px-7 sm:py-6 transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] border border-white/[0.06] overflow-hidden"
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        {/* Subtle inset glow on the accent edge — gold for five-star, red for commitment */}
        <div
          className="absolute inset-y-0 left-0 w-12 pointer-events-none"
          style={{
            background: isFiveStar
              ? "linear-gradient(to right, rgba(245,158,11,0.10), transparent)"
              : "linear-gradient(to right, rgba(230,57,70,0.08), transparent)",
          }}
          aria-hidden="true"
        />

        <div className="relative">
          {/* Top row: type indicator + timestamp */}
          <div className="flex items-center justify-between gap-3 mb-4">
            {isFiveStar ? (
              <StarRail />
            ) : (
              <div className="flex items-center gap-2">
                <BadgeCheckIcon />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#E63946]">
                  Engagement confirmé
                </span>
              </div>
            )}
            <span className="text-[12px] font-normal text-[#6B7280] uppercase tracking-[0.05em] shrink-0">
              {formatRelativeFrench(event.occurred_at)}
            </span>
          </div>

          {/* Hero row: name + subline + avatar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-[24px] sm:text-[28px] font-bold text-white leading-[1.1] tracking-[-0.02em] truncate">
                {fullName}
              </h2>
              {isFiveStar ? (
                <p className="text-[15px] italic text-[#F59E0B] mt-1">
                  a atteint 5 étoiles
                </p>
              ) : (
                <p className="text-[15px] font-medium text-white mt-1">
                  s&apos;engage à{" "}
                  <span className="font-bold text-[#E63946]">
                    {event.committed_school_name || "un CÉGEP"}
                  </span>
                </p>
              )}
            </div>

            <AthletePhoto
              photoUrl={event.athlete.photo_url}
              firstName={event.athlete.first_name}
              lastName={event.athlete.last_name}
              size={56}
              alt={fullName}
              className={isFiveStar ? "border-2 border-[#F59E0B]/30" : "border-2 border-[#E63946]/30"}
            />
          </div>

          {/* Context metadata */}
          {metadataParts.length > 0 && (
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6B7280] mt-3">
              {metadataParts.join(" · ")}
            </p>
          )}

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mt-5 mb-4" />

          {/* CTA */}
          <span className="text-[14px] font-medium text-[#E63946] group-hover:opacity-80 transition-opacity">
            Voir le profil →
          </span>
        </div>
      </article>
    </Link>
  );
}
