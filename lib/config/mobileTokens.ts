/* ═══════════════════════════════════════════════════════════════
   mobileTokens — Constantes design system mobile (Capacitor + web mobile).

   Source de vérité pour les valeurs partagées entre coach / recruteur /
   athlete / wizards en mode mobile. Évite la duplication Tailwind inline
   et le drift inévitable à l'échelle (3 portails × ~9 pages).

   Pendant CSS (classes utility) : voir `app/globals.css` section
   "Mobile design tokens" — mêmes valeurs sous forme `.nx-mobile-*`.

   À importer en JS quand on construit dynamiquement un `style={{ ... }}`
   ou un `calc(...)` (sinon préférer les classes CSS).
═══════════════════════════════════════════════════════════════ */

/** Hauteur de la MobileTabBar (zone tactile contenu, hors safe-area). */
export const TABBAR_HEIGHT = 64;

/** Taille tactile minimale iOS HIG / Material design. */
export const TOUCH_MIN = 44;

/** Padding horizontal canonique d'une page mobile (px-4 Tailwind). */
export const EDGE_X = 16;

/** Border-radius standard d'une card / input / CTA / sheet mobile. */
export const RADIUS_CARD = 16;

/** Padding-bottom à appliquer au conteneur top-level d'une page
    mobile recruteur/coach/athlete pour réserver la zone TabBar +
    safe-area-inset-bottom (notch iOS / gesture bar Android). */
export const TABBAR_PB = `calc(${TABBAR_HEIGHT}px + env(safe-area-inset-bottom))`;
