"use client";

/* /recruteur/game-on — Dépistage (ex-« Game On »), le mode match (BP 2026-10-18) : Pro, comme le
   processus et la carte des matchs (FeatureGate). Entrées : l'onglet de la barre du bas de l'appli,
   la barre latérale web, et « Dépister ce match » (carte des matchs, calendrier), qui passe le
   match dans l'URL (?match=…&a=…&b=…). La route ne change pas (libellés : lib/gameOn/libelles).
   Web et appli rendent le même composant ; l'appli en rendu natif. Suspense : useSearchParams
   l'exige pour l'export statique de l'appli. */

import { Suspense } from "react";
import FeatureGate from "@/components/subscription/FeatureGate";
import GameOn from "@/components/game-on/GameOn";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function GameOnPage() {
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <Suspense fallback={<div className="min-h-[40vh]" />}>
        <GameOn mobile={IS_CAPACITOR} />
      </Suspense>
    </FeatureGate>
  );
}
