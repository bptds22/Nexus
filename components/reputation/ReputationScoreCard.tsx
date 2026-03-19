"use client";

import React from "react";

/* ── Props ── */
interface ReputationScoreCardProps {
  overallScore: number;
  totalReviews: number;
  totalReviewers: number;
  recommendRate: number;
  isPublic: boolean; // false if <3 reviews AND score >= 3.0
}

/* ── Star SVG ── */
const STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z";

function Star({
  size,
  fill,
  halfFill,
}: {
  size: number;
  fill: "full" | "half" | "empty";
  halfFill?: boolean;
}) {
  const id = React.useId();
  if (fill === "half") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={`half-${id}`}>
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#2A2D35" />
          </linearGradient>
        </defs>
        <path d={STAR_PATH} fill={`url(#half-${id})`} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <path
        d={STAR_PATH}
        fill={fill === "full" ? "#F59E0B" : "#2A2D35"}
        stroke={fill === "empty" ? "#2A2D35" : "none"}
        strokeWidth={fill === "empty" ? 1 : 0}
      />
    </svg>
  );
}

function Stars({ score, size }: { score: number; size: number }) {
  const stars: ("full" | "half" | "empty")[] = [];
  for (let i = 1; i <= 5; i++) {
    if (score >= i) stars.push("full");
    else if (score >= i - 0.5) stars.push("half");
    else stars.push("empty");
  }
  return (
    <div className="flex items-center gap-0.5">
      {stars.map((fill, idx) => (
        <Star key={idx} size={size} fill={fill} />
      ))}
    </div>
  );
}

/* ── Hourglass SVG ── */
function HourglassIcon() {
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#F59E0B"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2h12v5l-4 4 4 4v5H6v-5l4-4-4-4V2z" />
      <path d="M6 2h12" />
      <path d="M6 22h12" />
    </svg>
  );
}

/* ── Recommend color helper ── */
function recommendColor(rate: number): string {
  if (rate >= 80) return "#22C55E";
  if (rate >= 60) return "#F59E0B";
  return "#E63946";
}

/* ── Component ── */
export default function ReputationScoreCard({
  overallScore,
  totalReviews,
  totalReviewers,
  recommendRate,
  isPublic,
}: ReputationScoreCardProps) {
  if (!isPublic) {
    /* ── Pending Score State ── */
    const filled = totalReviews;
    return (
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6">
        <div className="flex flex-col items-center gap-4 py-4">
          <HourglassIcon />
          <p className="text-[14px] text-[#9CA3AF] text-center max-w-sm">
            Votre score sera visible apr&egrave;s 3 &eacute;valuations. Vous en
            avez{" "}
            <span className="text-white font-bold">
              {totalReviews}/3
            </span>
            .
          </p>
          {/* 3-segment progress bar */}
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-12 h-2 rounded"
                style={{ backgroundColor: i < filled ? "#E63946" : "#2A2D35" }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Public Score State ── */
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6">
      <div className="flex flex-col items-center gap-3">
        {/* Score */}
        <div className="flex items-baseline gap-1">
          <span className="font-head text-[64px] font-bold text-white leading-none">
            {overallScore.toFixed(1)}
          </span>
          <span className="text-[24px] text-[#6B7280]">/5.0</span>
        </div>

        {/* Stars */}
        <Stars score={overallScore} size={28} />

        {/* Reviewer count (distinct recruiters) */}
        <p className="text-[14px] text-[#9CA3AF]">
          &Eacute;valu&eacute; par {totalReviewers} recruteur{totalReviewers > 1 ? "s" : ""} C&Eacute;GEP
        </p>

        {/* Recommend rate */}
        <p className="text-[14px]" style={{ color: recommendColor(recommendRate) }}>
          <span className="mr-1">{"\uD83D\uDC4D"}</span>
          {recommendRate}% des recruteurs vous recommandent
        </p>
      </div>
    </div>
  );
}
