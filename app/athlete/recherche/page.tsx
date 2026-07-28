// app/athlete/recherche/page.tsx
//
// « Trouve ton cégep » DANS l'espace athlète : la route hérite du layout
// (sidebar, garde de rôle, bannières) — l'athlète ne quitte jamais Nexus.
// La recherche mesure sa propre hauteur disponible, donc elle s'adapte à la
// coquille (barre mobile, bannière de maintenance) sans la contraindre.

import CegepSearch from "@/components/cegep-search/CegepSearch";

export const metadata = {
  title: "Trouve ton cégep | Nexus",
};

export default function RechercheCegepPage() {
  return <CegepSearch />;
}
