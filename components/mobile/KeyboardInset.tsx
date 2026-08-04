"use client";

import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   KeyboardInset — publie la hauteur du clavier natif dans --kbd-h, une fois
   pour TOUTE l'application.

   ── POURQUOI C'EST NÉCESSAIRE ───────────────────────────────────────────────
   capacitor.config.ts fixe `Keyboard.resize: KeyboardResize.None`, et ce choix
   est documenté : le resize natif de la WKWebView est cassé sur iOS 26 et
   l'était d'autant plus avec `scrollEnabled:false`. Conséquence directe : quand
   le clavier monte, RIEN ne bouge — ni la hauteur de la WebView, ni
   `window.innerHeight`, ni `visualViewport`. Un panneau ancré en `bottom:0`
   reste donc au bas PHYSIQUE de l'écran, c'est-à-dire SOUS le clavier. On tape
   à l'aveugle. Ce n'est pas un bug d'un écran, c'est la conséquence d'un réglage
   global — le correctif doit donc l'être aussi.

   ── POURQUOI UN COMPOSANT ET PAS LE HOOK ────────────────────────────────────
   `lib/hooks/useKeyboardHeight` fait déjà ce travail, mais il rend une valeur
   REACT : il faut l'appeler dans chaque composant concerné et recâbler son
   style. Il y a 26 fichiers avec un conteneur ancré en bas contenant une
   saisie ; les recâbler un par un serait ingérable et se re-casserait au
   premier écran ajouté. Ici on écrit une variable CSS sur <html>, et une seule
   règle dans globals.css la fait consommer par tous les ancrages du bas,
   présents et futurs. Le hook reste utile là où la valeur doit passer par du
   JS (MessageThreadShell, AthleteWizardMobile) et n'est pas retiré.

   ── LE PATRON D'APPEL ───────────────────────────────────────────────────────
   Import dynamique de @capacitor/keyboard + try/catch, SANS garde
   `isNativePlatform` — le même patron que `tap()` dans les écrans mobiles qui
   fonctionnent. Hors device l'import échoue, le catch l'absorbe, --kbd-h reste
   absente et le repli `0px` de la règle CSS s'applique. Aucun effet sur le web.
   ═══════════════════════════════════════════════════════════════════════════ */
export function KeyboardInset() {
  useEffect(() => {
    const racine = document.documentElement;
    let show: { remove: () => void } | null = null;
    let hide: { remove: () => void } | null = null;
    let annule = false;

    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        if (annule) return;
        // `keyboardWillShow` et non `keyboardDidShow` : l'animation du panneau
        // part en même temps que celle du clavier au lieu de la suivre.
        show = await Keyboard.addListener("keyboardWillShow", (info) => {
          racine.style.setProperty("--kbd-h", `${info.keyboardHeight}px`);
        });
        hide = await Keyboard.addListener("keyboardWillHide", () => {
          racine.style.setProperty("--kbd-h", "0px");
        });
      } catch {
        /* web ou plugin absent — la règle CSS retombe sur 0px */
      }
    })();

    return () => {
      annule = true;
      show?.remove();
      hide?.remove();
      racine.style.removeProperty("--kbd-h");
    };
  }, []);

  return null;
}
