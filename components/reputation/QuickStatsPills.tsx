"use client";

import React from "react";

/* ── Props ── */
interface QuickStatsPillsProps {
  avgResponseTimeHours: number;
  totalPlacements: number;
  profileCompletionRate: number;
}

/* ── Icons ── */
const ClockIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrophyIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
    <path d="M18 2H6v7a6 6 0 1012 0V2z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/* ── Component ── */
export default function QuickStatsPills({
  avgResponseTimeHours,
  totalPlacements,
  profileCompletionRate,
}: QuickStatsPillsProps) {
  const pills = [
    {
      icon: <ClockIcon />,
      label: "Temps de réponse moyen",
      value: `${avgResponseTimeHours}h`,
    },
    {
      icon: <TrophyIcon />,
      label: "Athlètes placés",
      value: `${totalPlacements}`,
    },
    {
      icon: <CheckCircleIcon />,
      label: "Profils complétés",
      value: `${profileCompletionRate}%`,
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {pills.map((pill, idx) => (
        <div
          key={idx}
          className="bg-[#22262E] rounded-[20px] px-4 py-2 flex items-center gap-2"
        >
          {pill.icon}
          <span className="text-[13px] text-[#9CA3AF]">{pill.label}</span>
          <span className="text-[13px] font-bold text-white">{pill.value}</span>
        </div>
      ))}
    </div>
  );
}
