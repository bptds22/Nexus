"use client";

/**
 * PlayerCard3D — a 3D-tilting frame that holds the hero player-card
 * image. The image already carries its own card chrome (verified badge,
 * stars) so nothing is drawn over it.
 *
 * Tilt: perspective on the parent, transform on the card container.
 * Desktop drives rotateX/rotateY from the mouse via useMotionValue +
 * useSpring (soft stiffness) and resets to 0 on mouse leave. Mobile
 * reuses the shared useGyroTilt hook. Both feed the same spring so the
 * motion is smooth and identical.
 *
 * If the image fails to load, a `fallback` node is shown instead.
 * Respects prefers-reduced-motion: tilt disabled (flat card).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useGyroTilt } from "@/lib/hooks/useGyroTilt";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface PlayerCard3DProps {
  src: string;
  alt: string;
  /** Shown when `src` fails to load. */
  fallback?: ReactNode;
  /** Aspect ratio of the card frame (default 2/3, the BP card's ratio). */
  aspectClass?: string;
  className?: string;
}

const MAX_DEG = 14;
const SPRING = { stiffness: 140, damping: 18, mass: 0.5 };

export default function PlayerCard3D({
  src,
  alt,
  fallback,
  aspectClass = "aspect-[2/3]",
  className = "",
}: PlayerCard3DProps) {
  const reduced = useReducedMotion();
  const { tilt, hasGyro } = useGyroTilt(MAX_DEG);
  const [imgFailed, setImgFailed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Source rotations (deg) → smoothed by a spring.
  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const springX = useSpring(rotX, SPRING);
  const springY = useSpring(rotY, SPRING);

  // Mobile: feed gyro tilt into the same springs.
  useEffect(() => {
    if (reduced || !hasGyro) return;
    rotX.set(tilt.y);
    rotY.set(tilt.x);
  }, [reduced, hasGyro, tilt.x, tilt.y, rotX, rotY]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || hasGyro) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotY.set(px * MAX_DEG * 2); // left-right → rotateY
    rotX.set(-py * MAX_DEG * 2); // up-down → rotateX
  }

  function onLeave() {
    rotX.set(0);
    rotY.set(0);
  }

  return (
    <div
      className={`[perspective:1200px] ${className}`}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        className={`relative w-full ${aspectClass} overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] will-change-transform`}
        style={
          reduced
            ? undefined
            : { rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" }
        }
      >
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          fallback ?? <DefaultFallback alt={alt} />
        )}
      </motion.div>
    </div>
  );
}

/** Minimal CSS card used only if no `fallback` is supplied. */
function DefaultFallback({ alt }: { alt: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1A1D24] to-[#111317]">
      <span className="sr-only">{alt}</span>
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-wl-info text-wl-info">
        ✓
      </div>
    </div>
  );
}
