"use client";

/* ═══════════════════════════════════════════════════════════════
   MobilePicker — Bottom Sheet picker unifié (iter 5.4)

   Remplace les <select> HTML natifs par un pattern Bottom Sheet
   identique au modal Signaler / Action Sheet.

   - Rendu via Portal vers document.body (z-[60])
   - Backdrop fade-in 200ms, sheet slide-up 280ms cubic-bezier(0.34, 1.56, 0.64, 1)
   - Handle iOS + swipe-down dismiss + bouton Annuler card séparée
   - Touch-target 56px, séparateurs 0.5px white/8
   - Sélection = check rouge à droite (PAS de radio vide gris — minimaliste iOS)
   - Haptic Light à l'ouverture, au tap item, au dismiss

   Référence design : docs/mobile-design-system.md §4 Composants canon.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

async function triggerHaptic(intensity: "Light" | "Medium" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : ImpactStyle.Medium;
    await Haptics.impact({ style });
  } catch { /* no-op */ }
}

export type PickerOption = {
  value: string | number | null;
  label: string;
  icon?: ReactNode;
};

interface MobilePickerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  options: PickerOption[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
}

export function MobilePicker({ open, onClose, title, options, value, onChange }: MobilePickerProps) {
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
  const selectOption = (v: string | number | null) => {
    triggerHaptic("Light");
    onChange(v);
    window.setTimeout(() => onClose(), 50);
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
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          padding: "0 12px calc(env(safe-area-inset-bottom) + 16px) 12px",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isDragging || dragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* Card items */}
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
            <div className="px-5 pt-1 pb-3 text-center">
              <span className="text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">{title}</span>
            </div>
          )}

          {/* Options scrollables */}
          <div className="overflow-y-auto" style={{ maxHeight: "70dvh" }}>
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  onClick={() => selectOption(opt.value)}
                  className="w-full flex items-center justify-between px-4 text-left active:bg-white/[0.04]"
                  style={{
                    height: 56,
                    borderTop: idx > 0 ? "0.5px solid rgba(255,255,255,0.08)" : undefined,
                  }}
                >
                  <span className="flex items-center gap-3 flex-1 min-w-0">
                    {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                    <span className="text-[15px] font-medium text-white truncate">{opt.label}</span>
                  </span>
                  {isSelected && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 ml-3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cancel card séparée */}
        <button
          type="button"
          onClick={closeSheet}
          className="w-full mt-2 rounded-2xl bg-[#1A1D24] active:bg-white/[0.04]"
          style={{ height: 56, color: "#E63946", fontSize: 15, fontWeight: 600 }}
        >
          Annuler
        </button>
      </div>
    </>,
    document.body,
  );
}

/* Hook compagnon — gère l'état open/value pour les pages */
export function useMobilePicker<T extends string | number | null>(initialValue: T) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  return {
    value,
    setValue,
    open,
    openPicker: () => {
      triggerHaptic("Light");
      setOpen(true);
    },
    closePicker: () => setOpen(false),
  };
}
