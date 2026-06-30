"use client";

/**
 * FadeIn — scroll reveal wrapper for marketing sections.
 *
 * Fades + lifts its children when they scroll into view (once). Pass
 * `delay` (seconds) to stagger siblings — the athlete landing uses
 * 0 / .1 / .2 / .3. Renders a real element at all times so layout space
 * is reserved → no layout shift on reveal.
 *
 * Respects prefers-reduced-motion: when reduced, children render in
 * their final position with no transform or transition.
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

interface FadeInProps {
  children: ReactNode;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Vertical travel in px (default 16). */
  y?: number;
  className?: string;
  /** Render as a different element (default div). */
  as?: "div" | "li" | "section" | "span";
}

export default function FadeIn({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: FadeInProps) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as];

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}
