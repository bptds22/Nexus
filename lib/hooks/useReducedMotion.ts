"use client";

/**
 * useReducedMotion — true when the OS "reduce motion" setting is on.
 *
 * SSR-safe: returns `false` on the server and first client render (so
 * markup matches), then updates after mount. Consumers use this to
 * disable tilt, marquee, gyro and count-up animations and render the
 * final/static state instead — per the athlete landing a11y contract.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    // addEventListener is the modern API; older Safari used addListener.
    if (mq.addEventListener) {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return reduced;
}
