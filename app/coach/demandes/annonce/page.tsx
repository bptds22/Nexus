"use client";

import { Suspense } from "react";
import AnnonceThread from "./[id]/PageClient";

// STRATÉGIE A — query-param routing. L'annonce est toujours spécifique
// (/coach/demandes/annonce?id=<broadcastId>) : cette route de base statique
// rend le lecteur d'Annonce, qui lit le broadcastId via useDynamicParam("id")
// (→ ?id). Aucun segment dynamique → le static export résout toujours le shell.
export default function AnnonceQueryRoute() {
  return (
    <Suspense fallback={null}>
      <AnnonceThread />
    </Suspense>
  );
}
