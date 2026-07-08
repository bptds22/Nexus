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
  /** When true, renders the canon verified check (#3B82F6) next to the
   *  greeting name. Athlete dashboard uses this ; coach/recruiter leave
   *  it off (default false). */
  verifiedBadge?: boolean;
}

export function DashboardGreeting({ greeting, dateLabel, chip, verifiedBadge = false }: DashboardGreetingProps) {
  return (
    <div
      className="px-4 pb-3 flex items-start justify-between gap-3"
      // pt-6 (1.5rem) conservé + env(safe-area-inset-top) : avec l'overlay
      // status bar actif, dégage la Dynamic Island ; vaut ~0 sans overlay
      // (web / Android sans inset) → aucun effet de bord. Dégradé inchangé,
      // il reste collé au top derrière l'island.
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
    >
      <div className="flex-1 min-w-0">
        {dateLabel && (
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/65 font-semibold mb-1 truncate">
            {dateLabel}
          </p>
        )}
        <p className="text-[14px] text-white/85 font-medium">Bonjour,</p>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[28px] font-extrabold text-white leading-tight tracking-tight truncate">
            {greeting || "Coach"}
          </h1>
          {verifiedBadge && (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="#3B82F6"
              stroke="none"
              aria-label="Profil vérifié"
              className="flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M9 12l2 2 4-4"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          )}
        </div>
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
