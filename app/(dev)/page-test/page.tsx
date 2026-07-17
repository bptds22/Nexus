// app/(dev)/page-test/page.tsx
//
// Dev route to eyeball <ProgramPage> v7 against docs/reference/
// page-niveau1-web-v7.html. Renders the Grasset (red) and Momo (Montmorency,
// green) pages stacked. Collage fonts loaded here, scoped to this route.

import { notFound } from "next/navigation";
import Image from "next/image";
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
        {/* Hero — flatlay servi en responsive par next/image (source 2560px,
            srcset auto). fill + object-cover ; scrim qui fond vers #111317. */}
        <section style={{ position: "relative", width: "100%", height: "62vh", minHeight: 420, overflow: "hidden" }}>
          <Image
            src="/images/sports-flatlay.jpg"
            alt="Équipement sportif — mise à plat"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(17,19,23,0.30) 0%, rgba(17,19,23,0.55) 55%, #111317 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 24px",
            }}
          >
            <p
              style={{
                fontFamily: "Outfit, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontSize: 12,
                color: "#E63946",
                margin: 0,
              }}
            >
              Nexus — aperçu
            </p>
            <h1
              style={{
                fontFamily: "Anton, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                fontSize: "clamp(40px, 7vw, 84px)",
                lineHeight: 0.95,
                color: "#EDEFF3",
                margin: "10px 0 0",
              }}
            >
              Programmes sportifs
            </h1>
          </div>
        </section>

        <ProgramPage school={grasset} content={programPageContent["andre-grasset"]} />
        <div style={{ height: 60, background: "#0B0C0E" }} />
        <ProgramPage school={momo} content={programPageContent["montmorency"]} />
      </main>
    </>
  );
}
