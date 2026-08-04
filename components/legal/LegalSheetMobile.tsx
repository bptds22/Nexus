"use client";

/* ═══════════════════════════════════════════════════════════════
   LegalSheetMobile — iter 7.50-a-bis (legal-2)

   Bottom sheet mobile qui rend l'un des 3 documents légaux
   (politique de confidentialité / conditions d'utilisation /
   collecte de données) DIRECTEMENT depuis la source unique
   content/legal/* — pas de PDF, pas de WebView externe.

   Réutilise le SectionRenderer validé en legal-1 → contenu
   strictement identique à la version web.

   Pattern canon (parité SearchSheet 7.50-a) :
   - createPortal(document.body) → s'échappe de tout containing-block
   - Z-70 (au-dessus des autres sheets et MobilePicker)
   - Backdrop fade + sheet slide-up cubic-bezier (canon Nexus mobile)
   - Drag-to-dismiss handle iOS (top du sheet)
   - Bouton "X" close en haut à droite (44×44 tactile)
   - safe-area-inset-bottom géré
   - Haptic Light à l'ouverture/fermeture
   - Body scrollable (overflow-y-auto)

   Le SectionRenderer s'inscrit dans le sheet sans variant — son
   rendu HTML est byte-identique au web (single source). Le sheet
   se contente d'ajouter un wrapper px-4 + max-w-none pour adapter
   à la largeur mobile (le web use max-w-6xl en parent).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SectionRenderer from "./SectionRenderer";
import { SECTIONS_CONFIDENTIALITE } from "@/content/legal/confidentialite";
import { SECTIONS_CONDITIONS } from "@/content/legal/conditions";
import { SECTIONS_COLLECTE_DONNEES } from "@/content/legal/collecte-donnees";
import type { Section } from "@/content/legal/types";
import { triggerHaptic } from "@/lib/haptics";

export type LegalDocKey = "confidentialite" | "conditions" | "collecte-donnees";

const SECTIONS_BY_KEY: Record<LegalDocKey, Section[]> = {
  "confidentialite": SECTIONS_CONFIDENTIALITE,
  "conditions": SECTIONS_CONDITIONS,
  "collecte-donnees": SECTIONS_COLLECTE_DONNEES,
};

// Titres = ceux utilisés par lib/i18n/dictionaries.ts:1300-1304 (FR
// signup consent labels). On ne fabrique rien — repris verbatim.
const TITLE_BY_KEY: Record<LegalDocKey, string> = {
  "confidentialite": "Politique de confidentialité",
  "conditions": "Conditions d'utilisation",
  "collecte-donnees": "Collecte et traitement des données",
};


interface LegalSheetMobileProps {
  /** Clé du document à afficher. null = sheet fermé. */
  docKey: LegalDocKey | null;
  onClose: () => void;
}

export function LegalSheetMobile({ docKey, onClose }: LegalSheetMobileProps) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!docKey) {
      setDragOffset(0);
      setIsDragging(false);
    } else {
      // Haptic à l'ouverture
      triggerHaptic("Light");
    }
  }, [docKey]);

  if (!mounted || !docKey) return null;

  let handleStartY = 0;
  const closeSheet = () => { triggerHaptic("Light"); onClose(); };

  const sections = SECTIONS_BY_KEY[docKey];
  const title = TITLE_BY_KEY[docKey];

  return createPortal(
    <>
      {/* Backdrop — opacité interpolée selon le drag */}
      <div
        className="fixed inset-0 z-[70]"
        style={{
          background: `rgba(0,0,0,${Math.max(0.2, 0.7 - dragOffset / 300)})`,
          animation: isDragging ? undefined : "nx-modal-fade 200ms ease-out forwards",
        }}
        onClick={closeSheet}
      />

      {/* Sheet plein écran (legal = long contenu, on prend ~95vh) */}
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-[#060A14] rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "95vh",
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
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0"
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header sticky : titre + close X */}
        <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <h2 className="font-head text-[16px] font-black uppercase tracking-tight text-white flex-1 min-w-0 truncate pr-3">
            {title}
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            aria-label="Fermer"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] -mr-2 flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body scrollable — SectionRenderer rendu tel quel (single
            source). Wrapper ajoute padding horizontal + retire le
            max-w hérité du parent web (la sheet a sa propre largeur). */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 py-6 max-w-none">
            <SectionRenderer sections={sections} />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
