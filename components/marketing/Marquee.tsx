"use client";

/**
 * Marquee — an infinite horizontal loop of pills (the sports list on
 * the athlete landing). The track is duplicated and translated -50% so
 * the loop is seamless. Driven by framer-motion, so no globals.css
 * keyframes are needed.
 *
 * Respects prefers-reduced-motion: renders the items once as a static
 * centred wrap, no animation.
 */

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface MarqueeProps {
  items: string[];
  /** Seconds for one full loop. */
  durationSec?: number;
  className?: string;
}

function Pill({ label }: { label: string }) {
  return (
    <span className="mx-2 inline-flex shrink-0 items-center rounded-full border border-white/10 bg-[#1A1D24] px-5 py-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
      {label}
    </span>
  );
}

export default function Marquee({ items, durationSec = 64, className = "" }: MarqueeProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-y-3 py-2 ${className}`}>
        {items.map((label) => (
          <Pill key={label} label={label} />
        ))}
      </div>
    );
  }

  return (
    <div className={`group relative overflow-hidden ${className}`} aria-hidden>
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#111317] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#111317] to-transparent" />
      <motion.div
        className="flex w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: durationSec, ease: "linear", repeat: Infinity }}
      >
        {[...items, ...items].map((label, i) => (
          <Pill key={`${label}-${i}`} label={label} />
        ))}
      </motion.div>
    </div>
  );
}
