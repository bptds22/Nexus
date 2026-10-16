"use client";

import { useEffect } from "react";
import { ecouterRecouvrementClavier } from "@/lib/mobile/recouvrementClavier";

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
    // Le RECOUVREMENT du clavier, pas sa hauteur brute : sur Android 15+, la
    // WebView a déjà rétréci (voir lib/mobile/recouvrementClavier).
    const arreter = ecouterRecouvrementClavier((px) => {
      racine.style.setProperty("--kbd-h", `${px}px`);
    });
    return () => {
      arreter();
      racine.style.removeProperty("--kbd-h");
    };
  }, []);

  return null;
}
