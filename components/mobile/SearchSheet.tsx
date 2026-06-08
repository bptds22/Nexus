"use client";

/* ═══════════════════════════════════════════════════════════════
   SearchSheet — Bottom-sheet picker générique avec recherche
   (iter 7.50-a)

   Pattern réutilisable pour les pickers volumineux du onboarding
   athlète mobile (école, équipe civile, équipe scolaire, coach).

   Le composant gère uniquement l'UI du bottom-sheet :
   - Backdrop fade + sheet slide-up (canon Nexus mobile)
   - Drag-to-dismiss handle iOS
   - Input search 16px (no-zoom iOS)
   - Liste scrollable avec render slot
   - Loading / empty states
   - Footer slot optionnel (ex. "Continuer sans équipe")
   - Safe-area-inset-bottom géré

   La logique data (Supabase queries) est OWNED par le parent qui
   passe `items` + `loading` + un handler `onSearchChange`. C'est
   intentionnel : on évite de réécrire les data-loaders existants
   (SchoolSelect, CoachPicker, CivilTeamPicker, SchoolTeamPicker)
   — le parent les WRAPS via async functions inline.

   Z-index 70 (au-dessus de tout MobilePicker à 60).
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

export interface SearchSheetProps<T> {
  open: boolean;
  onClose: () => void;
  /** Titre affiché en haut du sheet. */
  title: string;
  /** Placeholder de l'input search. */
  searchPlaceholder?: string;
  /** Valeur courante de la recherche (contrôlée par le parent). */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Résultats filtrés à afficher. */
  items: T[];
  /** Loading flag pour le state initial / refetch. */
  loading?: boolean;
  /** Render slot pour chaque item. Reçoit l'item + un onTap qui ferme le sheet. */
  renderItem: (item: T, onSelect: () => void) => ReactNode;
  /** Identifiant unique par item pour le React key. */
  keyOf: (item: T) => string;
  /** Callback quand l'utilisateur tap un item. Le sheet se ferme automatiquement après. */
  onSelect: (item: T) => void;
  /** Composant à afficher si items vide hors loading (ex. EmptyState). */
  emptyContent?: ReactNode;
  /** Slot footer optionnel rendu en bas du sheet (ex. CTA "Continuer sans équipe"). */
  footer?: ReactNode;
}

export function SearchSheet<T>({
  open,
  onClose,
  title,
  searchPlaceholder = "Rechercher…",
  searchValue,
  onSearchChange,
  items,
  loading = false,
  renderItem,
  keyOf,
  onSelect,
  emptyContent,
  footer,
}: SearchSheetProps<T>) {
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.6 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={closeSheet}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-[#111317] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "85vh",
          paddingBottom: "env(safe-area-inset-bottom)",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          animation: isDragging || dragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        {/* Drag handle */}
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
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header : titre + close */}
        <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="font-head text-[18px] font-black uppercase tracking-tight text-white truncate">
            {title}
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            aria-label="Fermer"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] -mr-3"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input — 16px = no iOS auto-zoom */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="w-full bg-white/[0.06] rounded-2xl pl-9 pr-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
            />
          </div>
        </div>

        {/* Liste résultats */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="space-y-2 pt-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[60px] rounded-2xl bg-[#1A1D24] animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            emptyContent ?? (
              <p className="text-center text-[14px] text-white/55 py-12">
                Aucun résultat.
              </p>
            )
          ) : (
            <ul className="space-y-2">
              {items.map((it) => (
                <li key={keyOf(it)}>
                  {renderItem(it, () => {
                    triggerHaptic("Light");
                    onSelect(it);
                    onClose();
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer slot */}
        {footer && (
          <div className="px-4 py-3 border-t border-white/[0.06]">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
