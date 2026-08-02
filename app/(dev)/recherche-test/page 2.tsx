// app/(dev)/recherche-test/page.tsx
//
// Route de test dev pour la recherche cégep athlète (web, desktop).
// Le composant est entièrement client : il charge les 69 cégeps + équipes +
// programmes en 5 requêtes plates, puis filtre en mémoire. Visiteur non
// connecté : filtres génériques, pas de « Pour moi », pas de fits — la page
// ne casse pas.

import { notFound } from "next/navigation";
import CegepSearch from "@/components/cegep-search/CegepSearch";

export const metadata = {
  title: "Trouve ton cégep — dev test",
  robots: { index: false, follow: false },
};

export default function RechercheTest() {
  // URL-only web (dev/test) — jamais dans le bundle mobile.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Anton&family=Bebas+Neue&display=swap"
      />
      <CegepSearch />
    </>
  );
}
