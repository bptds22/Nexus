"use client";

/* /partenaire/carte-matchs — la carte des matchs des PARTENAIRES (BP 2026-10-09).
   Le même composant que celui des recruteurs (mode « partenaire »), gratuit. Le
   layout du portail ne laisse passer que le rôle PARTNER ; la base, elle, n'admet
   que les partenaires APPROVED (partenaire_admis) — un SUSPENDED ou REVOKED voit
   le message de refus du composant, jamais de données. Web seulement. */

import CarteMatchs from "@/components/carte-matchs/CarteMatchs";

export default function CarteMatchsPartenairePage() {
  return <CarteMatchs mode="partenaire" />;
}
