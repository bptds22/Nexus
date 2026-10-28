// app/universite/[schoolId]/page.tsx
//
// Page PUBLIQUE d'une université (chantier cégep, lot D5b — décisions BP 2026-10-28 : Q1 /universite/[école],
// Q3 version réduite tant que l'université n'a pas rempli sa page). Même gabarit que /college :
// <ProgramPage>, lu par la clé service (SEO), avec ses programmes d'études (university_programs, lot D5a).
//
// FERMÉE tant que lancement_universitaire est OFF : loadSchoolPageForRender(…, { universite: true }) ne trouve
// alors aucune école → 404, exactement comme la base cache les universités hors admin (D1a).
// Pas de page d'équipe universitaire pour l'instant (Q5) : les chips de « L'affiche » n'ouvrent rien.
//
// MOBILE (bundle Capacitor) : pas de rendu natif dans la 1.4.5 — la base cache les universités au client anon
// et la RPC de lecture viendra avec la 1.4.6 (Q4). Le bundle reçoit un renvoi vers le web.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProgramPage from "@/components/program-page/ProgramPage";
import { loadSchoolPageForRender } from "@/lib/queries/schoolPage/loadForRender";

const IS_CAPACITOR = process.env.CAPACITOR_BUILD === "true";

// Mêmes polices que /college (le layout racine ne charge pas Permanent Marker ni Playfair Display).
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

// Sentinelle static-export (build mobile uniquement). En web → [] = SSR pur.
export function generateStaticParams() {
  return IS_CAPACITOR ? [{ schoolId: "placeholder" }] : [];
}

export async function generateMetadata(
  { params }: { params: Promise<{ schoolId: string }> },
): Promise<Metadata> {
  if (IS_CAPACITOR) return { title: "Université | Nexus" };
  const { schoolId } = await params;
  const res = await loadSchoolPageForRender(schoolId, { universite: true });
  return res.schoolName ? { title: `${res.schoolName} | Nexus` } : { title: "Université | Nexus" };
}

export default async function UniversitePage(
  { params }: { params: Promise<{ schoolId: string }> },
) {
  if (IS_CAPACITOR) {
    return (
      <main style={{ background: "#111317", minHeight: "100vh", color: "#9CA3AF", padding: 24, fontSize: 14 }}>
        La page de l&apos;université s&apos;ouvre sur le web, sur nexussports.ca.
      </main>
    );
  }

  const { schoolId } = await params;
  const res = await loadSchoolPageForRender(schoolId, { universite: true });
  // Interrupteur OFF ou aucune université derrière cet identifiant → 404.
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
