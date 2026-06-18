"use client";

/* ═══════════════════════════════════════════════════════════════
   iOS Settings rows + section wrappers — atomic vocabulary used by
   both RecruteurParametresMobile and CoachParametresMobile.

   Extracted verbatim from RecruteurParametresMobile :
     - SectionLabel : uppercase grey label above each Group
     - Group        : rounded-2xl dark card holding rows
     - ToggleRow    : label + optional sublabel + Toggle on right
     - NavRow       : tappable row with chevron (or external-link icon)
     - DangerRow    : centered red text, no chevron
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { Toggle } from "./Toggle";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#6b7280]">
        {children}
      </span>
    </div>
  );
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-4 rounded-2xl bg-[#1A1D24] border border-white/[0.06] overflow-hidden ${className || ""}`}>
      {children}
    </div>
  );
}

export function ToggleRow({
  label, sublabel, checked, onChange, isFirst,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  isFirst: boolean;
}) {
  return (
    <div
      className="flex items-center px-4 py-3"
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-[15px] text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-[#6b7280] mt-0.5">{sublabel}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function NavRow({
  label, sublabel, onTap, rightChevron = "chevron", isFirst, value, rightAccessory,
}: {
  label: string;
  sublabel?: string;
  onTap?: () => void;
  /** "chevron" = drill-down arrow ; "external" = open-in-browser arrow ;
   *  "none" = read-only row (no icon, no tap). */
  rightChevron?: "chevron" | "external" | "none";
  isFirst: boolean;
  /** Optional grey value displayed to the right of the chevron. */
  value?: string;
  /** Optional ReactNode rendered between the label area and the
   *  chevron — used for status pills (PRO, ADMIN, etc.). When set,
   *  the simple `value` text is suppressed in favor of this slot. */
  rightAccessory?: ReactNode;
}) {
  const tappable = !!onTap && rightChevron !== "none";
  const Wrapper = tappable ? "button" : "div";
  return (
    <Wrapper
      {...(tappable ? { type: "button" as const, onClick: onTap } : {})}
      className={`w-full flex items-center px-4 text-left ${tappable ? "active:bg-white/[0.04]" : ""}`}
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <div className="flex-1 min-w-0 py-3">
        <p className="text-[15px] text-white">{label}</p>
        {sublabel && <p className="text-[11px] text-[#6b7280] mt-0.5">{sublabel}</p>}
      </div>
      {rightAccessory ? (
        <span className="ml-2 shrink-0">{rightAccessory}</span>
      ) : value ? (
        <span className="text-[14px] text-[#9CA3AF] ml-2 shrink-0 truncate max-w-[40%]">{value}</span>
      ) : null}
      {rightChevron === "external" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ) : rightChevron === "chevron" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : null}
    </Wrapper>
  );
}

export function DangerRow({
  label, onTap, isFirst,
}: {
  label: string;
  onTap: () => void;
  isFirst: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center justify-center px-4 active:bg-white/[0.04]"
      style={{ minHeight: 52, borderTop: isFirst ? undefined : "0.5px solid rgba(255,255,255,0.06)" }}
    >
      <span className="text-[15px] font-medium text-[#E63946]">{label}</span>
    </button>
  );
}
