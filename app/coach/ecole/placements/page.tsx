"use client";

import Link from "next/link";
import PlacementsTable from "@/components/director/PlacementsTable";
import SchoolGate from "@/components/subscription/SchoolGate";
import { mockPlacementsHS } from "@/lib/mock";

export default function PlacementsPageWrapper() {
  return <SchoolGate><PlacementsPage /></SchoolGate>;
}

function PlacementsPage() {
  const count = mockPlacementsHS.length;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            className="flex items-center gap-2 text-[22px] font-bold uppercase tracking-wide text-white"
            style={{ fontFamily: "var(--wl-font-head, Montserrat, sans-serif)" }}
          >
            {/* Trophy icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
              <path d="M18 2H6v7a6 6 0 0012 0V2z" />
            </svg>
            Placements
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {count} athlètes recrutés cette saison
          </p>
        </div>

        {/* KPI circle */}
        <div className="w-20 h-20 rounded-full border-2 border-[#E63946] flex items-center justify-center flex-shrink-0">
          <span
            className="text-[48px] font-bold text-[#E63946] leading-none"
            style={{ fontFamily: "var(--wl-font-head, Montserrat, sans-serif)" }}
          >
            {count}
          </span>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      {count > 0 ? (
        <PlacementsTable placements={mockPlacementsHS} variant="ecole" />
      ) : (
        /* ── Empty state ──────────────────────────────── */
        <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] py-16 flex flex-col items-center justify-center gap-4">
          {/* Trophy placeholder */}
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
            Aucun placement cette saison. Les profils complets et vérifiés
            attirent plus de recruteurs!
          </p>
          <Link
            href="/coach/ecole/stats"
            className="mt-2 bg-[#E63946] hover:bg-[#D93C3C] text-white rounded-lg px-5 py-2.5 text-[13px] font-medium transition-colors"
          >
            Voir les stats
          </Link>
        </div>
      )}
    </div>
  );
}
