"use client";

/* /recruteur/carte-matchs — la carte des matchs du recruteur : Pro, comme le
   Calendrier (FeatureGate : rien n'est demandé pour un gratuit). L'état est
   PARTAGÉ avec le portail partenaire (lib/carteMatchs/useCarteMatchsEtat, mode
   « recruteur »). Web : CarteMatchs. Appli : CarteMatchsMobile, la coquille de la
   carte cégep des joueurs — la même porte Pro ; sous Capacitor, UpgradePlaceholder
   n'affiche aucun lien de tarifs. */

import FeatureGate from "@/components/subscription/FeatureGate";
import CarteMatchs from "@/components/carte-matchs/CarteMatchs";
import CarteMatchsMobile from "@/components/carte-matchs/CarteMatchsMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function CarteMatchsPage() {
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      {IS_CAPACITOR ? <CarteMatchsMobile mode="recruteur" /> : <CarteMatchs mode="recruteur" />}
    </FeatureGate>
  );
}
