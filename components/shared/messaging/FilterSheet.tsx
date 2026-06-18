"use client";

/* ═══════════════════════════════════════════════════════════════
   FilterSheet — bottom-sheet single-select used by the messaging
   list header. Extracted verbatim from RecruteurMessagesMobile.

   Parameterized : the filter options + current value + onChange
   come from the parent (role-specific labels). The portal,
   drag-to-dismiss handle, slide-up animation, and check-mark
   selection are agnostic.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { triggerHaptic } from "./utils";

export interface FilterOption<V extends string> {
  value: V;
  label: string;
}

export interface FilterSheetProps<V extends string> {
  open: boolean;
  onClose: () => void;
  value: V;
  onChange: (v: V) => void;
  options: FilterOption<V>[];
  /** Heading shown above the option list. Defaults to "Filtrer". */
  title?: string;
}

export function FilterSheet<V extends string>({
  open, onClose, value, onChange, options, title = "Filtrer",
}: FilterSheetProps<V>) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  if (!mounted) return null;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={closeSheet}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: dragOffset }}
            exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            style={{ maxHeight: "60vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div
              onTouchStart={(e) => { setIsDragging(true); dragStartYRef.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
                setDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (dragOffset > 100) closeSheet();
                else setDragOffset(0);
                setIsDragging(false);
                dragStartYRef.current = 0;
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            </div>
            <h2 className="px-5 pb-3 text-[12px] uppercase tracking-[0.18em] text-white/50 font-bold">
              {title}
            </h2>
            <div className="mx-4 mb-4 bg-[#1A1D24] rounded-2xl overflow-hidden">
              {options.map((opt) => {
                const active = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { triggerHaptic("Light"); onChange(opt.value); closeSheet(); }}
                    className="flex items-center justify-between w-full px-4 py-3.5 border-b border-white/[0.06] last:border-b-0 text-left active:bg-white/[0.03]"
                  >
                    <span className="text-[15px] text-white/95 font-medium">{opt.label}</span>
                    {active && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
