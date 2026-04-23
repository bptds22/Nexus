"use client";

/* ═══════════════════════════════════════════════════════════════
   ScribbleArrow — hand-drawn arrow pointing at a CTA or stat.

   Slight curve on the shaft (not a straight line) + a stroked
   chevron head. Direction rotates the whole SVG so the shaft
   arc reads naturally in every orientation.
═══════════════════════════════════════════════════════════════ */

type Direction = "up" | "down" | "left" | "right" | "down-right" | "down-left";
type Size = "sm" | "md" | "lg";

interface ScribbleArrowProps {
  direction: Direction;
  color?: string;
  size?: Size;
  className?: string;
}

const SIZE_PX: Record<Size, number> = { sm: 48, md: 72, lg: 104 };
const STROKE: Record<Size, number> = { sm: 2, md: 3, lg: 4 };

// Baseline arrow points RIGHT. Shaft curves downward slightly; arrowhead
// is two stroked chevron legs. Rotation handles all other directions.
const SHAFT = "M 8 36 Q 34 28 58 40 T 92 36";
const HEAD = "M 82 28 L 92 36 L 84 46";

const ROTATION: Record<Direction, number> = {
  right: 0,
  "down-right": 45,
  down: 90,
  "down-left": 135,
  left: 180,
  up: 270,
};

export default function ScribbleArrow({
  direction,
  color = "#E63946",
  size = "md",
  className = "",
}: ScribbleArrowProps) {
  const box = SIZE_PX[size];
  const strokeWidth = STROKE[size];
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 72"
      width={box}
      height={Math.round(box * 0.72)}
      className={className}
      style={{ transform: `rotate(${ROTATION[direction]}deg)`, overflow: "visible" }}
    >
      <path
        d={SHAFT}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={HEAD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
