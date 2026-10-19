"use client";

/* /partenaire/mes-athletes — « Mes athlètes » partenaire : UN onglet, deux pastilles
   (« En attente » / « Mes évaluations »), fusion du 2026-10-18 (6.1).
   Le contenu vit dans components/partenaire/MesAthletesPartenaire.tsx. */

import MesAthletesPartenaire from "@/components/partenaire/MesAthletesPartenaire";

// Appli (Capacitor) : écrans natifs ; bascule figée au build.
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function MesAthletesPartenairePage() {
  return <MesAthletesPartenaire mobile={IS_CAPACITOR} />;
}
