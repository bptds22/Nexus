import React from "react";
import "./distinction-badges.css";

type BadgeType = "capitaine" | "etoile" | "pointeur" | "progression" | "medaille";
type BadgeSize = "sm" | "lg";

interface Props {
  type: BadgeType;
  size?: BadgeSize;
  customLabel?: string;
}

const LABELS: Record<BadgeType, { lg: string; sm: string }> = {
  capitaine: { lg: "Capitaine", sm: "Capitaine" },
  etoile: { lg: "Étoile provinciale", sm: "Étoile" },
  pointeur: { lg: "Meilleur pointeur", sm: "Pointeur" },
  progression: { lg: "Progression", sm: "Progression" },
  medaille: { lg: "Distinction", sm: "Distinction" },
};

export const DISTINCTION_TO_BADGE: Record<string, BadgeType> = {
  captain: "capitaine",
  allstar: "etoile",
  scoring_leader: "pointeur",
  points_leader: "pointeur",
  progression: "progression",
  team_leader: "pointeur",
  mvp: "pointeur",
};

function ShieldSVG() {
  return (
    <svg viewBox="0 0 80 96" fill="none">
      <defs>
        <clipPath id="shield-clip">
          <path d="M40 2L76 14V54C76 72 58 86 40 94C22 86 4 72 4 54V14L40 2Z" />
        </clipPath>
        <linearGradient id="shimmer-grad-shield" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M40 2L76 14V54C76 72 58 86 40 94C22 86 4 72 4 54V14L40 2Z" fill="#B71C1C" />
      <path d="M40 7L71 17.5V52C71 68 55 80.5 40 88C25 80.5 9 68 9 52V17.5L40 7Z" fill="#E63946" />
      <path d="M40 7L71 17.5V52C71 68 55 80.5 40 88" fill="#D32F2F" opacity=".3" />
      <path d="M40 13L65 21.5V50C65 64 52 75 40 82C28 75 15 64 15 50V21.5L40 13Z" stroke="#fff" strokeWidth=".8" fill="none" opacity=".15" />
      <text x="40" y="56" textAnchor="middle" fill="#8B1A1A" fontSize="32" fontWeight="800" fontFamily="var(--font-outfit), sans-serif" style={{ letterSpacing: '0.04em' }}>C</text>
      <g clipPath="url(#shield-clip)">
        <rect className="badge-shimmer" x="-20" y="-10" width="30" height="120" fill="url(#shimmer-grad-shield)" opacity=".8" />
      </g>
    </svg>
  );
}

function StarSVG() {
  return (
    <svg viewBox="0 0 90 90" fill="none">
      <defs>
        <clipPath id="star-clip">
          <path d="M45 2L55.5 30.5L86 34L62 56L68.5 86.5L45 73L21.5 86.5L28 56L4 34L34.5 30.5Z" />
        </clipPath>
        <linearGradient id="shimmer-grad-star" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M45 2L55.5 30.5L86 34L62 56L68.5 86.5L45 73L21.5 86.5L28 56L4 34L34.5 30.5Z" fill="#B71C1C" />
      <path d="M45 10L53.8 33L80 36L60.5 54L66 80L45 69L24 80L29.5 54L10 36L36.2 33Z" fill="#E63946" />
      <path d="M45 10L53.8 33L80 36L60.5 54L66 80L45 69" fill="#D32F2F" opacity=".25" />
      <g clipPath="url(#star-clip)">
        <rect className="badge-shimmer" x="-20" y="-10" width="30" height="110" fill="url(#shimmer-grad-star)" opacity=".8" />
      </g>
    </svg>
  );
}

function CrownSVG() {
  return (
    <svg viewBox="0 0 90 82" fill="none">
      <defs>
        <clipPath id="crown-clip">
          <path d="M8 60L2 14L22 36L34 8L45 28L56 8L68 36L88 14L82 60Z" />
          <rect x="8" y="58" width="74" height="16" rx="3" />
        </clipPath>
        <linearGradient id="shimmer-grad-crown" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 60L2 14L22 36L34 8L45 28L56 8L68 36L88 14L82 60Z" fill="#B71C1C" />
      <path d="M11 58L5 18L23 37L34 12L45 30L56 12L67 37L85 18L79 58Z" fill="#E63946" />
      <path d="M11 58L5 18L23 37L34 12L45 30" fill="#D32F2F" opacity=".25" />
      <rect x="8" y="58" width="74" height="16" rx="3" fill="#B71C1C" />
      <rect x="10" y="60" width="70" height="12" rx="2" fill="#E63946" />
      <rect x="10" y="60" width="35" height="12" rx="2" fill="#D32F2F" opacity=".15" />
      <circle cx="25" cy="66" r="2.5" fill="#8B1A1A" />
      <circle cx="45" cy="66" r="3" fill="#8B1A1A" />
      <circle cx="65" cy="66" r="2.5" fill="#8B1A1A" />
      <circle cx="34" cy="8" r="4" fill="#B71C1C" />
      <circle cx="34" cy="8" r="2.8" fill="#8B1A1A" />
      <circle cx="56" cy="8" r="4" fill="#B71C1C" />
      <circle cx="56" cy="8" r="2.8" fill="#8B1A1A" />
      <circle cx="45" cy="28" r="3.5" fill="#B71C1C" />
      <circle cx="45" cy="28" r="2.2" fill="#8B1A1A" />
      <line x1="14" y1="64" x2="76" y2="64" stroke="#B71C1C" strokeWidth=".8" opacity=".3" />
      <line x1="14" y1="68" x2="76" y2="68" stroke="#B71C1C" strokeWidth=".8" opacity=".3" />
      <g clipPath="url(#crown-clip)">
        <rect className="badge-shimmer" x="-20" y="-10" width="30" height="100" fill="url(#shimmer-grad-crown)" opacity=".8" />
      </g>
    </svg>
  );
}

function RocketSVG() {
  return (
    <svg viewBox="0 0 56 90" fill="none">
      <defs>
        <clipPath id="rocket-clip">
          <path d="M28 0C28 0 18 14 18 36V58H38V36C38 14 28 0 28 0Z" />
          <path d="M18 44L6 62L18 58Z" />
          <path d="M38 44L50 62L38 58Z" />
        </clipPath>
        <linearGradient id="shimmer-grad-rocket" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M28 0C28 0 18 14 18 36V58H38V36C38 14 28 0 28 0Z" fill="#B71C1C" />
      <path d="M28 4C28 4 20 16 20 36V56H36V36C36 16 28 4 28 4Z" fill="#E63946" />
      <path d="M28 4C28 4 20 16 20 36V56H28V36C28 16 28 4 28 4Z" fill="#D32F2F" opacity=".2" />
      <path d="M28 6C28 6 24 14 22 24" stroke="#fff" strokeWidth="1.2" fill="none" opacity=".15" strokeLinecap="round" />
      <circle cx="28" cy="32" r="6" fill="#B71C1C" />
      <circle cx="28" cy="32" r="4.5" fill="#8B1A1A" />
      <path d="M18 44L6 62L18 58Z" fill="#B71C1C" />
      <path d="M18 46L9 60L18 57Z" fill="#E63946" opacity=".8" />
      <path d="M38 44L50 62L38 58Z" fill="#B71C1C" />
      <path d="M38 46L47 60L38 57Z" fill="#E63946" opacity=".8" />
      <path d="M22 58L20 72L24 66L28 76L32 66L36 72L34 58Z" fill="#7A1515" />
      <path d="M24 58L22 68L25 64L28 70L31 64L34 68L32 58Z" fill="#8B1A1A" />
      <path d="M26 58L25 64L28 68L31 64L30 58Z" fill="#9B2020" />
      <g clipPath="url(#rocket-clip)">
        <rect className="badge-shimmer" x="-20" y="-10" width="30" height="110" fill="url(#shimmer-grad-rocket)" opacity=".8" />
      </g>
    </svg>
  );
}

function MedalSVG() {
  return (
    <svg viewBox="0 0 80 96" fill="none">
      <defs>
        <clipPath id="medal-clip">
          <path d="M24 2L40 32L56 2H66L48 38L78 38L62 52L78 66L48 66L66 96H56L40 68L24 96H14L32 66L2 66L18 52L2 38L32 38L14 2Z" />
          <circle cx="40" cy="60" r="26" />
        </clipPath>
        <radialGradient id="medal-radial" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FF6B75" />
          <stop offset="40%" stopColor="#E63946" />
          <stop offset="80%" stopColor="#B71C1C" />
          <stop offset="100%" stopColor="#8B1A1A" />
        </radialGradient>
        <radialGradient id="medal-rim" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FF8A94" />
          <stop offset="100%" stopColor="#7A1515" />
        </radialGradient>
        <linearGradient id="shimmer-grad-medal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="40%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="60%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ribbon tails (left + right, angled) */}
      <path d="M18 2L30 2L36 20L32 34L14 12Z" fill="#7A1515" />
      <path d="M20 4L28 4L33 20L30 30L18 14Z" fill="#9B2020" />
      <path d="M62 2L50 2L44 20L48 34L66 12Z" fill="#7A1515" />
      <path d="M60 4L52 4L47 20L50 30L62 14Z" fill="#9B2020" />

      {/* Outer rim (slightly bigger circle for depth) */}
      <circle cx="40" cy="60" r="28" fill="#8B1A1A" opacity="0.5" />
      <circle cx="40" cy="60" r="27" fill="url(#medal-rim)" />

      {/* Main disc */}
      <circle cx="40" cy="60" r="24" fill="url(#medal-radial)" />

      {/* Edge highlight */}
      <circle cx="40" cy="60" r="24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <circle cx="40" cy="60" r="22" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />

      {/* Inner decorative ring */}
      <circle cx="40" cy="60" r="17" fill="none" stroke="#8B1A1A" strokeWidth="1" opacity="0.7" />
      <circle cx="40" cy="60" r="17" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />

      {/* Center emblem — 5-point star in dark red */}
      <polygon points="40,44 43,55 54,55 45,61.5 48,72 40,65 32,72 35,61.5 26,55 37,55" fill="#8B1A1A" />
      <polygon points="40,44 43,55 54,55 45,61.5 48,72 40,65 40,44" fill="#7A1515" />

      {/* Shimmer sweep */}
      <g clipPath="url(#medal-clip)">
        <rect className="badge-shimmer" x="-20" y="-10" width="30" height="120" fill="url(#shimmer-grad-medal)" opacity=".8" />
      </g>
    </svg>
  );
}

const SVG_MAP: Record<BadgeType, React.FC> = {
  capitaine: ShieldSVG,
  etoile: StarSVG,
  pointeur: CrownSVG,
  progression: RocketSVG,
  medaille: MedalSVG,
};

export default function DistinctionBadge({ type, size = "lg", customLabel }: Props) {
  const SVGComponent = SVG_MAP[type];
  const label = customLabel || LABELS[type][size];
  const svgWidth = size === "lg" ? 64 : 44;

  const svgHeight = size === "lg" ? 72 : 50;

  return (
    <div className="flex flex-col items-center" style={{ gap: size === "lg" ? 10 : 6 }}>
      <div className="distinction-badge-wrap flex items-center justify-center" style={{ width: svgWidth, height: svgHeight }}>
        <div className="distinction-badge-glow" />
        <div className="distinction-badge-svg">
          <SVGComponent />
        </div>
      </div>
      <span
        className="font-head font-bold uppercase text-[#E63946] text-center"
        style={{ fontSize: size === "lg" ? 12 : 9, letterSpacing: "1.5px", maxWidth: size === "lg" ? 110 : 80 }}
      >
        {label}
      </span>
    </div>
  );
}
