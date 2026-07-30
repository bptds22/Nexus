// app/college/[schoolId]/page.tsx
//
// Page école PUBLIQUE. C'est la destination du bouton « Accéder à la page »
// de la recherche cégep, et le parent des pages équipe.
//
// PUBLIQUE au sens strict : aucune garde de rôle, aucune redirection de login,
// aucun guard Capacitor — un athlète non connecté, un parent, un recruteur ou
// un moteur d'indexation voient la même page. Elle n'est donc PAS dans
// MOBILE_EXCLUDED_PAGES.
//
// Différence avec /page-test : cette route n'a AUCUN décor de démonstration —
// pas de hero de route, pas de doublon Grasset+Montmorency. Une école, une page.
//
// Trois cas de chargement :
//   1. école configurée      → rendu depuis la DB
//   2. école existante, page jamais configurée → page DÉGRADÉE de CETTE école
//      (nom, ville, région, équipes, compte d'équipes ; tout le reste absent)
//   3. école introuvable     → notFound()
//
// AUCUN fixture ici. 68 collèges sur 69 sont dans le cas 2 : leur servir le
// contenu de Grasset était un mensonge sur une route publique. Le fixture reste
// le repli de /page-test, qui est un banc d'essai, pas une page publiée.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramPage from "@/components/program-page/ProgramPage";
import { loadSchoolPageForRender } from "@/lib/queries/schoolPage/loadForRender";

// Le mur utilise Permanent Marker et Playfair Display, que le layout racine ne
// charge pas (il ne porte qu'Outfit / Anton / Bebas / Barlow Condensed).
const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@600;700;800&display=swap"
    />
  </>
);

export async function generateMetadata(
  { params }: { params: Promise<{ schoolId: string }> },
): Promise<Metadata> {
  const { schoolId } = await params;
  const res = await loadSchoolPageForRender(schoolId);
  const nom = res.schoolName;
  return nom ? { title: `${nom} | Nexus` } : { title: "Collège | Nexus" };
}

export default async function CollegePage(
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const { schoolId } = await params;
  const res = await loadSchoolPageForRender(schoolId);

  // schoolName null = aucune école derrière cet identifiant. C'est le SEUL cas
  // de 404 : une école réelle mais non configurée rend sa page dégradée.
  if (!res.configured && !res.degraded) notFound();

  const props = res.configured
    ? { school: res.school, content: res.content }
    : res.degraded!;

  return (
    <>
      {FONTS}
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <ProgramPage school={props.school} content={props.content} />
      </main>
    </>
  );
}
