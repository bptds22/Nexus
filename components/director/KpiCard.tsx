"use client";

import React from "react";
import Link from "next/link";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBgColor?: string;
  valueColor?: string;
  valueFontSize?: string;
  trend?: number;
  trendLabel?: string;
  progressPercent?: number;
  progressColor?: string;
  href?: string;
}

export default function KpiCard({
  label,
  value,
  icon,
  iconBgColor = "rgba(255,255,255,0.1)",
  valueColor = "#FFFFFF",
  valueFontSize = "32px",
  trend,
  trendLabel,
  progressPercent,
  progressColor = "#E63946",
  href,
}: KpiCardProps) {
  const trendIsPositive = trend !== undefined && trend > 0;
  const trendIsNegative = trend !== undefined && trend < 0;
  const trendColor = trendIsPositive ? "#22C55E" : "#E63946";
  const trendArrow = trendIsPositive ? "\u2191" : "\u2193";

  // Circular progress SVG params
  const circleRadius = 18;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const progressOffset =
    progressPercent !== undefined
      ? circleCircumference - (progressPercent / 100) * circleCircumference
      : circleCircumference;

  const cardContent = (
    <>
      {/* Trend badge — top right */}
      {trend !== undefined && (
        <div
          className="absolute top-4 right-4 flex items-center gap-1 text-[12px] font-medium"
          style={{ color: trendColor }}
        >
          <span>
            {trendArrow}
            {Math.abs(trend)}%
          </span>
          {trendLabel && (
            <span className="text-[#6B7280]">{trendLabel}</span>
          )}
        </div>
      )}

      {/* Icon circle */}
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full mb-3"
        style={{ backgroundColor: iconBgColor }}
      >
        {icon}
      </div>

      {/* Value row */}
      <div className="flex items-center gap-3">
        <span
          className="font-head font-black leading-none"
          style={{ color: valueColor, fontSize: valueFontSize }}
        >
          {value}
        </span>

        {/* Circular progress indicator */}
        {progressPercent !== undefined && (
          <svg
            width={48}
            height={48}
            viewBox="0 0 48 48"
            className="shrink-0"
          >
            {/* Track */}
            <circle
              cx={24}
              cy={24}
              r={circleRadius}
              fill="none"
              stroke="#2A2D35"
              strokeWidth={4}
            />
            {/* Fill */}
            <circle
              cx={24}
              cy={24}
              r={circleRadius}
              fill="none"
              stroke={progressColor}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={circleCircumference}
              strokeDashoffset={progressOffset}
              transform="rotate(-90 24 24)"
            />
          </svg>
        )}
      </div>

      {/* Label */}
      <p className="text-[13px] text-[#6B7280] uppercase tracking-[0.15em] font-bold mt-1">
        {label}
      </p>
    </>
  );

  const baseClass = "group relative bg-[#1A1D24] rounded-xl border border-[#1e2128] hover:border-[#E63946]/20 p-5 sm:p-6 overflow-hidden transition-all duration-300";
  const redBarEl = <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />;

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClass} block`}
      >
        {redBarEl}
        {cardContent}
      </Link>
    );
  }

  return <div className={baseClass}>{redBarEl}{cardContent}</div>;
}
