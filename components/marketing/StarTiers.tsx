"use client";

/**
 * StarTiers — renders the 5 levels of the Nexus "cote globale" as a
 * card, each row showing N gold stars (wl-warning) out of 5 plus the
 * level label and description. Stars are rendered in CSS — never a
 * screenshot.
 *
 * Tiers are passed in order 5★ → 1★ (matching the canonical
 * stars.definitions ordering in dictionaries.ts).
 */

interface Tier {
  /** Number of filled gold stars, 1..5. */
  stars: number;
  label: string;
  description: string;
}

interface StarTiersProps {
  tiers: Tier[];
  className?: string;
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "#F59E0B" : "#4a4d56"}
      aria-hidden
      className="shrink-0"
    >
      <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
    </svg>
  );
}

export default function StarTiers({ tiers, className = "" }: StarTiersProps) {
  return (
    <div className={`rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-2 ${className}`}>
      {tiers.map((tier, i) => (
        <div
          key={tier.stars}
          className={`flex flex-col gap-1.5 px-4 py-4 sm:flex-row sm:items-center sm:gap-5 ${
            i < tiers.length - 1 ? "border-b border-white/5" : ""
          }`}
        >
          <div className="flex items-center gap-1" aria-label={`${tier.stars} / 5`}>
            {Array.from({ length: 5 }).map((_, s) => (
              <Star key={s} filled={s < tier.stars} />
            ))}
          </div>
          <div className="min-w-0">
            <p className="nx-display text-[15px] font-bold uppercase tracking-tight text-white">
              {tier.label}
            </p>
            <p className="text-[13px] leading-snug text-[#9CA3AF]">{tier.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
