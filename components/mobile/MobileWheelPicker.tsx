"use client";

/* ═══════════════════════════════════════════════════════════════
   MobileWheelPicker — iOS-style scroll-snap wheel.

   Mirrors MobilePicker's chrome (portal, backdrop fade, slide-up,
   drag-to-dismiss handle, separate "Terminé" card) but the inner
   list is a SNAP WHEEL :
     - scroll-snap-type: y mandatory ; each item snap-center
     - top + bottom spacer = (visible height − item height) / 2 so
       the first and last options can center
     - center indicator band (subtle border-y over the center row)
     - opacity falloff above / below the centered item
     - haptic Light as each item crosses the center
     - commit on scroll-end (120ms debounce after the last scroll
       event) ; the "Terminé" card just closes
     - multi-column support : pass N columns, each scrolls
       independently, onCommit receives the array of values

   Same prop ergonomics as MobilePicker so consumers can swap.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const VISIBLE_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SPACER = (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2;
const COMMIT_DEBOUNCE_MS = 120;

export type WheelOption = { value: string | number | null; label: string };

export interface WheelColumn {
  key: string;
  options: WheelOption[];
  value: string | number | null;
  /** Optional label shown above the column. */
  label?: string;
}

export interface MobileWheelPickerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  columns: WheelColumn[];
  /** Called with the values array (one per column) once the wheel
   *  settles. Fires on every scroll-stop (live commits). */
  onCommit: (values: (string | number | null)[]) => void;
  /** Optional content above the columns (e.g. unit toggle). */
  headerExtra?: ReactNode;
}

export function MobileWheelPicker({
  open, onClose, title, columns, onCommit, headerExtra,
}: MobileWheelPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) { setDragOffset(0); setIsDragging(false); }
  }, [open]);

  if (!mounted || !open) return null;

  let handleStartY = 0;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  // The current values per column live here ; the wheel columns
  // emit their settled value through `onColumnChange` and we relay
  // the whole array to the parent via onCommit.
  const handleColumnChange = (colIdx: number, value: WheelOption["value"]) => {
    const next = columns.map((c, j) => j === colIdx ? value : c.value);
    onCommit(next);
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={closeSheet}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60]"
        style={{
          padding: "0 12px calc(env(safe-area-inset-bottom) + 16px) 12px",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isDragging || dragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* Card */}
        <div className="bg-[#1A1D24] rounded-2xl overflow-hidden">
          {/* Handle + swipe-down */}
          <div
            className="flex justify-center pt-3 pb-2"
            onTouchStart={(e) => { setIsDragging(true); handleStartY = e.touches[0].clientY; }}
            onTouchMove={(e) => {
              if (!isDragging && handleStartY === 0) return;
              const dy = Math.max(0, e.touches[0].clientY - handleStartY);
              setDragOffset(dy);
            }}
            onTouchEnd={() => {
              if (dragOffset > 100) closeSheet();
              else setDragOffset(0);
              setIsDragging(false);
              handleStartY = 0;
            }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {title && (
            <div className="px-5 pt-1 pb-2 text-center">
              <span className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">{title}</span>
            </div>
          )}

          {headerExtra && (
            <div className="px-4 pb-3">{headerExtra}</div>
          )}

          {/* Wheel area */}
          <div className="px-3 pt-1 pb-3">
            {/* Optional column labels row — kept OUTSIDE the band+overlays
                wrapper so the band's vertical math stays anchored to the
                column area only (the previous version put the band on the
                outer relative container, so the labels row pushed the
                columns down by ~14px while the band stayed put → bold
                row sat one slot below the band). */}
            {columns.some((c) => c.label) && (
              <div className="flex items-stretch gap-2 mb-1">
                {columns.map((c, i) => (
                  <div key={`hdr-${i}`} className="flex-1 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">
                      {c.label || ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Column area + band + overlays — own relative wrapper. */}
            <div className="relative" style={{ height: VISIBLE_HEIGHT }}>
              {/* Center indicator band — exact center of the column area
                  (top = SPACER, height = ITEM_HEIGHT). */}
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-y border-white/[0.10]"
                style={{
                  top: SPACER,
                  height: ITEM_HEIGHT,
                }}
              />

              {/* Top fade — sits within the column area, fades the rows
                  above the band toward the card color. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-20"
                style={{
                  height: SPACER,
                  background: "linear-gradient(to bottom, #1A1D24 0%, rgba(26,29,36,0.85) 50%, transparent 100%)",
                }}
              />
              {/* Bottom fade — symmetric below the band. */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-20"
                style={{
                  height: SPACER,
                  background: "linear-gradient(to top, #1A1D24 0%, rgba(26,29,36,0.85) 50%, transparent 100%)",
                }}
              />

              {/* Columns — fill the wrapper. */}
              <div className="relative z-0 flex items-stretch gap-2 h-full">
                {columns.map((col, ci) => (
                  <WheelScroller
                    key={`${col.key}-${columns.length}`}
                    column={col}
                    onSettle={(val) => handleColumnChange(ci, val)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Terminé / Annuler card */}
        <button
          type="button"
          onClick={closeSheet}
          className="w-full mt-2 rounded-2xl bg-[#1A1D24] active:bg-white/[0.04]"
          style={{ height: 56, color: "#E63946", fontSize: 15, fontWeight: 600 }}
        >
          Terminé
        </button>
      </div>

      {/* Hide the column scrollbars without polluting global CSS. */}
      <style>{`
        .nx-wheel-scroller { scrollbar-width: none; -ms-overflow-style: none; }
        .nx-wheel-scroller::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>
    </>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════
   WheelScroller — single column. Snap-scroll, debounced commit,
   opacity falloff, haptic on cross-center.
═══════════════════════════════════════════════════════════════ */
function WheelScroller({
  column, onSettle,
}: {
  column: WheelColumn;
  onSettle: (value: WheelOption["value"]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIdxRef = useRef<number>(-1);

  // Resolve initial centered index from current value.
  const initialIdx = (() => {
    const i = column.options.findIndex((o) => String(o.value) === String(column.value));
    return i >= 0 ? i : 0;
  })();

  const [activeIdx, setActiveIdx] = useState<number>(initialIdx);

  // Snap scroll position to current value on mount + when value
  // changes externally (e.g. parent reset).
  useEffect(() => {
    if (!scrollRef.current) return;
    const idx = column.options.findIndex((o) => String(o.value) === String(column.value));
    if (idx < 0) return;
    const currentIdx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    if (currentIdx === idx) return;
    scrollRef.current.scrollTop = idx * ITEM_HEIGHT;
    setActiveIdx(idx);
    prevIdxRef.current = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column.value, column.options.length]);

  // Initialize prevIdxRef once so the first scroll doesn't fire a
  // haptic for a non-movement.
  useEffect(() => { prevIdxRef.current = initialIdx; /* one-shot */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(column.options.length - 1, idx));
    if (clamped !== prevIdxRef.current) {
      triggerHaptic("Light");
      prevIdxRef.current = clamped;
      setActiveIdx(clamped);
    }
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      const settledIdx = Math.round((scrollRef.current?.scrollTop ?? 0) / ITEM_HEIGHT);
      const c = Math.max(0, Math.min(column.options.length - 1, settledIdx));
      onSettle(column.options[c].value);
    }, COMMIT_DEBOUNCE_MS);
  };

  // Clean up the settle timer on unmount.
  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-scroll snap-y snap-mandatory nx-wheel-scroller"
      style={{ height: VISIBLE_HEIGHT, scrollSnapType: "y mandatory" }}
    >
      <div style={{ height: SPACER }} />
      {column.options.map((opt, idx) => {
        const distance = Math.abs(idx - activeIdx);
        const opacity = distance === 0 ? 1 : distance === 1 ? 0.6 : distance === 2 ? 0.3 : 0.12;
        // Readability tiers : the centered row pops (white 22px
        // extrabold) ; neighbors fall off in size + weight + tint
        // so the active selection is unmistakable.
        const textCls =
          distance === 0
            ? "text-[22px] font-extrabold text-white tracking-tight"
            : distance === 1
              ? "text-[17px] font-semibold text-white/75"
              : distance === 2
                ? "text-[14px] font-medium text-white/50"
                : "text-[12px] font-normal text-white/35";
        return (
          <div
            key={`${opt.value}-${idx}`}
            className="snap-center flex items-center justify-center"
            style={{ height: ITEM_HEIGHT, opacity, scrollSnapAlign: "center" }}
          >
            <span className={textCls}>
              {opt.label}
            </span>
          </div>
        );
      })}
      <div style={{ height: SPACER }} />
    </div>
  );
}
