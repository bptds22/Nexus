"use client";

import type { CSSProperties } from "react";
import { useKeyboardHeight } from "./useKeyboardHeight";

/* ═══════════════════════════════════════════════════════════════
   useSheetKeyboardGeometry — géométrie clavier d'une bottom-sheet.

   POURQUOI CE HOOK EXISTE
   `capacitor.config.ts` est en `KeyboardResize.None` : la WebView ne se
   redimensionne JAMAIS à l'ouverture du clavier, et `100vh` / `100dvh`
   gardent la hauteur plein écran. Aucune unité viewport ne protège d'un
   masquage — toute compensation est manuelle.

   IL FAUT DEUX GESTES, PAS UN. Remonter (`bottom`) SANS plafonner
   (`maxHeight`) est un bug, pas un demi-fix : sur un sheet en 85vh,
   remonter de 340 px sur un écran de 852 pt place son haut à
   852 − 340 − 724 = −212 px, donc titre, bouton Fermer et souvent le
   champ de saisie sortent PAR LE HAUT. C'est ce qui a fait passer six
   surfaces pour saines alors qu'elles étaient cassées : la règle globale
   `html.is-capacitor .fixed.bottom-0` de globals.css n'écrit que `bottom`.

   Géométrie extraite VERBATIM de SearchSheet, seul composant qui faisait
   les deux — donc un patron déjà validé sur device, pas une invention.

   USAGE
     const kbdStyle = useSheetKeyboardGeometry();
     <div className="fixed left-0 right-0 …" style={{ ...kbdStyle, transform: … }}>

   ⚠ Ne JAMAIS poser `bottom: 0` en inline sur un sheet : un style inline
   bat la feuille de style, donc il annule et la règle globale et ce hook.
═══════════════════════════════════════════════════════════════ */
export function useSheetKeyboardGeometry(hauteurFermee = "85vh"): CSSProperties {
  const kbdH = useKeyboardHeight();
  return {
    // Clavier OUVERT : le sheet se pose pile au-dessus du clavier…
    bottom: kbdH,
    // …et sa hauteur est plafonnée à l'espace restant, pour que l'input et
    // la liste tiennent à l'écran au lieu de déborder par le haut.
    maxHeight: kbdH > 0 ? `calc(100vh - ${kbdH}px - 12px)` : hauteurFermee,
    // Clavier fermé : on rend la safe-area (home indicator). Ouvert, le
    // clavier la recouvre déjà — la garder creuserait un vide.
    paddingBottom: kbdH > 0 ? 8 : "env(safe-area-inset-bottom)",
    transition: "bottom 250ms ease-out, max-height 250ms ease-out",
  };
}
