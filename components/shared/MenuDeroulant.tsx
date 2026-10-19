"use client";

/* ═══════════════════════════════════════════════════════════════
   MenuDeroulant — un menu déroulant ACCROCHÉ à son bouton (BP 2026-10-19 :
   « je veux un menu déroulant comme tout le reste, pas une fenêtre » — et le
   menu en absolu se faisait couper par la page).

   Porté sur <body> en position fixe, sous le bouton (au-dessus s'il manque
   de place en bas), aligné sur le bord du bouton le plus proche de l'écran,
   jamais hors de l'écran. Toucher dehors ou Échap ferme. Défile s'il est long.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export interface PositionMenu { top?: number; bottom?: number; left: number; width: number; maxHeight: number }

/** Où poser le menu : sous l'ancre (au-dessus si la place manque), dans l'écran, à 8 px du bord. */
export function placerMenu(ancre: { top: number; bottom: number; left: number; right: number }, ecran: { w: number; h: number }, largeur = 300): PositionMenu {
  const marge = 8;
  const width = Math.min(largeur, ecran.w - 2 * marge);
  const aDroite = ancre.left + (ancre.right - ancre.left) / 2 > ecran.w / 2;
  let left = aDroite ? ancre.right - width : ancre.left;
  left = Math.max(marge, Math.min(left, ecran.w - width - marge));
  const dessous = ecran.h - ancre.bottom - marge;
  const dessus = ancre.top - marge;
  if (dessous >= 220 || dessous >= dessus) {
    return { top: ancre.bottom + 6, left, width, maxHeight: Math.max(120, dessous - 6) };
  }
  return { bottom: ecran.h - ancre.top + 6, left, width, maxHeight: Math.max(120, dessus - 6) };
}

export default function MenuDeroulant({ ancre, onFermer, largeur = 300, children, testId }: {
  ancre: RefObject<HTMLElement | null>;
  onFermer: () => void;
  largeur?: number;
  children: ReactNode;
  testId?: string;
}) {
  const [pos, setPos] = useState<PositionMenu | null>(null);
  const menu = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const placer = () => {
      const r = ancre.current?.getBoundingClientRect();
      if (!r) return;
      setPos(placerMenu(r, { w: window.innerWidth, h: window.innerHeight }, largeur));
    };
    placer();
    window.addEventListener("resize", placer);
    window.addEventListener("scroll", placer, true);
    return () => { window.removeEventListener("resize", placer); window.removeEventListener("scroll", placer, true); };
  }, [ancre, largeur]);

  useEffect(() => {
    const dehors = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || ancre.current?.contains(t)) return;
      onFermer();
    };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("pointerdown", dehors); document.removeEventListener("keydown", echap); };
  }, [ancre, onFermer]);

  if (!pos || typeof document === "undefined") return null;
  return createPortal(
    <div ref={menu} role="menu" data-testid={testId}
      className="fixed z-[95] overflow-y-auto overscroll-contain rounded-xl border border-[#2D3748] bg-[#1A1D24] p-2 shadow-2xl"
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}>
      {children}
    </div>,
    document.body,
  );
}
