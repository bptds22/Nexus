"use client";

import React, { useEffect, useState } from "react";
import { BADGE_COLORS } from "@/lib/types/models";

/* ── Props ── */
interface BadgeGridProps {
  currentBadge: "none" | "evaluated" | "recommended" | "elite";
  hasPlaceurBadge: boolean;
  totalReviews: number;
  overallScore: number;
  recommendRate: number;
  totalPlacements: number;
}

/* ── Badge definitions ── */
interface BadgeDef {
  key: string;
  label: string;
  bgColor: string;
  iconColor: string;
  icon: React.ReactNode;
  isEarned: (p: BadgeGridProps) => boolean;
  progressText: (p: BadgeGridProps) => string;
  conditionText: string;
}

/* ── Inline SVG icons ── */
const CheckIcon = ({ color = BADGE_COLORS.evaluated, size = 24 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const MedalIcon = ({ color = BADGE_COLORS.recommended, size = 24 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11" />
    <path d="M12 6v4M10 8h4" />
  </svg>
);

const RocketIcon = ({ color = BADGE_COLORS.elite, size = 24 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3" />
  </svg>
);

const TargetIcon = ({ color = BADGE_COLORS.placeur, size = 24 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const SmallCheck = ({ color = "#22C55E" }: { color?: string }) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BADGES: BadgeDef[] = [
  {
    key: "evaluated",
    label: "Évalué",
    bgColor: "rgba(59,130,246,0.15)",
    iconColor: BADGE_COLORS.evaluated,
    icon: <CheckIcon />,
    isEarned: (p) => p.totalReviews >= 3,
    progressText: (p) => {
      const n = 3 - p.totalReviews;
      return n > 0 ? `Encore ${n} évaluation${n > 1 ? "s" : ""}` : "";
    },
    conditionText: "3+ évaluations reçues de recruteurs CÉGEP",
  },
  {
    key: "recommended",
    label: "Recommandé",
    bgColor: "rgba(255,255,255,0.10)",
    iconColor: BADGE_COLORS.recommended,
    icon: <MedalIcon />,
    isEarned: (p) => p.totalReviews >= 5 && p.recommendRate >= 80,
    progressText: (p) => {
      if (p.totalReviews < 5) return `Encore ${5 - p.totalReviews} évaluation${5 - p.totalReviews > 1 ? "s" : ""}`;
      if (p.recommendRate < 80) return `Encore ${Math.ceil(80 - p.recommendRate)} point(s)`;
      return "";
    },
    conditionText: "5+ évaluations et 80%+ de taux de recommandation",
  },
  {
    key: "elite",
    label: "Coach Élite",
    bgColor: "rgba(230,57,70,0.15)",
    iconColor: BADGE_COLORS.elite,
    icon: <RocketIcon />,
    isEarned: (p) => p.totalReviews >= 15 && p.overallScore >= 4.5 && p.recommendRate >= 90,
    progressText: (p) => {
      if (p.totalReviews < 15) return `Encore ${15 - p.totalReviews} évaluations`;
      if (p.overallScore < 4.5) return `Encore ${(4.5 - p.overallScore).toFixed(1)} point(s)`;
      if (p.recommendRate < 90) return `${90 - Math.floor(p.recommendRate)}% recommandation`;
      return "";
    },
    conditionText: "15+ évaluations, moyenne 4.5+, 90%+ recommandation",
  },
  {
    key: "placeur",
    label: "Placeur",
    bgColor: "rgba(255,255,255,0.10)",
    iconColor: BADGE_COLORS.placeur,
    icon: <TargetIcon />,
    isEarned: (p) => p.totalPlacements >= 5,
    progressText: (p) => {
      const n = 5 - p.totalPlacements;
      return n > 0 ? `Encore ${n} placement${n > 1 ? "s" : ""}` : "";
    },
    conditionText: "5+ athlètes placés en CÉGEP",
  },
];

/* ── Glow keyframes injected once ── */
const GLOW_CSS = `
@keyframes badgeGlow {
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
  40% { box-shadow: 0 0 12px 4px rgba(255,255,255,0.4); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
}
`;

/* ── Component ── */
export default function BadgeGrid(props: BadgeGridProps) {
  const [hoverTimer, setHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseEnter = (key: string) => {
    const timer = setTimeout(() => setShowTooltip(key), 300);
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    if (hoverTimer) clearTimeout(hoverTimer);
    setHoverTimer(null);
    setShowTooltip(null);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOW_CSS }} />
      <div className="flex flex-wrap gap-4">
        {BADGES.map((badge) => {
          const earned = badge.isEarned(props);
          const progress = badge.progressText(props);

          return (
            <div
              key={badge.key}
              className="relative flex flex-col items-center"
              style={{ width: 100, opacity: earned ? 1 : 0.5 }}
              onMouseEnter={() => !earned ? handleMouseEnter(badge.key) : undefined}
              onMouseLeave={handleMouseLeave}
            >
              {/* Icon circle */}
              <div
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: 48,
                  height: 48,
                  backgroundColor: earned ? badge.bgColor : "#1A1D24",
                  animation: earned && mounted ? "badgeGlow 1s ease-out" : "none",
                }}
              >
                <span style={{ color: earned ? undefined : "#333" }}>{badge.icon}</span>
                {/* Check top-right — uses badge color */}
                {earned && (
                  <div className="absolute -top-1 -right-1">
                    <SmallCheck color={badge.iconColor} />
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className="mt-1.5 text-center text-[12px] font-bold"
                style={{ color: earned ? "#fff" : "#4B5563" }}
              >
                {badge.label}
              </span>

              {/* Progress micro text */}
              {!earned && progress && (
                <span className="text-[11px] text-[#4B5563] text-center mt-0.5 leading-tight">
                  {progress}
                </span>
              )}

              {/* Tooltip */}
              {!earned && showTooltip === badge.key && (
                <div
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#111317] text-[#D1D5DB] text-[12px] max-w-[240px] p-3 rounded-lg shadow-lg z-50 whitespace-normal"
                >
                  {badge.conditionText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
