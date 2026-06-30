"use client";

/**
 * ProgressRing — an animated SVG progress ring (rendered, never a
 * screenshot). When it scrolls into view the ring fills 0 → `pct` and
 * the centre number counts 0 → `pct` in lockstep (~2s, ease-out cubic).
 *
 * Respects prefers-reduced-motion: renders the final value immediately,
 * no transition, no count.
 */

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface ProgressRingProps {
  /** Target percentage 0..100. */
  pct: number;
  size?: number;
  stroke?: number;
  /** Suffix appended to the centre number (default "%"). */
  suffix?: string;
  /** Small line under the value. */
  sublabel?: string;
  /** Count-up / fill duration in ms. */
  durationMs?: number;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ProgressRing({
  pct,
  size = 180,
  stroke = 12,
  suffix = "%",
  sublabel,
  durationMs = 2000,
  className = "",
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const active = reduced || inView;

  const [count, setCount] = useState(reduced ? pct : 0);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setCount(pct);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / durationMs);
      setCount(Math.round(easeOutCubic(p) * pct));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, pct, durationMs]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (active ? pct : 0) / 100);

  return (
    <div ref={ref} className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2D3748" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E63946"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: reduced ? "none" : `stroke-dashoffset ${durationMs}ms cubic-bezier(0.22,1,0.36,1)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="nx-display text-4xl font-black text-white">
          {count}
          {suffix}
        </span>
        {sublabel && (
          <span className="mt-1 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
