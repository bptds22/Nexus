"use client";

/* ═══════════════════════════════════════════════════════════════
   ScribbleUnderline — hand-drawn wobbly underline for headings.

   Reads like a pen highlight on a scouting report — irregular
   quadratic path, not a smooth bezier. Stroke-only, rounded caps.
   Optional stroke-dasharray animation traces the line on mount.
═══════════════════════════════════════════════════════════════ */

type Size = "sm" | "md" | "lg";

interface ScribbleUnderlineProps {
  color?: string;
  size?: Size;
  animate?: boolean;
  className?: string;
}

const STROKE: Record<Size, number> = { sm: 2, md: 4, lg: 6 };

// Length proxy for dasharray — approximates the total path length so
// the animation reveals from left to right without measuring at runtime.
const DASH_LEN = 260;

export default function ScribbleUnderline({
  color = "#E63946",
  size = "md",
  animate = false,
  className = "",
}: ScribbleUnderlineProps) {
  const strokeWidth = STROKE[size];
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 20"
      preserveAspectRatio="none"
      className={className}
      style={{ display: "block", width: "100%", height: size === "lg" ? 16 : size === "md" ? 12 : 10 }}
    >
      <path
        d="M 5 12 Q 30 8 55 11 T 120 10 Q 160 13 200 9"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? {
                strokeDasharray: DASH_LEN,
                strokeDashoffset: DASH_LEN,
                animation: "nxScribbleDraw 0.9s ease-out 0.2s forwards",
              }
            : undefined
        }
      />
      {animate && (
        <style>{`@keyframes nxScribbleDraw { to { stroke-dashoffset: 0; } }`}</style>
      )}
    </svg>
  );
}
