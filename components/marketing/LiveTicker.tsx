"use client";

/**
 * LiveTicker — rotates through short status messages (the "who's
 * watching you" feed on the athlete landing). One message visible at a
 * time, swapped on an interval with an AnimatePresence cross-fade.
 *
 * Respects prefers-reduced-motion: messages still rotate (the content
 * is informational) but the slide/fade transition is dropped for an
 * instant swap.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface LiveTickerProps {
  messages: string[];
  /** Rotation interval in ms. */
  intervalMs?: number;
  className?: string;
}

export default function LiveTicker({ messages, intervalMs = 3800, className = "" }: LiveTickerProps) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % messages.length), intervalMs);
    return () => clearInterval(id);
  }, [messages.length, intervalMs]);

  const current = messages[i] ?? "";

  return (
    <div
      className={`relative flex h-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#1A1D24] px-6 ${className}`}
      aria-live="polite"
    >
      <span className="mr-3 h-2 w-2 shrink-0 rounded-full bg-wl-success shadow-[0_0_8px_rgba(34,197,94,0.8)]" aria-hidden />
      {reduced ? (
        <span className="truncate text-[13px] text-[#D1D5DB]">{current}</span>
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="truncate text-[13px] text-[#D1D5DB]"
          >
            {current}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  );
}
