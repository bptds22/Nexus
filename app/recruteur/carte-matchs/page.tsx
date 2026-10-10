"use client";

/* /recruteur/carte-matchs — la carte des matchs du recruteur : Pro, comme le
   Calendrier (FeatureGate : rien n'est demandé pour un gratuit). Le contenu est
   PARTAGÉ avec le portail partenaire (components/carte-matchs/CarteMatchs,
   mode « recruteur »). Web seulement : sous Capacitor, renvoi vers le Calendrier. */

import * as React from "react";
import { useRouter } from "next/navigation";
import FeatureGate from "@/components/subscription/FeatureGate";
import CarteMatchs from "@/components/carte-matchs/CarteMatchs";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function CarteMatchsPage() {
  const router = useRouter();
  React.useEffect(() => { if (IS_CAPACITOR) router.replace("/recruteur/calendrier"); }, [router]);
  if (IS_CAPACITOR) return null;
  return (
    <FeatureGate feature="recruiting_calendar" requiredTier="pro">
      <CarteMatchs mode="recruteur" />
    </FeatureGate>
  );
}
