"use client";

import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────
   IntroOverlay — Single red highlight route + subtle chalk context
   Hydration-safe: renders nothing on server, mounts on client only.
───────────────────────────────────────────────────────────────── */

export default function IntroOverlay() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"draw" | "pause" | "fade" | "done">("draw");

  useEffect(() => {
    setMounted(true);
    const t1 = setTimeout(() => setPhase("pause"), 2000);
    const t2 = setTimeout(() => setPhase("fade"), 2500);
    const t3 = setTimeout(() => setPhase("done"), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (!mounted || phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none"
      style={{
        backgroundColor: phase === "fade" ? "transparent" : "#060A14",
        transition: "background-color 1s ease-in-out",
      }}
    >
      {/* Logo */}
      <img
        src="/brand/White%20red%20logo%20@4x.png"
        alt=""
        className="absolute z-10 h-16 sm:h-20"
        style={{
          opacity: phase === "fade" ? 0 : 1,
          transition: "opacity 1s ease-in-out",
          animation: "nxLogoIn 0.6s ease-out 0.2s both",
        }}
      />

      <svg
        viewBox="0 0 600 500"
        className="w-[85vw] max-w-[700px]"
        style={{
          opacity: phase === "fade" ? 0.04 : 1,
          transition: "opacity 1s ease-in-out",
        }}
      >
        <defs>
          <filter id="chalk">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1" />
          </filter>
          <marker id="iAhRed" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#E63946" />
          </marker>
          <marker id="iAhGray" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#7B94B0" opacity="0.5" />
          </marker>
        </defs>

        <g filter="url(#chalk)" fill="none">

          {/* ── LINE OF SCRIMMAGE — red, subtle ── */}
          <line x1="60" y1="340" x2="540" y2="340" stroke="#E63946" strokeWidth="2" opacity="0.3" strokeDasharray="480" strokeDashoffset="480">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.5s" fill="freeze" />
          </line>

          {/* ── OFFENSIVE PLAYERS — subtle white circles ── */}
          {[
            { cx: 200, cy: 330, d: 0.15 },
            { cx: 250, cy: 330, d: 0.22 },
            { cx: 300, cy: 330, d: 0.28 },
            { cx: 350, cy: 330, d: 0.34 },
            { cx: 400, cy: 330, d: 0.4 },
            { cx: 80,  cy: 330, d: 0.18 },
            { cx: 520, cy: 330, d: 0.26 },
          ].map(({ cx, cy, d }) => (
            <circle key={`o-${cx}`} cx={cx} cy={cy} r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
              <animate attributeName="opacity" to="0.35" dur="0.2s" begin={`${d}s`} fill="freeze" />
              <animateTransform attributeName="transform" type="scale" values="0;1.1;1" keyTimes="0;0.65;1" dur="0.25s" begin={`${d}s`} fill="freeze" additive="sum" />
            </circle>
          ))}

          {/* QB — filled dot, subtle */}
          <circle cx="300" cy="390" r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
            <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.45s" fill="freeze" />
            <animateTransform attributeName="transform" type="scale" values="0;1.1;1" keyTimes="0;0.65;1" dur="0.25s" begin="0.45s" fill="freeze" additive="sum" />
          </circle>
          <circle cx="300" cy="390" r="6" fill="#7B94B0" opacity="0">
            <animate attributeName="opacity" to="0.35" dur="0.15s" begin="0.5s" fill="freeze" />
          </circle>

          {/* RB */}
          <circle cx="300" cy="440" r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
            <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.5s" fill="freeze" />
            <animateTransform attributeName="transform" type="scale" values="0;1.08;1" keyTimes="0;0.65;1" dur="0.25s" begin="0.5s" fill="freeze" additive="sum" />
          </circle>

          {/* ── BLOCKING T-CAPS — subtle ── */}
          <g stroke="#7B94B0" strokeWidth="2" opacity="0">
            <line x1="200" y1="312" x2="200" y2="286" /><line x1="184" y1="286" x2="216" y2="286" />
            <line x1="350" y1="312" x2="350" y2="286" /><line x1="334" y1="286" x2="366" y2="286" />
            <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.55s" fill="freeze" />
          </g>

          {/* ── DEFENDERS — gray X marks, very subtle ── */}
          {[
            { x: 155, y: 220, d: 0.6 },
            { x: 380, y: 190, d: 0.65 },
            { x: 460, y: 270, d: 0.7 },
          ].map(({ x, y, d }) => (
            <g key={`d-${x}`} stroke="#4a5568" strokeWidth="2.5" opacity="0">
              <line x1={x - 14} y1={y - 14} x2={x + 14} y2={y + 14} />
              <line x1={x + 14} y1={y - 14} x2={x - 14} y2={y + 14} />
              <animate attributeName="opacity" to="0.35" dur="0.2s" begin={`${d}s`} fill="freeze" />
            </g>
          ))}

          {/* ── CONTEXT ROUTES — subtle white/gray, background chalk ── */}

          {/* Go route (left WR) — subtle */}
          <path d="M80,312 C78,260 76,190 74,110" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="250" opacity="0.35" markerEnd="url(#iAhGray)">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.7s" begin="0.75s" fill="freeze" />
          </path>

          {/* Slant route (slot left) — subtle */}
          <path d="M250,312 C248,276 224,244 160,186" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="220" opacity="0.35" markerEnd="url(#iAhGray)">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.65s" begin="0.9s" fill="freeze" />
          </path>

          {/* Out route (slot right) — subtle */}
          <path d="M400,312 L400,240 L500,240" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="200" opacity="0.35" markerEnd="url(#iAhGray)">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.6s" begin="1s" fill="freeze" />
          </path>

          {/* RB checkdown — subtle */}
          <path d="M300,458 C336,466 396,458 436,440" stroke="#7B94B0" strokeWidth="1.8" strokeDasharray="8 6" strokeDashoffset="180" opacity="0.12" markerEnd="url(#iAhGray)">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.5s" begin="1.25s" fill="freeze" />
          </path>

          {/* ══ THE PLAY — WR right post route — RED, prominent ══ */}
          <path d="M520,312 C518,268 494,228 390,155" stroke="#E63946" strokeWidth="3" strokeDasharray="10 7" strokeDashoffset="260" opacity="0.95" markerEnd="url(#iAhRed)">
            <animate attributeName="stroke-dashoffset" to="0" dur="0.8s" begin="1.1s" fill="freeze" />
          </path>

        </g>
      </svg>

      <style jsx>{`
        @keyframes nxLogoIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
