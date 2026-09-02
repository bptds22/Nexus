// app/college/[schoolId]/page.tsx
//
// Page école PUBLIQUE. C'est la destination du bouton « Accéder à la page »
// de la recherche cégep, et le parent des pages équipe.
//
// PUBLIQUE au sens strict : aucune garde de rôle, aucune redirection de login —
// un athlète non connecté, un parent, un recruteur ou un moteur d'indexation
// voient la même page.
//
// DEUX rendus, un seul composant <ProgramPage> :
//   • WEB  → SSR service-role (SEO public, indexation). Corps inchangé ci-dessous.
//   • MOBILE (bundle Capacitor, output:export) → rendu NATIF client
//     <ProgramPageMobile> : lecture Supabase clé anon + RLS, generateStaticParams
//     sentinelle « placeholder » remplie par useParams au runtime. Plus de
//     navigateur in-app : la page vit DANS l'app.
//
// Différence avec /page-test : cette route n'a AUCUN décor de démonstration —
// pas de hero de route, pas de doublon Grasset+Montmorency. Une école, une page.
//
// Trois cas de chargement (WEB) :
//   1. école configurée      → rendu depuis la DB
//   2. école existante, page jamais configurée → page DÉGRADÉE de CETTE école
//   3. école introuvable     → notFound()

import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProgramPage from "@/components/program-page/ProgramPage";
import ProgramPageMobile from "@/components/program-page/ProgramPageMobile";
import { loadSchoolPageForRender } from "@/lib/queries/schoolPage/loadForRender";

const IS_CAPACITOR = process.env.CAPACITOR_BUILD === "true";

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

// Sentinelle static-export (build mobile uniquement) : ProgramPageMobile lit le
// vrai schoolId via useParams au runtime. En web (non-export) → [] = SSR pur.
export function generateStaticParams() {
  return IS_CAPACITOR ? [{ schoolId: "placeholder" }] : [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ schoolId: string }> },
): Promise<Metadata> {
  // Mobile : pas d'appel service-role au build (le titre natif est générique).
  if (IS_CAPACITOR) return { title: "Collège | Nexus" };
  const { schoolId } = await params;
  const res = await loadSchoolPageForRender(schoolId);
  const nom = res.schoolName;
  return nom ? { title: `${nom} | Nexus` } : { title: "Collège | Nexus" };
}

export default async function CollegePage(
  { params }: { params: Promise<{ schoolId: string }> },
) {
  // MOBILE (bundle Capacitor) : rendu natif, lecture anon + RLS côté client.
  if (IS_CAPACITOR) {
    return (
      <Suspense fallback={null}>
        <ProgramPageMobile />
      </Suspense>
    );
  }

  // WEB : SSR service-role (inchangé — SEO public).
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
        <ProgramPage school={props.school} content={props.content} saison={res.saison} />
      </main>
    </>
  );
}
