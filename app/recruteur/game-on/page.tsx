"use client";

/* /recruteur/game-on — Game On, le mode match (BP 2026-10-18) : Pro, comme le
   processus et la carte des matchs (FeatureGate). Entrée : menu « Plus » de
   l'appli et barre latérale web — PAS d'onglet dans la barre du bas (décision BP).
   Web et appli rendent le même composant ; l'appli en rendu natif. */

import FeatureGate from "@/components/subscription/FeatureGate";
import GameOn from "@/components/game-on/GameOn";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function GameOnPage() {
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <GameOn mobile={IS_CAPACITOR} />
    </FeatureGate>
  );
}
