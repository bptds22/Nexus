"use client";

/* ═══════════════════════════════════════════════════════════════
   SwipeableRow — generic per-row swipe-to-reveal-action wrapper.

   Extracted from messaging/MessagesListShell.tsx's
   ThreadRowSwipe (the proven swipe-to-archive gesture). Wraps any
   row content and reveals a single action layer (label + icon +
   color) behind the row as the user drags left. Past the threshold,
   `onCommit` fires. The wrapper does NOT execute the action ; the
   caller decides what to do (delete, archive, open ConfirmSheet…).

   Behavior canon — kept identical to ThreadRowSwipe :
   - drag="x" with dragConstraints { left: 0, right: 0 }
     (constrained, snaps back when released under threshold).
   - dragElastic = 0.4 (allows visual overshoot past constraint).
   - dragMomentum = false (no fling-past-threshold ; user controls
     the full motion to threshold).
   - Threshold default 100px (same as messages SWIPE_THRESHOLD).
   - Action-layer opacity ramp via useTransform(x,
     [-threshold, -40, 0], [1, 0.4, 0]).
   - `disabled` opt-out (messages edit-mode uses this : drag=false
     when row is in select-mode).

   Reused by : messaging archive (gray, label "Archiver"), team-
   detail athlete remove (red, label "Retirer" → ConfirmSheet).
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

export interface SwipeableRowAction {
  /** Short uppercase label shown beneath the icon ("Archiver", "Retirer"). */
  label: string;
  /** Action glyph rendered in the reveal layer. */
  icon: ReactNode;
  /** Foreground color (icon + label). Also used as the 20%-tint
   *  background unless bgColor overrides it. */
  color: string;
  /** Optional background hex. Defaults to `${color}33` (20% alpha).
   *  Use this to mirror an existing token (e.g. messages archive
   *  used #6B7280 bg + #9CA3AF foreground). */
  bgColor?: string;
}

export interface SwipeableRowProps {
  /** The visible row content (motion.div sits on top of the action layer). */
  children: ReactNode;
  /** Action revealed on left-swipe. */
  action: SwipeableRowAction;
  /** Px past which onCommit fires on release. Default 100 (messages canon). */
  threshold?: number;
  /** Fired when the user releases past `threshold`. Caller decides what to do
   *  (mutate immediately, or open a ConfirmSheet for destructive actions). */
  onCommit: () => void;
  /** When true, drag is disabled (e.g. messages edit-mode). */
  disabled?: boolean;
  /** Optional className passed to the foreground motion.div (background +
   *  z-index). Default = "relative bg-[#111317] z-[1]" (messages canon). */
  rowClassName?: string;
}

export function SwipeableRow({
  children, action, threshold = 100, onCommit, disabled = false,
  rowClassName = "relative bg-[#111317] z-[1]",
}: SwipeableRowProps) {
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [-threshold, -40, 0], [1, 0.4, 0]);

  return (
    <div className="relative">
      {/* Reveal layer — fades in from 0 → 1 as the user drags past 40px.
          Pointer-events disabled : the row above intercepts taps. */}
      <motion.div
        style={{
          opacity: actionOpacity,
          backgroundColor: `${action.bgColor ?? action.color}33`,
        }}
        className="absolute inset-0 flex items-center justify-end pr-5 pointer-events-none"
      >
        <div className="flex flex-col items-center" style={{ color: action.color }}>
          {action.icon}
          <span className="text-[10px] uppercase tracking-wider font-bold mt-1">
            {action.label}
          </span>
        </div>
      </motion.div>

      {/* Foreground row — draggable horizontally. */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -threshold) {
            onCommit();
          }
        }}
        className={rowClassName}
      >
        {children}
      </motion.div>
    </div>
  );
}
