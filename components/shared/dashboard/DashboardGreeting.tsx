"use client";

/* ═══════════════════════════════════════════════════════════════
   DashboardGreeting — floating top-left "Bonjour, {firstName}".

   Sits OUT of any card on the red-glow gradient. No background,
   no border ; the gradient shows through.

   Optional right-aligned chip (école / organization) — a small
   translucent pill that floats next to the greeting.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

export interface DashboardGreetingProps {
  /** First name (or "" for no name suffix). */
  greeting: string;
  /** Eyebrow line above "Bonjour," e.g. "JEUDI 11 JUIN". */
  dateLabel?: string;
  /** Right-aligned chip (school / organization / CÉGEP). */
  chip?: { label: string; icon?: ReactNode };
}

export function DashboardGreeting({ greeting, dateLabel, chip }: DashboardGreetingProps) {
  return (
    <div className="px-4 pt-6 pb-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        {dateLabel && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/65 font-semibold mb-1 truncate">
            {dateLabel}
          </p>
        )}
        <p className="text-[14px] text-white/85 font-medium">Bonjour,</p>
        <h1 className="text-[28px] font-extrabold text-white leading-tight tracking-tight truncate">
          {greeting || "Coach"}
        </h1>
      </div>
      {chip && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.16] backdrop-blur-sm px-3 py-1.5 mt-7 flex-shrink-0"
        >
          {chip.icon}
          <span className="text-[13px] text-white font-medium truncate max-w-[170px]">
            {chip.label}
          </span>
        </span>
      )}
    </div>
  );
}
