"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────
   StarRatingInput — clickable star rating (1-5)
   Hover preview + click to set.
   compact: renders as a row with label left, stars + score right.
───────────────────────────────────────────────────────────────── */

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  max?: number;
  label?: string;
  compact?: boolean;
  gold?: boolean;
  hideScore?: boolean;
}

export default function StarRatingInput({
  value,
  onChange,
  max = 5,
  label,
  compact = false,
  gold = false,
  hideScore = false,
}: StarRatingInputProps) {
  const [hovered, setHovered] = useState(0);

  const stars = (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= (hovered || value);
        return (
          <button
            key={i}
            type="button"
            aria-label={`${starValue} étoile${starValue > 1 ? "s" : ""}`}
            onClick={() => onChange(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            className="transition-transform hover:scale-110 cursor-pointer"
          >
            <svg
              width={compact ? "18" : "24"}
              height={compact ? "18" : "24"}
              viewBox="0 0 24 24"
              fill={isFilled ? (gold ? "#F59E0B" : "#F59E0B") : "#374151"}
              stroke={isFilled ? (gold ? "#F59E0B" : "#F59E0B") : "#F59E0B"}
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );

  // Compact: label left, stars + score right — single row
  if (compact) {
    return (
      <div className="flex items-center justify-between py-1.5">
        {label && (
          <span className="text-[12px] text-[#c8c8cc]">{label}</span>
        )}
        <div className="flex items-center gap-2">
          {stars}
          <span className="text-[13px] font-bold text-white tabular-nums w-8 text-right">
            {value > 0 ? `${value}` : "—"}
            <span className="text-[10px] text-[#4a4d56] font-normal">/{max}</span>
          </span>
        </div>
      </div>
    );
  }

  // Default layout
  return (
    <div>
      {label && (
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8a8d96] mb-2">
          {label}
        </p>
      )}
      <div className="flex items-center gap-1">
        {stars}
        {!hideScore && value > 0 && (
          <span className="ml-2 text-[13px] font-bold text-white font-mono">
            {value}/{max}
          </span>
        )}
      </div>
    </div>
  );
}
