// app/(dev)/page-test/page.tsx
//
// Dev route to eyeball <ProgramPage> v7 against docs/reference/
// page-niveau1-web-v7.html. Renders the Grasset (red) and Momo (Montmorency,
// green) pages stacked. Collage fonts loaded here, scoped to this route.

import { notFound } from "next/navigation";
import ProgramPage from "@/components/program-page/ProgramPage";
import { schoolPrograms, programPageContent } from "@/lib/mock/schoolPrograms";

export const metadata = {
  title: "ProgramPage Niveau-1 — dev test",
  robots: { index: false, follow: false },
};

export default function PageTest() {
  // URL-only web (dev/test) — jamais dans le bundle mobile (cf.
  // lib/build/mobile-excluded-routes.ts).
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

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
