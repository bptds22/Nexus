"use client";

// app/recruteur/ma-page/page.tsx
//
// « Ma page » — route recruteur. Aiguillage web / mobile, rien d'autre.
//
// Le nom vient du produit, pas d'une invention : la topbar de l'éditeur affiche
// déjà « MA PAGE », et l'éditeur d'équipe y renvoie en toutes lettres
// (« Modifier l'identité dans « Ma page » → »). À ne pas confondre avec
// « Mon CÉGEP », qui est la GESTION (recruteurs, stats, recrues) et non la
// vitrine publique.

import MaPageClient from "./PageClient";
import MaPageMobile from "@/components/shared/MaPageMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function Page() {
  // Même aiguillage que les autres surfaces recruteur (cf. /recruteur/activites).
  // Les deux éditeurs sont desktop — ils ne sont pas dégradés sur mobile, ils y
  // sont absents, et on le dit.
  if (IS_CAPACITOR) return <MaPageMobile />;
  return <MaPageClient />;
}
