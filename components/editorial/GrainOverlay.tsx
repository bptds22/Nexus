"use client";

import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   GrainOverlay — full-viewport film-grain texture.

   Mounted ONCE at the root layout. pointer-events-none so every
   click passes through.

   STACKING NOTE: several marketing pages wrap their root in
   `.hero-playbook`, which uses `isolation: isolate` in globals.css
   to anchor the playbook SVG's negative-z-index vignette. That
   isolation creates a new stacking context, which hides any
   `z-index: 1` fixed overlay that sits on the body. We therefore
   render the grain at z-[100] (above page content, below toasts at
   z-[200]+) and use straight opacity instead of mix-blend-mode:
   overlay — blend modes are scoped to the current stacking context
   and would only apply against the body background, not against
   the page. Straight opacity reads correctly on the dark
   #111317/#1A1D24 surfaces Nexus uses everywhere.
═══════════════════════════════════════════════════════════════ */

interface GrainOverlayProps {
  opacity?: number;
  className?: string;
}

const GRAIN_SVG =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>" +
  "<filter id='n'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/>" +
  "</filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/>" +
  "</svg>";

export default function GrainOverlay({ opacity = 0.05, className = "" }: GrainOverlayProps) {
  useEffect(() => {
  }, [opacity]);

  return (
    <div
      aria-hidden
      className={`fixed inset-0 pointer-events-none z-[100] ${className}`}
      style={{
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundRepeat: "repeat",
        opacity,
      }}
    />
  );
}
