/* ═══════════════════════════════════════════════════════════════
   Images Open Graph — une seule source, trois lecteurs :
   app/layout.tsx (défaut du site), app/app/page.tsx (/app), et
   lib/config/__tests__/ogImages.test.ts (présence + dimensions RÉELLES).

   Pourquoi le test : jusqu'au 2026-09-18, l'image par défaut était
   /brand/logo-white-red.png — DÉCLARÉE 1200×630, MESURÉE 1579×552, et
   blanche sur transparent (invisible sur une carte d'aperçu à fond clair).
   Rien ne l'a signalé pendant des mois. Une dimension déclarée n'est
   vérifiée par personne ; celle du fichier, si.
   ═══════════════════════════════════════════════════════════════ */

export type ImageOg = {
  /** Chemin public, résolu contre metadataBase (https://nexussports.ca). */
  url: string;
  width: 1200;
  height: 630;
  alt: string;
};

/** Défaut du site : toutes les pages qui ne déclarent pas la leur. */
export const OG_DEFAUT: ImageOg = {
  url: "/og/nexus-1200x630.png",
  width: 1200,
  height: 630,
  alt: "Nexus — Recrutement sportif au Québec",
};

/** Page /app (lien de la bio Instagram). */
export const OG_APP: ImageOg = {
  url: "/og/app-1200x630.png",
  width: 1200,
  height: 630,
  alt: "Télécharge Nexus — App Store et Google Play",
};
