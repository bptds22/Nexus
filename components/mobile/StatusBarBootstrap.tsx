"use client";

import { useEffect } from "react";

/**
 * StatusBarBootstrap — s'exécute UNE FOIS au lancement, côté natif
 * uniquement. Met iOS ET Android en EDGE-TO-EDGE. No-op web.
 *
 * La WebView passe sous les barres système transparentes (overlay:true) ;
 * elles laissent voir le fond app #111317 (body) — barre sombre — ou le
 * dégradé rouge du dashboard qui remonte jusqu'en haut. Glyphes clairs via
 * Style.Dark.
 *
 * Pourquoi PAS « colorer les barres » : sur targetSdk 36 (Android 15+),
 * statusBarColor / navigationBarColor / setBackgroundColor sont DÉPRÉCIÉS
 * (no-op) et l'edge-to-edge est forcé → le seul moyen de contrôler
 * l'apparence des barres est ce qu'il y a DERRIÈRE (le body #111317). iOS
 * fonctionne pareil. Le contenu top réserve env(safe-area-inset-top)
 * (.nx-safe-top) pour ne pas passer sous la barre.
 *
 * Pourquoi en runtime : la config statique (overlaysWebView) est honorée de
 * façon inconstante selon la version — l'appel runtime fiabilise.
 *
 * Monté dans l'arbre de providers (app/layout.tsx), ne rend rien.
 */
export function StatusBarBootstrap() {
  useEffect(() => {
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        // iOS ET Android : edge-to-edge. La WebView passe SOUS les barres
        // système transparentes → elles montrent le fond app #111317 (body),
        // ou le dégradé rouge en haut du dashboard. Sur targetSdk 36 les
        // couleurs de barre sont dépréciées (no-op) → l'edge-to-edge est LE
        // seul moyen de contrôler leur apparence. Le contenu top réserve
        // env(safe-area-inset-top) (.nx-safe-top) pour ne pas passer dessous.
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Style.Dark = glyphes CLAIRS (heure/batterie) sur fond sombre.
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (err) {
        console.warn("[StatusBarBootstrap] setup failed:", err);
      }
    })();
  }, []);

  return null;
}
