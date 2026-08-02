// app/(dev)/editeur-test/page.tsx
//
// Route de test dev pour l'éditeur « Ma page » CÉGEP (Bloc 1, sur mock).
// Rend <PageEditor> (fixture Grasset) avec le VRAI ProgramWall en preview S1.
// Desktop only. Polices du collage chargées ici (Outfit/Anton/Bebas + les
// polices du mur : Permanent Marker / Playfair Display / Barlow Condensed).

import { notFound } from "next/navigation";
import PageEditor from "@/components/page-editor/PageEditor";

export const metadata = {
  title: "Éditeur « Ma page » CÉGEP — dev test",
  robots: { index: false, follow: false },
};

export default function EditeurTest() {
  // URL-only web (dev/test) — jamais dans le bundle mobile.
  // Décor de développement : jamais dans le bundle mobile, et jamais servi
  // par un déploiement de PRODUCTION. Les prévisualisations restent
  // utilisables — c'est précisément là que ces routes servent.
  //
  // La garde ne teste PAS `VERCEL_ENV === "production"` : la production du
  // projet est Coolify / OVHcloud (cf. CLAUDE.md), où VERCEL_ENV n'existe
  // pas — la garde s'y évaporerait en silence. On bloque donc toute
  // production, et on EXEMPTE explicitement l'aperçu Vercel, qui est le
  // seul environnement de production-au-sens-build à devoir rester ouvert.
  if (
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true" ||
    (process.env.VERCEL_ENV !== "preview" &&
      process.env.NODE_ENV === "production")
  ) {
    notFound();
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Anton&family=Bebas+Neue&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,500;1,700&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&display=swap"
      />
      <PageEditor />
    </>
  );
}
