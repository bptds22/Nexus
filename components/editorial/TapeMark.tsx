"use client";

/* ═══════════════════════════════════════════════════════════════
   TapeMark — decorative tape strip.

   Looks physically stuck to the corner of a card, photo, or
   testimonial. Uses an irregular clip-path so the edges don't
   read as a rectangle. Slight drop shadow gives the lift. Parent
   needs position: relative for the absolute placement to anchor.

   Rotation is deterministic (default -3°). Previously used a random
   tilt, which caused a React hydration mismatch because Math.random
   returns different values during SSR vs client render. Callers that
   want variety should pass an explicit `rotation` prop.
═══════════════════════════════════════════════════════════════ */

type Variant = "yellow" | "white" | "red";
type Size = "sm" | "md" | "lg";
type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface TapeMarkProps {
  variant?: Variant;
  rotation?: number;
  size?: Size;
  position: Position;
  className?: string;
}

const VARIANT_BG: Record<Variant, string> = {
  yellow: "rgba(255, 230, 100, 0.55)",
  white: "rgba(255, 255, 255, 0.25)",
  red: "rgba(230, 57, 70, 0.40)",
};

const SIZE_PX: Record<Size, { w: number; h: number }> = {
  sm: { w: 60, h: 18 },
  md: { w: 100, h: 22 },
  lg: { w: 140, h: 28 },
};

// Jagged tape edge — start/end are slightly ragged, top/bottom nearly straight.
const TAPE_CLIP =
  "polygon(2% 15%, 6% 0%, 14% 8%, 28% 2%, 46% 10%, 62% 0%, 78% 6%, 90% 0%, 98% 18%, 97% 88%, 88% 100%, 72% 92%, 56% 100%, 38% 94%, 22% 100%, 8% 92%, 3% 100%)";

function anchor(position: Position): React.CSSProperties {
  switch (position) {
    case "top-left":     return { top: -10, left: -10 };
    case "top-right":    return { top: -10, right: -10 };
    case "bottom-left":  return { bottom: -10, left: -10 };
    case "bottom-right": return { bottom: -10, right: -10 };
  }
}

export default function TapeMark({
  variant = "yellow",
  rotation = -3,
  size = "md",
  position,
  className = "",
}: TapeMarkProps) {
  const tilt = rotation;
  const { w, h } = SIZE_PX[size];

  return (
    <div
      aria-hidden
      className={`absolute pointer-events-none ${className}`}
      style={{
        ...anchor(position),
        width: w,
        height: h,
        backgroundColor: VARIANT_BG[variant],
        clipPath: TAPE_CLIP,
        transform: `rotate(${tilt}deg)`,
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.25)",
        zIndex: 10,
      }}
    />
  );
}
