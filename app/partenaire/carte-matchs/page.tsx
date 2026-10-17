"use client";

/* /partenaire/carte-matchs — la carte des matchs des PARTENAIRES (BP 2026-10-09).
   Le même état que celui des recruteurs (mode « partenaire »), gratuit. Le
   layout du portail ne laisse passer que le rôle PARTNER ; la base, elle, n'admet
   que les partenaires APPROVED (partenaire_admis) — un SUSPENDED ou REVOKED voit
   le message de refus, jamais de données. Web : CarteMatchs. Appli : CarteMatchsMobile,
   la coquille de la carte cégep des joueurs (lot carte des matchs mobile). */

import CarteMatchs from "@/components/carte-matchs/CarteMatchs";
import CarteMatchsMobile from "@/components/carte-matchs/CarteMatchsMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function CarteMatchsPartenairePage() {
  return IS_CAPACITOR ? <CarteMatchsMobile mode="partenaire" /> : <CarteMatchs mode="partenaire" />;
}
