"use client";

/* ═══════════════════════════════════════════════════════════════
   FilterBottomSheetShell — LA feuille de filtre du recruteur, mobile
   (décision BP 2026-10-05) : Recherche et Mon processus doivent utiliser
   EXACTEMENT le même composant — même feuille, mêmes animations, même
   comportement — chacun avec SES champs.

   Extrait VERBATIM de `FiltersBottomSheet` (RecruteurRechercheMobile.tsx,
   iter 6.0d) : le shell (overlay, drag-to-dismiss, en-tête Annuler/Filtres/
   Réinitialiser, pied « Appliquer »), `FilterRow` (une ligne tap-to-open,
   ouvre un MobilePicker chez l'appelant) et `TogglePill` (pastille on/off).
   Recherche garde ses MobilePicker, ses sections de pilules et son
   `FiltersBottomSheet` (désormais un fin wrapper de ce shell) : zéro
   changement de comportement pour elle. Mon processus compose SES champs
   (Sport, Ligue, Région, Position, Promotion, Trier par) avec les mêmes
   primitives — plus de feuille à base de <select> natifs.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { triggerHaptic } from "@/lib/haptics";

export function FilterRow({
  label, value, onTap, disabled, disabledReason,
}: {
  label: string;
  value: string;
  onTap: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) { triggerHaptic("Light"); onTap(); } }}
      disabled={disabled}
      className={`flex items-center justify-between w-full px-4 py-3.5 border-b border-white/[0.06] last:border-b-0 text-left ${disabled ? "opacity-40" : "active:bg-white/[0.03]"} transition-colors`}
    >
      <span className="text-[15px] text-white/95 font-medium">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[14px] text-white/50 truncate max-w-[180px]">
          {disabled && disabledReason ? disabledReason : value}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-white/30">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}

export function TogglePill({ active, label, onTap }: { active: boolean; label: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { triggerHaptic("Light"); onTap(); }}
      className={`nx-mobile-touch-min inline-flex items-center gap-1.5 px-4 rounded-full text-[12px] font-bold transition-colors ${
        active
          ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30"
          : "bg-[#0C0E12] text-[#9CA3AF] border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

export interface FilterBottomSheetShellProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  resultCount: number;
  /** Les lignes (FilterRow) et sections (pilules, blocs propres à l'écran) —
   *  chaque appelant compose les siennes avec les mêmes primitives. */
  children: ReactNode;
  /** « Appliquer (12 athlètes) » par défaut — personnalisable si un futur
   *  appelant ne liste pas des athlètes. */
  libelleApplique?: (n: number) => string;
}

export function FilterBottomSheetShell({
  open, onClose, onReset, resultCount, children,
  libelleApplique = (n) => `Appliquer${n > 0 ? ` (${n} athlète${n !== 1 ? "s" : ""})` : ""}`,
}: FilterBottomSheetShellProps) {
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

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={closeSheet}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] bg-[#1A1D24] rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "90vh",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isDragging || dragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <div
          onTouchStart={(e) => { setIsDragging(true); handleStartY = e.touches[0].clientY; }}
          onTouchMove={(e) => {
            if (!isDragging && handleStartY === 0) return;
            const dy = Math.max(0, e.touches[0].clientY - handleStartY);
            setDragOffset(dy);
          }}
          onTouchEnd={() => {
            if (dragOffset > 100) closeSheet();
            else setDragOffset(0);
            setIsDragging(false); handleStartY = 0;
          }}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="px-5 pb-3 flex items-center justify-between border-b border-white/[0.06]">
            <button type="button" onClick={closeSheet} className="text-[#E63946] text-[15px] font-medium">Annuler</button>
            <span className="text-[15px] font-bold text-white">Filtres</span>
            <button type="button" onClick={() => { triggerHaptic("Light"); onReset(); }} className="text-[#9CA3AF] text-[14px]">Réinitialiser</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {children}
        </div>

        <div className="border-t border-white/[0.06] p-4">
          <button
            type="button"
            onClick={closeSheet}
            className="w-full h-14 rounded-2xl bg-[#E63946] text-white text-[15px] font-bold active:bg-[#D42B22]"
          >
            {libelleApplique(resultCount)}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes nx-modal-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nx-modal-slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>,
    document.body,
  );
}
