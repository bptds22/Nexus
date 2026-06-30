"use client";

/**
 * PlayerCard3D — a 3D-tilting frame holding the hero player-card image.
 * The image already carries its own chrome (badge, stars); nothing is
 * drawn over it.
 *
 * TILT — diagnosed cause of the earlier "no tilt": the mouse handler
 * early-returned whenever `hasGyro` was true, and `useGyroTilt` flips
 * `hasGyro` on the FIRST deviceorientation event — which Windows
 * laptops / 2-in-1s with orientation sensors DO emit (often ~0°). So on
 * those machines mouse tilt was disabled while the stationary gyro gave
 * 0° → the card never moved. Fix: gate by POINTER TYPE, not by gyro
 * presence — `(pointer: fine)` drives mouse tilt and ignores gyro;
 * `(pointer: coarse)` uses the gyro.
 *
 * Structure: perspective on the parent (inline, matching the proven
 * mobile WOW card), rotateX/rotateY + scale on the child via
 * useMotionValue → useSpring. A tilt-following drop shadow + a red halo
 * + a hairline edge give it physical presence. prefers-reduced-motion
 * disables the tilt (flat card, static shadow kept).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "framer-motion";
import { useGyroTilt } from "@/lib/hooks/useGyroTilt";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface PlayerCard3DProps {
  src: string;
  alt: string;
  fallback?: ReactNode;
  /** Aspect ratio of the card frame (default 2/3, the BP card's ratio). */
  aspectClass?: string;
  className?: string;
}

const MAX_DEG = 15;
const ROT_SPRING = { stiffness: 150, damping: 15, mass: 0.4 };

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
  const [coarse, setCoarse] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const hover = useMotionValue(0);
  const springX = useSpring(rotX, ROT_SPRING);
  const springY = useSpring(rotY, ROT_SPRING);
  const springHover = useSpring(hover, { stiffness: 200, damping: 22 });
  const scale = useTransform(springHover, [0, 1], [1, 1.04]);

  // Drop shadow follows the tilt (offsets opposite to the rotation).
  const shadowX = useTransform(springY, [-MAX_DEG, MAX_DEG], [30, -30]);
  const shadowY = useTransform(springX, [-MAX_DEG, MAX_DEG], [-30, 30]);
  const boxShadow = useMotionTemplate`${shadowX}px ${shadowY}px 80px -20px rgba(0,0,0,0.65)`;

  // Mobile/touch only: feed gyro into the same springs.
  useEffect(() => {
    if (reduced || !coarse || !hasGyro) return;
    rotX.set(tilt.y);
    rotY.set(tilt.x);
  }, [reduced, coarse, hasGyro, tilt.x, tilt.y, rotX, rotY]);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || coarse) return; // desktop pointer only
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    rotY.set(px * MAX_DEG * 2);
    rotX.set(-py * MAX_DEG * 2);
    hover.set(1);
  }

  function onLeave() {
    rotX.set(0);
    rotY.set(0);
    hover.set(0);
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: 1000 }}
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* Soft red halo behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[40px]"
        style={{
          background: "radial-gradient(closest-side, rgba(230,57,70,0.28), transparent 75%)",
          filter: "blur(6px)",
        }}
      />
      <motion.div
        className={`relative w-full ${aspectClass} overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]`}
        style={
          reduced
            ? undefined
            : { rotateX: springX, rotateY: springY, scale, boxShadow, transformStyle: "preserve-3d" }
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
