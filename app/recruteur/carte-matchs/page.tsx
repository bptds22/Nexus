"use client";

/* /recruteur/carte-matchs — la carte des matchs du recruteur : Pro, comme le
   Calendrier (FeatureGate : rien n'est demandé pour un gratuit). Le contenu est
   PARTAGÉ avec le portail partenaire (components/carte-matchs/CarteMatchs,
   mode « recruteur »). Web ET appli (lot carte des matchs mobile) : la même page,
   la même porte Pro — sous Capacitor, UpgradePlaceholder n'affiche aucun lien de
   tarifs. */

import FeatureGate from "@/components/subscription/FeatureGate";
import CarteMatchs from "@/components/carte-matchs/CarteMatchs";

export default function CarteMatchsPage() {
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <CarteMatchs mode="recruteur" />
    </FeatureGate>
  );
}
