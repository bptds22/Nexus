"use client";

/**
 * ProgressRing — an animated SVG progress ring (rendered, never a
 * screenshot). The stroke draws from 0 → `pct` the first time it
 * scrolls into view via stroke-dashoffset.
 *
 * Respects prefers-reduced-motion: the ring renders at its final value
 * with no transition.
 */

import { useRef } from "react";
import { useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface ProgressRingProps {
  /** Target percentage 0..100. */
  pct: number;
  size?: number;
  stroke?: number;
  /** Big centred value (e.g. "70%"). */
  label?: string;
  /** Small line under the value. */
  sublabel?: string;
  className?: string;
}

export default function ProgressRing({
  pct,
  size = 180,
  stroke = 12,
  label,
  sublabel,
  className = "",
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const active = reduced || inView;

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
          style={{ transition: reduced ? "none" : "stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {label && <span className="nx-display text-3xl font-black text-white">{label}</span>}
          {sublabel && (
            <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
