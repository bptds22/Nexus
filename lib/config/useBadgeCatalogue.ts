"use client";

/* ═══════════════════════════════════════════════════════════════
   useBadgeCatalogue — accès React au catalogue des 22 badges.

   Vit à part pour que lib/config/badgeCatalogue.ts reste sans dépendance
   framework : la résolution y est pure, donc testable en Node sans React
   ni base. Même découpage que grilles.ts / useGrilles.ts.

   Le chargement est mémorisé AU NIVEAU MODULE dans badgeCatalogue.ts : N
   composants montés en même temps ne déclenchent qu'un aller-retour.

   Avant résolution, rend un catalogue vide (`ok: false`) plutôt que null,
   pour qu'aucun appelant n'ait à écrire une garde de chargement.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { loadBadgeCatalogue, EMPTY_BADGE_CATALOGUE, type BadgeCatalogue } from "./badgeCatalogue";

export function useBadgeCatalogue(): BadgeCatalogue {
  const [cat, setCat] = useState<BadgeCatalogue>(EMPTY_BADGE_CATALOGUE);

  useEffect(() => {
    let vivant = true;
    loadBadgeCatalogue().then((c) => { if (vivant) setCat(c); });
    return () => { vivant = false; };
  }, []);

  return cat;
}
