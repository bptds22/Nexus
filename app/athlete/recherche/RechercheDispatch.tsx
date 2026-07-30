"use client";

// app/athlete/recherche/RechercheDispatch.tsx
//
// Aiguillage web ↔ mobile pour « Trouve ton cégep ».
//
// Pourquoi un composant à part plutôt qu'un `if` en tête de page.tsx (le
// pattern de app/recruteur/recherche/page.tsx L340) : cette page-là est un
// composant CLIENT, alors que app/athlete/recherche/page.tsx est un composant
// SERVEUR qui exporte `metadata`. Y mettre un hook la forcerait en client et
// ferait perdre le titre de page. L'aiguillage vit donc ici, et page.tsx reste
// serveur — le dispatch se fait toujours AVANT tout rendu web.

import * as React from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import CegepSearch from "@/components/cegep-search/CegepSearch";
import RechercheMobile from "@/components/cegep-search/RechercheMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function RechercheDispatch() {
  const isMobile = useIsMobile();
  // Capacitor est une constante de BUILD : on tranche sans attendre le montage,
  // donc zéro scintillement dans l'app native.
  const [pret, setPret] = React.useState(IS_CAPACITOR);
  React.useEffect(() => { setPret(true); }, []);

  if (IS_CAPACITOR || (pret && isMobile)) return <RechercheMobile />;
  // Une frame d'attente sur le web AVANT de savoir la largeur : sans elle,
  // CegepSearch se monterait puis serait remplacé sur mobile-web — 5 requêtes
  // tirées pour rien. Le fond est celui de la coquille, donc rien ne saute.
  if (!pret) return <div style={{ background: "#111317", minHeight: "60vh" }} />;
  return <CegepSearch />;
}
