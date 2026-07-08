"use client";

import { useState, useEffect } from "react";

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
  useEffect(() => {
    let show: { remove: () => void } | null = null;
    let hide: { remove: () => void } | null = null;
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        show = await Keyboard.addListener("keyboardWillShow", (info) => setKbdH(info.keyboardHeight));
        hide = await Keyboard.addListener("keyboardWillHide", () => setKbdH(0));
      } catch { /* web — no-op */ }
    })();
    return () => { show?.remove(); hide?.remove(); };
  }, []);
  return kbdH;
}
