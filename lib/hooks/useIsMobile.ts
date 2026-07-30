"use client";

import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   useIsMobile — largeur de viewport « mobile », SSR-safe.

   Défaut DESKTOP (false) au premier rendu : le serveur ne connaît pas la
   largeur, et rendre mobile puis corriger produirait un flash d'hydratation.
   La vraie valeur est posée après montage, puis suivie via matchMedia.

   Seuil 768px = le point de bascule déjà utilisé ailleurs dans l'app
   (components/onboarding/TeamSearchOrCreate.tsx L163). Un seul seuil dans
   le repo — ne pas en introduire un second sans raison.

   ⚠ Ne PAS confondre avec Capacitor : `isMobile` = viewport étroit (web
   mobile inclus), `NEXT_PUBLIC_CAPACITOR_BUILD` = build natif. La MobileTabBar
   ne se rend QUE en Capacitor, donc toute réservation d'espace pour elle se
   conditionne au flag Capacitor, jamais à ce hook.
═══════════════════════════════════════════════════════════════ */
export function useIsMobile(maxWidth = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);

  return isMobile;
}

export default useIsMobile;
