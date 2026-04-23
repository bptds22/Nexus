"use client";

/* ═══════════════════════════════════════════════════════════════
   ScribbleCircle — hand-drawn rough circle.

   Approximates a pen looping around a stat the scout circled back
   to. The path overshoots the start point slightly so the ends
   cross, which is what sells the "handmade" feel. Absolute
   positioning handled by className + parent being position:
   relative. SVG viewBox is 100×100; stroke stays crisp at any
   parent size.
═══════════════════════════════════════════════════════════════ */

interface ScribbleCircleProps {
  color?: string;
  strokeWidth?: number;
  animate?: boolean;
  className?: string;
}

// Rough ellipse using cubic segments with slight asymmetry + overshoot tail.
// Starts at ~3 o'clock, sweeps clockwise, and the tail crosses the start.
const CIRCLE_PATH =
  "M 86 48 C 88 70, 70 90, 48 88 C 24 86, 10 66, 14 44 C 18 20, 42 8, 64 14 C 82 20, 92 34, 88 52 C 86 62, 78 74, 66 80";

const DASH_LEN = 320;

export default function ScribbleCircle({
  color = "#E63946",
  strokeWidth = 3,
  animate = false,
  className = "",
}: ScribbleCircleProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className={className}
      style={{ overflow: "visible" }}
    >
      <path
        d={CIRCLE_PATH}
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
                animation: "nxCircleDraw 1.1s ease-out 0.3s forwards",
              }
            : undefined
        }
      />
      {animate && (
        <style>{`@keyframes nxCircleDraw { to { stroke-dashoffset: 0; } }`}</style>
      )}
    </svg>
  );
}
