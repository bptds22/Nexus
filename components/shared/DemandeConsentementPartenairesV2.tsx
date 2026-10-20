"use client";

/* ═══════════════════════════════════════════════════════════════
   DemandeConsentementPartenairesV2 — monte la carte v2 « à la prochaine
   ouverture » (BP 2026-10-19). Monté une fois dans le layout athlète :
   web (connexion, rechargement) et appli (lancement + retour au premier plan).

   La base décide (`a_afficher`) : pas de v2, pas de « Non », pas de demande
   au parent en cours, « Plus tard » < 3 et ≥ 3 jours depuis le dernier.
   Jamais pendant l'inscription, jamais sur la page ouverte par le push
   (elle affiche déjà la carte). Fermée une fois dans la session, elle ne
   revient pas avant la prochaine ouverture.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lireEtatV2, ROUTE_CONSENTEMENT_V2, type EtatV2 } from "@/lib/partenaires/consentementV2";
import CarteConsentementPartenairesV2 from "@/components/shared/CarteConsentementPartenairesV2";

export default function DemandeConsentementPartenairesV2() {
  const pathname = usePathname();
  const [etat, setEtat] = useState<EtatV2 | null>(null);
  const fermeeCetteOuverture = useRef(false);
  const horsPortee = pathname.startsWith("/athlete/onboarding") || pathname === ROUTE_CONSENTEMENT_V2;
  const horsPorteeRef = useRef(horsPortee);
  horsPorteeRef.current = horsPortee;

  const verifier = useCallback(async () => {
    if (fermeeCetteOuverture.current || horsPorteeRef.current) return;
    const e = await lireEtatV2(createClient());
    setEtat(e?.aAfficher ? e : null);
  }, []);

  // Ouverture (web : connexion ou rechargement ; appli : lancement).
  useEffect(() => { void verifier(); }, [verifier]);

  // Appli : retour au premier plan = nouvelle ouverture. Web : retour sur l'onglet.
  useEffect(() => {
    let al: { remove: () => void } | null = null;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        al = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) { fermeeCetteOuverture.current = false; void verifier(); }
        });
      } catch { /* web */ }
    })();
    const surVisibilite = () => { if (document.visibilityState === "visible") void verifier(); };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => { al?.remove(); document.removeEventListener("visibilitychange", surVisibilite); };
  }, [verifier]);

  if (!etat || horsPortee) return null;

  return (
    <CarteConsentementPartenairesV2
      etat={etat}
      onFermer={() => { fermeeCetteOuverture.current = true; setEtat(null); }}
    />
  );
}
