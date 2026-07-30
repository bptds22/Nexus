// app/(dev)/recherche-mobile-test/page.tsx
//
// Harnais dev du jumeau MOBILE de la recherche cégep. Rend RechercheMobile
// directement, sans passer par la détection de largeur — on veut pouvoir
// l'inspecter au device toolbar de Chrome à n'importe quelle taille.
//
// Même dégradation que /recherche-test : en visiteur non connecté, la couche
// data renvoie `viewer: null` → pas de pille « Pour moi », pas de badge FIT,
// pas de ♥ (A7). La page ne casse pas, elle montre juste l'état générique.
//
// NOTE — hors Capacitor la MobileTabBar ne rend PAS (elle fait
// `if (!IS_CAPACITOR) return null`). Ici, --tabzone vaut donc la seule
// safe-area basse : c'est le comportement attendu, pas un oubli. Pour voir la
// réservation de 88px il faut un build Capacitor.

import { notFound } from "next/navigation";
import RechercheMobile from "@/components/cegep-search/RechercheMobile";

export const metadata = {
  title: "Recherche cégep mobile — dev test",
  robots: { index: false, follow: false },
};

export default function RechercheMobileTest() {
  // URL-only web (dev/test) — jamais dans le bundle mobile.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  return <RechercheMobile />;
}
