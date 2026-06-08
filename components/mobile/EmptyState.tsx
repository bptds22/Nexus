"use client";

/* ═══════════════════════════════════════════════════════════════
   EmptyState — composant générique mobile (iter 7.62)

   Remplace les 7 empty states bespoke (DIAG 7.56 axe 2) : image PNG
   propulsée par props + titre + description + CTA optionnel.
   Réutilisable coach / athlète / wizards à mesure que ces portails
   passent en mobile.

   Images servies depuis `public/empty/nexus-empty-*.png` (chemins
   `/empty/...`). Les hauteurs de carte/écran vary, on laisse au parent
   le soin de centrer verticalement (le composant n'impose pas de
   `flex-1` / `h-screen` — il s'insère où qu'on le mette).

   Pas d'imports lourds : pas de framer-motion, pas d'icônes externes.
   Le composant rend un <Image> Next.js (priority OFF par défaut, ces
   images n'apparaissent qu'en cas d'absence de contenu).
═══════════════════════════════════════════════════════════════ */

import Image from "next/image";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Chemin de l'image, ex. "/empty/nexus-empty-messagerie.png". */
  image: string;
  /** Texte alt pour l'image (a11y). Sera dérivé du title si absent. */
  imageAlt?: string;
  /** Headline courte (style canon : ~18px font-bold, blanc). */
  title: string;
  /** Sous-texte (style : ~15px, gris #9CA3AF, max-w pour pas s'étaler). */
  description?: string;
  /** CTA optionnel (bouton rouge plein, nx-mobile-radius-card). */
  action?: EmptyStateAction;
  /** Override taille image (défaut 132px). */
  imageSize?: number;
}

export function EmptyState({
  image,
  imageAlt,
  title,
  description,
  action,
  imageSize = 132,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-12 max-w-md mx-auto">
      <div
        className="relative flex-shrink-0"
        style={{ width: imageSize, height: imageSize }}
      >
        <Image
          src={image}
          alt={imageAlt ?? title}
          fill
          sizes={`${imageSize}px`}
          className="object-contain"
          priority={false}
        />
      </div>

      <h2 className="font-head text-[18px] font-black uppercase tracking-tight text-white mt-5">
        {title}
      </h2>

      {description && (
        <p className="text-[15px] text-[#9CA3AF] mt-2 leading-relaxed max-w-xs">
          {description}
        </p>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 h-12 px-6 rounded-2xl bg-[#E63946] active:bg-[#D42B22] text-white font-head font-bold text-[14px] uppercase tracking-widest active:scale-[0.97] transition-all shadow-[0_4px_16px_rgba(230,57,70,0.30)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
