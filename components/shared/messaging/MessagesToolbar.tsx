"use client";

/* ═══════════════════════════════════════════════════════════════
   MessagesToolbar — shared desktop toolbar for BOTH inboxes
   (/coach/demandes + /athlete/messages). Layout the two pages share:

     Row 1 : search bar (full width, grows) + TYPE segmented filter
             adjacent (right ; wraps under on mobile width).
     Row 2 : STATUS pills (Tous | Nouveau | Réponse reçue |
             Sans réponse | Archivé).

   Search style mirrors the recruiter search bar. Pure presentational :
   the parent owns state (debounce), the derived type segments, and the
   status preset. One implementation → no drift between the two pages.
═══════════════════════════════════════════════════════════════ */

import { STATUS_PILLS, type StatusPreset } from "@/lib/messaging/threadStatus";
import type { TypeSegment } from "@/lib/messaging/typeSegments";

export interface MessagesToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  /** Derived type segments (first entry is always "Tous"). Hidden when
      there is nothing to segment (≤1 entry). */
  typeSegments: TypeSegment[];
  typeValue: string;
  onTypeChange: (v: string) => void;

  statusValue: StatusPreset;
  onStatusChange: (v: StatusPreset) => void;
}

export function MessagesToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher une conversation…",
  typeSegments,
  typeValue,
  onTypeChange,
  statusValue,
  onStatusChange,
}: MessagesToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Row 1 — search (grows) + type segmented (adjacent) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7280]"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg pl-10 pr-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#E63946] outline-none transition-colors"
          />
        </div>

        {typeSegments.length > 1 && (
          <div className="flex items-center gap-1 bg-[#13151a] border border-[#2a2d36] rounded-lg p-1 shrink-0 overflow-x-auto">
            {typeSegments.map((seg) => (
              <button
                key={seg.value}
                type="button"
                onClick={() => onTypeChange(seg.value)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-bold whitespace-nowrap transition-colors ${
                  typeValue === seg.value ? "bg-[#2D3748] text-white" : "text-[#9CA3AF] hover:text-white"
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Row 2 — status pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {STATUS_PILLS.map((pill) => {
          const isActive = statusValue === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => onStatusChange(pill.key)}
              className={`px-4 py-2.5 rounded-full text-[13px] font-bold tracking-wide whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#E63946] text-white"
                  : "bg-transparent border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
