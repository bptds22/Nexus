"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────────
   IntroOverlay — Playbook draws then fades. Logo (separate layer)
   stays fully visible and flies to the navbar logo position.
───────────────────────────────────────────────────────────────── */

export default function IntroOverlay() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"draw" | "pause" | "fly" | "done">("draw");
  const logoRef = useRef<HTMLImageElement>(null);

  // Target position for logo flight
  const [logoTarget, setLogoTarget] = useState<{
    top: number; left: number; scale: number;
  } | null>(null);

  const computeTarget = useCallback(() => {
    const navbar = document.getElementById("navbar-logo");
    const intro = logoRef.current;
    if (!navbar || !intro) return;

    const to = navbar.getBoundingClientRect();
    setLogoTarget({
      top: to.top + to.height / 2,
      left: to.left + to.width / 2,
      scale: to.height / intro.getBoundingClientRect().height,
    });
  }, []);

  useEffect(() => {
    setMounted(true);

    // Hide the real navbar logo immediately
    const navLogo = document.getElementById("navbar-logo");
    if (navLogo) navLogo.style.opacity = "0";

    const t1 = setTimeout(() => setPhase("pause"), 2000);
    const t2 = setTimeout(() => {
      computeTarget();
      setPhase("fly");
    }, 2500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [computeTarget]);

  // When logo arrives at navbar position: reveal real logo, remove overlay
  const handleLogoTransitionEnd = useCallback(() => {
    if (phase === "fly") {
      const navLogo = document.getElementById("navbar-logo");
      if (navLogo) navLogo.style.opacity = "1";
      setPhase("done");
    }
  }, [phase]);

  if (!mounted || phase === "done") return null;

  const isFly = phase === "fly";

  // Logo positioning: centered during draw/pause, flies to navbar during fly
  const logoStyle: React.CSSProperties = isFly && logoTarget
    ? {
        position: "fixed",
        top: logoTarget.top,
        left: logoTarget.left,
        transform: `translate(-50%, -50%) scale(${logoTarget.scale})`,
        transition: "top 1s ease-in-out, left 1s ease-in-out, transform 1s ease-in-out",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) scale(1)",
        animation: "nxLogoIn 0.6s ease-out 0.2s both",
      };

  return (
    <>
      {/* Layer 1 (z-200): Playbook SVG overlay — fades out */}
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden pointer-events-none"
        style={{
          backgroundColor: "#060A14",
          opacity: isFly ? 0 : 1,
          transition: "opacity 1s ease-in-out",
        }}
      >
        <svg viewBox="0 0 600 500" className="w-[85vw] max-w-[700px]">
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
            <line x1="60" y1="340" x2="540" y2="340" stroke="#E63946" strokeWidth="2" opacity="0.3" strokeDasharray="480" strokeDashoffset="480">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.5s" fill="freeze" />
            </line>

            {[
              { cx: 200, cy: 330, d: 0.15 }, { cx: 250, cy: 330, d: 0.22 },
              { cx: 300, cy: 330, d: 0.28 }, { cx: 350, cy: 330, d: 0.34 },
              { cx: 400, cy: 330, d: 0.4 },  { cx: 80,  cy: 330, d: 0.18 },
              { cx: 520, cy: 330, d: 0.26 },
            ].map(({ cx, cy, d }) => (
              <circle key={`o-${cx}`} cx={cx} cy={cy} r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
                <animate attributeName="opacity" to="0.35" dur="0.2s" begin={`${d}s`} fill="freeze" />
                <animateTransform attributeName="transform" type="scale" values="0;1.1;1" keyTimes="0;0.65;1" dur="0.25s" begin={`${d}s`} fill="freeze" additive="sum" />
              </circle>
            ))}

            <circle cx="300" cy="390" r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
              <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.45s" fill="freeze" />
              <animateTransform attributeName="transform" type="scale" values="0;1.1;1" keyTimes="0;0.65;1" dur="0.25s" begin="0.45s" fill="freeze" additive="sum" />
            </circle>
            <circle cx="300" cy="390" r="6" fill="#7B94B0" opacity="0">
              <animate attributeName="opacity" to="0.35" dur="0.15s" begin="0.5s" fill="freeze" />
            </circle>

            <circle cx="300" cy="440" r="18" stroke="#7B94B0" strokeWidth="2.2" opacity="0">
              <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.5s" fill="freeze" />
              <animateTransform attributeName="transform" type="scale" values="0;1.08;1" keyTimes="0;0.65;1" dur="0.25s" begin="0.5s" fill="freeze" additive="sum" />
            </circle>

            <g stroke="#7B94B0" strokeWidth="2" opacity="0">
              <line x1="200" y1="312" x2="200" y2="286" /><line x1="184" y1="286" x2="216" y2="286" />
              <line x1="350" y1="312" x2="350" y2="286" /><line x1="334" y1="286" x2="366" y2="286" />
              <animate attributeName="opacity" to="0.35" dur="0.2s" begin="0.55s" fill="freeze" />
            </g>

            {[
              { x: 155, y: 220, d: 0.6 }, { x: 380, y: 190, d: 0.65 }, { x: 460, y: 270, d: 0.7 },
            ].map(({ x, y, d }) => (
              <g key={`d-${x}`} stroke="#4a5568" strokeWidth="2.5" opacity="0">
                <line x1={x-14} y1={y-14} x2={x+14} y2={y+14} />
                <line x1={x+14} y1={y-14} x2={x-14} y2={y+14} />
                <animate attributeName="opacity" to="0.35" dur="0.2s" begin={`${d}s`} fill="freeze" />
              </g>
            ))}

            <path d="M80,312 C78,260 76,190 74,110" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="250" opacity="0.35" markerEnd="url(#iAhGray)">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.7s" begin="0.75s" fill="freeze" />
            </path>
            <path d="M250,312 C248,276 224,244 160,186" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="220" opacity="0.35" markerEnd="url(#iAhGray)">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.65s" begin="0.9s" fill="freeze" />
            </path>
            <path d="M400,312 L400,240 L500,240" stroke="#7B94B0" strokeWidth="2" strokeDasharray="10 7" strokeDashoffset="200" opacity="0.35" markerEnd="url(#iAhGray)">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.6s" begin="1s" fill="freeze" />
            </path>
            <path d="M300,458 C336,466 396,458 436,440" stroke="#7B94B0" strokeWidth="1.8" strokeDasharray="8 6" strokeDashoffset="180" opacity="0.35" markerEnd="url(#iAhGray)">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.5s" begin="1.25s" fill="freeze" />
            </path>

            <path d="M520,312 C518,268 494,228 390,155" stroke="#E63946" strokeWidth="3" strokeDasharray="10 7" strokeDashoffset="260" opacity="0.95" markerEnd="url(#iAhRed)">
              <animate attributeName="stroke-dashoffset" to="0" dur="0.8s" begin="1.1s" fill="freeze" />
            </path>
          </g>
        </svg>
      </div>

      {/* Layer 2 (z-201): Logo ONLY — never fades, flies to navbar */}
      <img
        ref={logoRef}
        src="/brand/logo-white.svg"
        alt=""
        className="z-[201] pointer-events-none"
        style={{
          height: "4.5rem",
          width: "auto",
          ...logoStyle,
        }}
        onTransitionEnd={handleLogoTransitionEnd}
      />

      <style jsx>{`
        @keyframes nxLogoIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
