"use client";

/**
 * useCountUp — animate a number from 0 → target the first time the
 * returned ref scrolls into view.
 *
 * Returns `{ value, ref }`: attach `ref` to the element that should
 * trigger the count when it enters the viewport. The animation runs
 * once. Respects prefers-reduced-motion (and SSR) by snapping straight
 * to the final value with no animation — so the space is always
 * reserved and there is no layout shift.
 *
 * easeOutCubic gives the "fast then settle" feel used on the red stat
 * bar of the athlete landing page.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

interface CountUpOptions {
  /** Animation duration in ms. */
  durationMs?: number;
  /** IntersectionObserver threshold. */
  threshold?: number;
}

export function useCountUp<T extends HTMLElement = HTMLDivElement>(
  target: number,
  options: CountUpOptions = {}
) {
  const { durationMs = 1600, threshold = 0.35 } = options;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const ref = useRef<T | null>(null);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Reduced motion / SSR: snap to the final value, no animation.
    if (reduced) {
      setValue(target);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      let startTs = 0;
      const tick = (ts: number) => {
        if (!startTs) startTs = ts;
        const p = Math.min(1, (ts - startTs) / durationMs);
        setValue(Math.round(easeOutCubic(p) * target));
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs, threshold, reduced]);

  return { value, ref };
}
