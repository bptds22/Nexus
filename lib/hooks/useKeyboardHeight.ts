"use client";

import { useState, useEffect } from "react";
import { ecouterRecouvrementClavier } from "@/lib/mobile/recouvrementClavier";

/* ═══════════════════════════════════════════════════════════════
   useKeyboardHeight — hauteur (px) du clavier natif iOS/Android.

   Source de vérité UNIQUE pour remonter un composer / une bottom-sheet
   au-dessus du clavier sous KeyboardResize.None (le resize natif iOS est
   cassé sur iOS 26 : innerHeight / visualViewport ne bougent pas). On lit
   `keyboardHeight` via les events Capacitor keyboardWillShow/Hide.

   Web ou plugin absent → reste 0 (no-op), donc safe à appeler partout.

   Extrait de MessageThreadShell (composer messages) pour éviter de
   dupliquer la logique clavier ; utilisé aussi par DistinctionDetailSheet.
═══════════════════════════════════════════════════════════════ */
export function useKeyboardHeight(): number {
  const [kbdH, setKbdH] = useState(0);
  // Le RECOUVREMENT, pas la hauteur brute : Android 15+ rétrécit déjà la
  // WebView (voir lib/mobile/recouvrementClavier).
  useEffect(() => ecouterRecouvrementClavier(setKbdH), []);
  return kbdH;
}
