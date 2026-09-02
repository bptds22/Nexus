// app/(dev)/page-test/page.tsx
//
// Dev route to eyeball <ProgramPage>. Sans paramètre : rend les fixtures
// (Grasset + Momo) — INCHANGÉ (non-régression). Avec ?school=<id|slug> : rend
// depuis la DB (Bloc 2) ; école non configurée → FALLBACK fixture Grasset (la
// page ne casse JAMAIS).

import { notFound } from "next/navigation";
import ProgramPage from "@/components/program-page/ProgramPage";
import { schoolPrograms, programPageContent } from "@/lib/mock/schoolPrograms";
import { loadSchoolPageForRender } from "@/lib/queries/schoolPage/loadForRender";

export const metadata = {
  title: "ProgramPage Niveau-1 — dev test",
  robots: { index: false, follow: false },
};

const FONTS = (
  <>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Caveat:wght@700&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@600;700;800&display=swap"
    />
  </>
);

export default async function PageTest({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
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

  // ── mode DB paramétrable : /page-test?school=<id|slug> ──
  // Next 16 : searchParams est asynchrone (Promise) — doit être await.
  const schoolParam = (await searchParams)?.school;
  if (schoolParam) {
    const res = await loadSchoolPageForRender(schoolParam);
    const grassetFix = schoolPrograms.find((s) => s.id === "andre-grasset")!;
    return (
      <>
        {FONTS}
        <main style={{ background: "#111317", minHeight: "100vh" }}>
          {res.configured ? (
            <ProgramPage school={res.school} content={res.content} />
          ) : (
            <ProgramPage school={grassetFix} content={programPageContent["andre-grasset"]} />
          )}
        </main>
      </>
    );
  }

  // ── mode fixture (sans paramètre) — INCHANGÉ ──
  const grasset = schoolPrograms.find((s) => s.id === "andre-grasset")!;
  const momo = schoolPrograms.find((s) => s.id === "montmorency")!;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Caveat:wght@700&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@600;700;800&display=swap"
      />
      <main style={{ background: "#111317", minHeight: "100vh" }}>
        <ProgramPage school={grasset} content={programPageContent["andre-grasset"]} />
        <div style={{ height: 60, background: "#0B0C0E" }} />
        <ProgramPage school={momo} content={programPageContent["montmorency"]} />
      </main>
    </>
  );
}
