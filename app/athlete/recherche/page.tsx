// app/athlete/recherche/page.tsx
//
// « Trouve ton cégep » DANS l'espace athlète : la route hérite du layout
// (sidebar, garde de rôle, bannières) — l'athlète ne quitte jamais Nexus.
// La recherche mesure sa propre hauteur disponible, donc elle s'adapte à la
// coquille (barre mobile, bannière de maintenance) sans la contraindre.

import RechercheDispatch from "./RechercheDispatch";

export const metadata = {
  title: "Trouve ton cégep | Nexus",
};

export default function RechercheCegepPage() {
  // Mobile (viewport étroit ou build Capacitor) → RechercheMobile ; desktop →
  // CegepSearch, strictement inchangé. L'aiguillage vit dans RechercheDispatch
  // pour que cette page reste un composant serveur et garde sa `metadata`.
  return <RechercheDispatch />;
}
