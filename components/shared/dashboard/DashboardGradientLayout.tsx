"use client";

/* ═══════════════════════════════════════════════════════════════
   DashboardGradientLayout — page shell with a FIXED top glow.

   The red→dark gradient is anchored to the top of the viewport
   (position:fixed) at z-0. Children render above it at z-10 and
   scroll normally on top of the dark #111317 page bg.

   The gradient resolves to the page color (#111317) at ~78% of
   its height, so its bottom edge blends seamlessly with the page
   bg — no visible seam where content slides past it.

   Tab bar (z-40) sits above this gradient ; no overlap concern
   since the gradient occupies only ~55vh from the top.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

export interface DashboardGradientLayoutProps {
  children: ReactNode;
  /** Additional vertical offset (used by pull-to-refresh indicators). */
  topOffset?: number;
}

export function DashboardGradientLayout({ children, topOffset = 0 }: DashboardGradientLayoutProps) {
  return (
    <div
      className="relative min-h-screen bg-[#111317] text-white"
      style={{
        paddingTop: topOffset,
        paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 32px)",
      }}
    >
      {/* Fixed top glow — red fades to FULLY TRANSPARENT (not to a
          hard #111317 stop). The page bg below is #111317 so the
          transparent tail blends seamlessly — no perceptible band
          where the gradient ends. Multiple intermediate alpha stops
          eliminate Mach-band optical artifacts on dark WebViews. */}
      <div
        className="fixed inset-x-0 top-0 pointer-events-none"
        style={{
          height: "70vh",
          background:
            "linear-gradient(180deg, " +
              "rgba(230,57,70,1) 0%, " +
              "rgba(184,40,52,0.85) 18%, " +
              "rgba(127,27,37,0.65) 35%, " +
              "rgba(76,16,22,0.4) 55%, " +
              "rgba(40,10,14,0.18) 75%, " +
              "rgba(17,19,23,0) 100%)",
          zIndex: 0,
        }}
      />
      {/* Content scrolls above the gradient. */}
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
