"use client";

import { useState, useMemo } from "react";
import PlacementsTable from "@/components/director/PlacementsTable";
import { mockRecruitsCegep } from "@/lib/mock";

/* ── page ────────────────────────────────────────────────── */

export default function RecrusCegepPage() {
  const [sportFilter, setSportFilter] = useState("Tous");

  /* unique sports from recruits */
  const sports = useMemo(
    () => ["Tous", ...Array.from(new Set(mockRecruitsCegep.map((r) => r.sport)))],
    [],
  );

  /* filtered placements */
  const filtered = useMemo(
    () =>
      sportFilter === "Tous"
        ? mockRecruitsCegep
        : mockRecruitsCegep.filter((r) => r.sport === sportFilter),
    [sportFilter],
  );

  const count = filtered.length;

  const selectClass =
    "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="flex items-center gap-2 text-[22px] font-bold uppercase tracking-wide text-white"
            style={{ fontFamily: "var(--wl-font-head, Outfit, sans-serif)" }}
          >
            {/* Trophy icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#E63946"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0V7H7.5v6zM7.5 7H4a1 1 0 00-1 1v1a4 4 0 004 4h.5m9-6H20a1 1 0 011 1v1a4 4 0 01-4 4h-.5"
              />
            </svg>
            Recrues confirm&eacute;es
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {mockRecruitsCegep.length} athl&egrave;tes recrut&eacute;s cette saison
          </p>
        </div>

        {/* KPI circle */}
        <div
          className="w-20 h-20 rounded-full border-2 border-[#E63946] flex items-center justify-center flex-shrink-0"
          style={{ boxShadow: "0 0 20px rgba(230,57,70,0.4), 0 0 40px rgba(230,57,70,0.15)" }}
        >
          <span
            className="text-[48px] font-bold text-[#E63946] leading-none"
            style={{
              fontFamily: "var(--wl-font-head, Outfit, sans-serif)",
              textShadow: "0 0 12px rgba(230,57,70,0.6), 0 0 24px rgba(230,57,70,0.3)",
            }}
          >
            {mockRecruitsCegep.length}
          </span>
        </div>
      </div>

      {/* ── Sport filter ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className={selectClass}
        >
          {sports.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* ── Table or empty state ──────────────────────────── */}
      {count > 0 ? (
        <PlacementsTable placements={filtered} variant="cegep" />
      ) : (
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 flex flex-col items-center justify-center gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#6B7280"
            strokeWidth={1.5}
            className="opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 21h8m-4-4v4m-4.5-8a4.5 4.5 0 019 0V7H7.5v6zM7.5 7H4a1 1 0 00-1 1v1a4 4 0 004 4h.5m9-6H20a1 1 0 011 1v1a4 4 0 01-4 4h-.5"
            />
          </svg>
          <p className="text-[14px] text-[#6B7280] text-center max-w-md">
            Aucune recrue confirm&eacute;e pour cette s&eacute;lection.
          </p>
        </div>
      )}
    </div>
  );
}
