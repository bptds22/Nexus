"use client";

import { useEffect } from "react";

/**
 * StatusBarBootstrap — s'exécute UNE FOIS au lancement, côté natif
 * uniquement. Rend la WebView débordante sous la status bar / Dynamic
 * Island (overlay) pour que le dégradé rouge du dashboard bleed jusqu'en
 * haut de l'écran (look premium natif).
 *
 * Pourquoi en runtime alors que capacitor.config.ts pose déjà
 * overlaysWebView:true : la config statique est honorée de façon
 * inconstante selon la version de Capacitor / l'OS — l'appel runtime
 * fiabilise. No-op sur web.
 *
 * Android : avec overlay actif, le backgroundColor natif de la status bar
 * peindrait quand même une barre opaque par-dessus le dégradé. On force le
 * fond transparent (#00000000) pour que le rouge transparaisse aussi sur
 * Android. setBackgroundColor est une API Android-only ; sur iOS le call
 * est simplement sauté (guard plateforme) — iOS est déjà transparent en
 * mode overlay.
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
        // WebView passe SOUS la barre — le contenu top doit prévoir
        // env(safe-area-inset-top) (cf. DashboardGreeting).
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Glyphes clairs (heure/batterie) sur fond rouge/sombre.
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === "android") {
          // Transparent → le dégradé de la WebView transparaît au lieu
          // d'une barre #111317 peinte par le natif.
          await StatusBar.setBackgroundColor({ color: "#00000000" });
        }
      } catch (err) {
        console.warn("[StatusBarBootstrap] setup failed:", err);
      }
    })();
  }, []);

  return null;
}
