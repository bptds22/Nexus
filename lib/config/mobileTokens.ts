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
    safe-area-inset-bottom (notch iOS / gesture bar Android).
    WEB / mobile-web : miroir de `.nx-mobile-pb-tabbar` hors app. */
export const TABBAR_PB = `calc(${TABBAR_HEIGHT}px + env(safe-area-inset-bottom))`;

/** Zone réelle de la barre FLOTTANTE dans l'app : `bottom: safe + 10px`,
    68px bordure comprise, + marge — la constante déjà servie par le <main>
    de app/athlete/layout.tsx et par RechercheMobile. */
export const TABBAR_ZONE = 88;

/** Respiration au-dessus de la barre, pour que la dernière carte ne la
    frôle pas. */
export const TABBAR_RESPIRATION = 24;

/** DANS L'APP : miroir de `html.is-capacitor .nx-mobile-pb-tabbar`
    (2026-09-22). Le padding du <main> n'entre pas dans la zone de
    défilement (AnimatedRoute en position absolue) : c'est celui de la page
    qui doit dégager la barre. */
export const TABBAR_PB_APP = `calc(${TABBAR_ZONE}px + ${TABBAR_RESPIRATION}px + env(safe-area-inset-bottom))`;
