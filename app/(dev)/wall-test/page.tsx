// app/(dev)/wall-test/page.tsx
//
// Dev route to eyeball <ProgramWall> v7 against docs/reference/
// wall-compare-3schools.html. Loads the reference's collage fonts here (scoped
// to this route). Renders the 3 schools stacked, each = mosaic + menu, mirroring
// the compare page's layout + labels.

import { notFound } from "next/navigation";
import ProgramWall from "@/components/program-wall/ProgramWall";
import ProgramWallMenu from "@/components/program-wall/ProgramWallMenu";
import { schoolPrograms } from "@/lib/mock/schoolPrograms";

export const metadata = {
  title: "ProgramWall v7 — dev test",
  robots: { index: false, follow: false },
};

const LABELS = [
  "1 — COLLÈGE ANDRÉ-GRASSET · PHÉNIX (rouge/noir · vrai logo)",
  "2 — CÉGEP DE VICTORIAVILLE · VULKINS (orange/violet · monogramme)",
  "3 — COLLÈGE MONTMORENCY · NOMADES (vert néon/bleu · monogramme)",
];

export default function WallTestPage() {
  // URL-only web (dev/test) — jamais dans le bundle mobile (cf.
  // lib/build/mobile-excluded-routes.ts).
  // Décor de développement : jamais dans le bundle mobile, et jamais servi
  // par un déploiement de production. Sans la seconde garde, ces routes
  // étaient rendues sur le web public — fixtures comprises.
  if (
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true" ||
    process.env.NODE_ENV === "production"
  ) {
    notFound();
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700&family=Permanent+Marker&family=Playfair+Display:ital,wght@1,500;1,700&family=Outfit:wght@600;700;800&display=swap"
      />

      <main style={{ background: "#0B0C0E", minHeight: "100vh", padding: "26px 14px", fontFamily: "'Barlow Condensed', sans-serif" }}>
        <div style={{ maxWidth: 1500, margin: "0 auto 10px", font: "700 12px 'Outfit', sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#6a6f78" }}>
          TEST DE PALETTES — Grasset (rouge/noir) · Vulkins (orange/violet) · Nomades (vert néon/bleu)
        </div>
        {schoolPrograms.map((school, i) => (
          <section key={school.id}>
            <div style={{ maxWidth: 1500, margin: "34px auto 10px", font: "700 12px 'Outfit', sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#6a6f78" }}>
              {LABELS[i]}
            </div>
            <div style={{ maxWidth: 1500, margin: "0 auto" }}>
              <ProgramWall school={school} />
              <ProgramWallMenu school={school} />
            </div>
          </section>
        ))}
        <div style={{ height: 40 }} />
      </main>
    </>
  );
}
