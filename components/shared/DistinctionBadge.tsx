"use client";
import React, { useId } from "react";
import { BADGE_CONFIG } from "@/lib/config/badges";
import "@/components/badges/distinction-badges.css";

interface Props {
  badge: string;
  detail?: string;
  size?: "sm" | "lg";
  index?: number;
}

function getBadgeLabel(badge: string, detail: string | undefined, config: { label: string; hasDetail: boolean }) {
  if (badge === "custom") return detail || "Distinction";
  if (config.hasDetail && detail) return `${config.label} — ${detail}`;
  return config.label;
}

export default function DistinctionBadge({ badge, detail, size = "lg", index }: Props) {
  const config = BADGE_CONFIG[badge];
  const reactId = useId();
  if (!config) return null;

  const uid = `${badge}-${index ?? "x"}-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const label = getBadgeLabel(badge, detail, config);

  // Uniform outer tile + icon box so every badge occupies the same footprint
  // regardless of the SVG's natural aspect ratio.
  const outerW = size === "sm" ? "w-[88px]" : "w-[110px]";
  const iconBox = size === "sm" ? "w-14 h-14" : "w-[72px] h-[72px]";
  const labelCls = size === "sm" ? "text-[10px] max-w-[88px]" : "text-[11px] max-w-[110px]";

  return (
    <div className={`flex flex-col items-center gap-[10px] cursor-pointer group shrink-0 ${outerW}`}>
      <div className={`relative ${iconBox} flex items-center justify-center transition-all duration-300 drop-shadow-[0_2px_8px_rgba(230,57,70,0.3)] group-hover:scale-[1.18] group-hover:-translate-y-[3px] group-hover:drop-shadow-[0_6px_20px_rgba(230,57,70,0.5)]`}>
        {renderSvg(config.icon, uid)}
      </div>
      <span className={`${labelCls} font-bold tracking-[0.1em] uppercase text-center text-[#E0E0E0] leading-tight block`}>
        {label}
      </span>
    </div>
  );
}

function renderSvg(icon: string, uid: string) {
  switch (icon) {
    case "shield":
      return (
        <svg width="100%" height="100%" viewBox="4 2 72 92" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d="M40 7L71 17.5V52C71 68 55 80.5 40 88C25 80.5 9 68 9 52V17.5L40 7Z" />
            </clipPath>
          </defs>
          <path d="M40 2L76 14V54C76 72 58 86 40 94C22 86 4 72 4 54V14L40 2Z" fill="#B71C1C" />
          <path d="M40 2L76 14V54C76 72 58 86 40 94C22 86 4 72 4 54V14L40 2Z" fill="#D32F2F" opacity="0.3" />
          <path d="M40 7L71 17.5V52C71 68 55 80.5 40 88C25 80.5 9 68 9 52V17.5L40 7Z" fill="#E63946" />
          <path d="M40 14L62 22V50C62 62 52 72 40 78C28 72 18 62 18 50V22L40 14Z" fill="#8B1A1A" opacity="0.25" />
          <text x="40" y="48" textAnchor="middle" dominantBaseline="central" fontFamily="Outfit,sans-serif" fontSize="36" fontWeight="700" fill="#9B2226">C</text>
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-30" y="0" width="30" height="96" fill="rgba(255,255,255,0.15)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "star":
      return (
        <svg width="100%" height="100%" viewBox="4 2 82 85" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d="M45 10L53.8 33L80 36L60.5 54L66 80L45 69L24 80L29.5 54L10 36L36.2 33Z" />
            </clipPath>
          </defs>
          <path d="M45 2L55.5 30.5L86 34L62 56L68.5 86.5L45 73L21.5 86.5L28 56L4 34L34.5 30.5Z" fill="#B71C1C" />
          <path d="M45 2L55.5 30.5L86 34L62 56L68.5 86.5L45 73L21.5 86.5L28 56L4 34L34.5 30.5Z" fill="#D32F2F" opacity="0.3" />
          <path d="M45 10L53.8 33L80 36L60.5 54L66 80L45 69L24 80L29.5 54L10 36L36.2 33Z" fill="#E63946" />
          <path d="M45 20L51 36L68 38L55 49L59 66L45 58L31 66L35 49L22 38L39 36Z" fill="#8B1A1A" opacity="0.2" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-30" y="0" width="30" height="90" fill="rgba(255,255,255,0.15)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "trophy":
      return (
        <svg width="100%" height="100%" viewBox="10 6 60 72" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d="M22 12h36v22a18 18 0 01-36 0V12Z" />
            </clipPath>
          </defs>
          <path d="M20 8h40v24a20 20 0 01-40 0V8Z" fill="#B71C1C" />
          <path d="M20 8h40v24a20 20 0 01-40 0V8Z" fill="#D32F2F" opacity="0.3" />
          <path d="M22 12h36v22a18 18 0 01-36 0V12Z" fill="#E63946" />
          <path d="M28 16h24v16a12 12 0 01-24 0V16Z" fill="#8B1A1A" opacity="0.2" />
          <path d="M20 16c-6 0-10 6-8 12s6 10 10 10" fill="none" stroke="#B71C1C" strokeWidth="5" />
          <path d="M20 16c-5 0-8 5-6.5 10s5 8.5 8.5 8.5" fill="none" stroke="#E63946" strokeWidth="3" />
          <path d="M60 16c6 0 10 6 8 12s-6 10-10 10" fill="none" stroke="#B71C1C" strokeWidth="5" />
          <path d="M60 16c5 0 8 5 6.5 10s-5 8.5-8.5 8.5" fill="none" stroke="#E63946" strokeWidth="3" />
          <rect x="36" y="52" width="8" height="14" rx="1" fill="#B71C1C" />
          <rect x="37" y="53" width="6" height="12" rx="1" fill="#E63946" />
          <rect x="24" y="66" width="32" height="10" rx="3" fill="#B71C1C" />
          <rect x="26" y="67" width="28" height="8" rx="2" fill="#E63946" />
          <rect x="26" y="67" width="28" height="8" rx="2" fill="#8B1A1A" opacity="0.2" />
          <path d="M40 18L42.5 24L49 24.5L44 29L45.5 35.5L40 32L34.5 35.5L36 29L31 24.5L37.5 24Z" fill="#7A1515" opacity="0.5" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-20" y="0" width="20" height="60" fill="rgba(255,255,255,0.15)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "crown":
      return (
        <svg width="100%" height="100%" viewBox="2 5 86 75" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d="M11 58L5 18L23 37L34 12L45 30L56 12L67 37L85 18L79 58Z" />
              <rect x="8" y="58" width="74" height="16" rx="2" />
            </clipPath>
          </defs>
          <path d="M8 60L2 14L22 36L34 8L45 28L56 8L68 36L88 14L82 60Z" fill="#B71C1C" />
          <rect x="6" y="60" width="78" height="18" rx="2" fill="#B71C1C" />
          <path d="M8 60L2 14L22 36L34 8L45 28L56 8L68 36L88 14L82 60Z" fill="#D32F2F" opacity="0.3" />
          <path d="M11 58L5 18L23 37L34 12L45 30L56 12L67 37L85 18L79 58Z" fill="#E63946" />
          <rect x="8" y="58" width="74" height="16" rx="2" fill="#E63946" />
          <rect x="8" y="58" width="74" height="16" rx="2" fill="#8B1A1A" opacity="0.2" />
          <circle cx="25" cy="66" r="4" fill="#7A1515" opacity="0.5" />
          <circle cx="45" cy="66" r="4" fill="#7A1515" opacity="0.5" />
          <circle cx="65" cy="66" r="4" fill="#7A1515" opacity="0.5" />
          <circle cx="34" cy="10" r="3" fill="#E63946" />
          <circle cx="45" cy="28" r="3" fill="#E63946" />
          <circle cx="56" cy="10" r="3" fill="#E63946" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-30" y="0" width="30" height="82" fill="rgba(255,255,255,0.15)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "medal":
      return (
        <svg width="100%" height="100%" viewBox="10 0 60 90" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id={`md-grad-${uid}`} cx="40" cy="56" r="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E63946" />
              <stop offset="100%" stopColor="#D32F2F" />
            </radialGradient>
            <clipPath id={`clip-${uid}`}>
              <circle cx="40" cy="60" r="24" />
            </clipPath>
          </defs>
          <path d="M18 2L30 2L36 20L32 34L14 12Z" fill="#D32F2F" />
          <path d="M20 4L29 4L34 18L31 30L16 13Z" fill="#E63946" />
          <path d="M62 2L50 2L44 20L48 34L66 12Z" fill="#D32F2F" />
          <path d="M60 4L51 4L46 18L49 30L64 13Z" fill="#E63946" />
          <circle cx="40" cy="60" r="28" fill="#D32F2F" />
          <circle cx="40" cy="60" r="28" fill="#E63946" opacity="0.4" />
          <circle cx="40" cy="60" r="24" fill={`url(#md-grad-${uid})`} />
          <circle cx="40" cy="60" r="17" fill="none" stroke="#8B1A1A" strokeWidth="1.5" opacity="0.5" />
          <path d="M40 44L43 55L54 55L45 61.5L48 72L40 65L32 72L35 61.5L26 55L37 55Z" fill="#7A1515" opacity="0.5" />
          <path d="M40 46L42.5 55.5L52 55.5L44.5 61L47 70L40 64L33 70L35.5 61L28 55.5L37.5 55.5Z" fill="#7A1515" opacity="0.35" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-20" y="30" width="20" height="60" fill="rgba(255,255,255,0.12)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "rocket":
      return (
        <svg width="100%" height="100%" viewBox="-12 -2 80 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <path d="M28 4C28 4 20 16 20 36V56H36V36C36 16 28 4 28 4Z" />
            </clipPath>
          </defs>
          <path d="M28 0C28 0 18 14 18 36V58H38V36C38 14 28 0 28 0Z" fill="#B71C1C" />
          <path d="M28 0C28 0 18 14 18 36V58H38V36C38 14 28 0 28 0Z" fill="#D32F2F" opacity="0.3" />
          <path d="M28 4C28 4 20 16 20 36V56H36V36C36 16 28 4 28 4Z" fill="#E63946" />
          <path d="M18 44L6 62L18 58Z" fill="#B71C1C" />
          <path d="M38 44L50 62L38 58Z" fill="#B71C1C" />
          <path d="M19 45L8 60L19 57Z" fill="#E63946" opacity="0.8" />
          <path d="M37 45L48 60L37 57Z" fill="#E63946" opacity="0.8" />
          <circle cx="28" cy="32" r="6" fill="#8B1A1A" />
          <circle cx="28" cy="32" r="4.5" fill="#7A1515" />
          <circle cx="28" cy="32" r="4.5" fill="rgba(230,57,70,0.3)" />
          <path d="M22 58L20 72L24 66L28 76L32 66L36 72L34 58Z" fill="#B71C1C" />
          <path d="M24 58L22 68L25 64L28 72L31 64L34 68L32 58Z" fill="#E63946" opacity="0.7" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-20" y="0" width="20" height="90" fill="rgba(255,255,255,0.15)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    case "target":
      return (
        <svg width="100%" height="100%" viewBox="2 2 76 76" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id={`clip-${uid}`}>
              <circle cx="40" cy="40" r="36" />
            </clipPath>
          </defs>
          <circle cx="40" cy="40" r="38" fill="#B71C1C" />
          <circle cx="40" cy="40" r="36" fill="#B71C1C" />
          <circle cx="40" cy="40" r="27" fill="#E63946" />
          <circle cx="40" cy="40" r="18" fill="#B71C1C" />
          <circle cx="40" cy="40" r="8" fill="#E63946" />
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="badge-shimmer" x="-30" y="0" width="30" height="80" fill="rgba(255,255,255,0.12)" transform="skewX(-20)" />
          </g>
        </svg>
      );
    default:
      return null;
  }
}
