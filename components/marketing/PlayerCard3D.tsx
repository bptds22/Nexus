"use client";

/**
 * PlayerCard3D — a 3D-tilting frame that holds the hero player-card
 * image (provided by BP). Tilts to the mouse on desktop and to the
 * device gyroscope on mobile (shared useGyroTilt). If the image is
 * missing or fails to load, a clean CSS fallback card is shown instead
 * — pass it via `fallback`.
 *
 * The image is expected to already carry its own card chrome (verified
 * badge, stars, etc.), so nothing is drawn over it. The fallback, by
 * contrast, renders the chrome itself.
 *
 * Respects prefers-reduced-motion: tilt is disabled (flat card).
 */

import { useRef, useState, type ReactNode } from "react";
import { useGyroTilt } from "@/lib/hooks/useGyroTilt";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface PlayerCard3DProps {
  /** Source of the BP card image. */
  src: string;
  alt: string;
  /** Shown when `src` fails to load (e.g. asset not yet delivered). */
  fallback?: ReactNode;
  className?: string;
}

const MAX_DEG = 8;

export default function PlayerCard3D({ src, alt, fallback, className = "" }: PlayerCard3DProps) {
  const reduced = useReducedMotion();
  const { tilt, hasGyro } = useGyroTilt(MAX_DEG);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imgFailed, setImgFailed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || hasGyro) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setMouse({ x: px * MAX_DEG * 2, y: -py * MAX_DEG * 2 });
  }

  function onLeave() {
    setMouse({ x: 0, y: 0 });
  }

  // Gyro wins on mobile, mouse drives on desktop, flat when reduced.
  const rx = reduced ? 0 : hasGyro ? tilt.y : mouse.y;
  const ry = reduced ? 0 : hasGyro ? tilt.x : mouse.x;

  return (
    <div className={`[perspective:1200px] ${className}`} ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div
        className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] transition-transform duration-150 will-change-transform"
        style={{
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {!imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          fallback ?? <DefaultFallback alt={alt} />
        )}
      </div>
    </div>
  );
}

/** Minimal CSS card used only if no `fallback` is supplied. */
function DefaultFallback({ alt }: { alt: string }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-b from-[#1A1D24] to-[#111317] flex items-center justify-center">
      <span className="sr-only">{alt}</span>
      <div className="w-12 h-12 rounded-full border-2 border-wl-info flex items-center justify-center text-wl-info">
        ✓
      </div>
    </div>
  );
}
