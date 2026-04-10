/* ═══════════════════════════════════════════════════════════════
   StarRating — Shared read-only star rating display
   Official pattern: 5 SVG stars + numeric value in gold

   Filled:  #F59E0B solid fill
   Empty:   #374151 fill + #F59E0B stroke 1.5px (gold outline)
   Half:    #F59E0B fill clipped at 50%
   Number:  #F59E0B bold, always shown by default
═══════════════════════════════════════════════════════════════ */

import { useId } from "react";

const STAR_PATH = "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z";
const GOLD = "#F59E0B";
const EMPTY_FILL = "#374151";

const SIZES = {
  sm: { star: 14, text: "text-[12px]", gap: "gap-[2px]", numGap: "ml-1.5" },
  md: { star: 18, text: "text-[14px]", gap: "gap-[2px]", numGap: "ml-2" },
  lg: { star: 24, text: "text-[16px]", gap: "gap-[3px]", numGap: "ml-2.5" },
} as const;

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}

export default function StarRating({
  rating,
  size = "sm",
  showNumber = true,
  className = "",
}: StarRatingProps) {
  const uid = useId();
  const cfg = SIZES[size];
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.floor(clamped);
  const decimal = clamped - full;
  const hasHalf = decimal >= 0.25 && decimal < 0.75;
  const roundUp = decimal >= 0.75;
  const effectiveFull = roundUp ? full + 1 : full;
  const displayValue = clamped % 1 === 0 ? `${clamped}.0` : clamped.toFixed(1);

  return (
    <span className={`inline-flex items-center ${cfg.gap} ${className}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const isFull = i < effectiveFull;
        const isHalf = i === full && hasHalf;

        if (isFull) {
          return (
            <svg key={i} width={cfg.star} height={cfg.star} viewBox="0 0 24 24" className="shrink-0">
              <path d={STAR_PATH} fill={GOLD} />
            </svg>
          );
        }

        if (isHalf) {
          const clipId = `hc-${uid}-${i}`;
          return (
            <svg key={i} width={cfg.star} height={cfg.star} viewBox="0 0 24 24" className="shrink-0">
              <defs>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width="12" height="24" />
                </clipPath>
              </defs>
              {/* Empty star background — plain gray */}
              <path d={STAR_PATH} fill={EMPTY_FILL} />
              {/* Gold half overlay */}
              <path d={STAR_PATH} fill={GOLD} clipPath={`url(#${clipId})`} />
            </svg>
          );
        }

        // Empty star — plain gray, no outline
        return (
          <svg key={i} width={cfg.star} height={cfg.star} viewBox="0 0 24 24" className="shrink-0">
            <path d={STAR_PATH} fill={EMPTY_FILL} />
          </svg>
        );
      })}

      {showNumber && (
        <span className={`${cfg.numGap} ${cfg.text} font-bold font-head`} style={{ color: GOLD }}>
          {displayValue}
        </span>
      )}
    </span>
  );
}
