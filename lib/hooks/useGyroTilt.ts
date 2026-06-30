"use client";

/**
 * useGyroTilt — device-orientation tilt for the 3D player card.
 *
 * Extracted verbatim (behaviour-preserving) from
 * components/shared/AthleteOnboardingWowMobile.tsx so the marketing
 * <PlayerCard3D> and the mobile onboarding WOW share one source.
 *
 * Returns degrees of tilt clamped to ±maxDeg plus `hasGyro` (true once
 * the first real deviceorientation event lands → lets the caller fall
 * back to mouse-tilt on desktop). Throttled to ~25 Hz with a 0.5° noise
 * threshold and ref-backed state so a 60 Hz sensor never causes a
 * re-render storm.
 *
 * Respects prefers-reduced-motion: when reduced, the listener is never
 * attached and tilt stays {0,0}.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface GyroTilt {
  tilt: { x: number; y: number };
  hasGyro: boolean;
}

export function useGyroTilt(maxDeg = 6): GyroTilt {
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasGyro, setHasGyro] = useState(false);
  const reduced = useReducedMotion();

  const lastTiltRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTsRef = useRef(0);
  const hasGyroRef = useRef(false);

  useEffect(() => {
    if (reduced) return; // a11y: no motion when the user opted out

    let cancelled = false;
    const THRESHOLD_DEG = 0.5; // ignore sensor noise under 0.5°
    const THROTTLE_MS = 40; // ~25 Hz — plenty smooth for a 3D tilt

    const handler = (e: DeviceOrientationEvent) => {
      if (cancelled) return;

      // 1) Throttle: at most one update per THROTTLE_MS.
      const now = e.timeStamp || 0;
      if (now - lastTsRef.current < THROTTLE_MS) return;
      lastTsRef.current = now;

      const beta = e.beta ?? 0; // -180..180 (front-back)
      const gamma = e.gamma ?? 0; // -90..90 (left-right)
      const x = Math.max(-maxDeg, Math.min(maxDeg, gamma / 4));
      const y = Math.max(-maxDeg, Math.min(maxDeg, -beta / 4));

      // Flip to gyro mode exactly once (ref → a single setState).
      if (!hasGyroRef.current) {
        hasGyroRef.current = true;
        setHasGyro(true);
      }

      // 2) Threshold: only re-render when the tilt moved past the noise
      // floor — kills the storm while keeping the tilt fluid.
      const last = lastTiltRef.current;
      if (Math.abs(x - last.x) < THRESHOLD_DEG && Math.abs(y - last.y) < THRESHOLD_DEG) return;
      lastTiltRef.current = { x, y };
      setTilt({ x, y });
    };

    try {
      window.addEventListener("deviceorientation", handler, { passive: true });
    } catch {
      /* SSR / window absent */
    }

    return () => {
      cancelled = true;
      try {
        window.removeEventListener("deviceorientation", handler);
      } catch {
        /* noop */
      }
    };
  }, [maxDeg, reduced]);

  return { tilt, hasGyro };
}
