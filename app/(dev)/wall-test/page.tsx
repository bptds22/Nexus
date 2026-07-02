// app/(dev)/wall-test/page.tsx
//
// Throwaway dev route to eyeball <ProgramWall>. Loads the four collage fonts via
// a <link> here (NOT in the global layout), so the rest of the app stays on
// Outfit. Renders all 6 seed schools (real palettes, stress-tested) stacked,
// each labeled with its school name.

import ProgramWall from "@/components/program-wall/ProgramWall";
import { schoolPrograms } from "@/lib/mock/schoolPrograms";

export const metadata = {
  title: "ProgramWall — dev test",
  robots: { index: false, follow: false },
};

export default function WallTestPage() {
  return (
    <>
      {/* Collage fonts, scoped to this route. Application happens only via the
          `.pw-*` classes inside ProgramWall, so nothing here restyles the app. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,600;1,600&family=Permanent+Marker&display=swap"
      />

      <main style={{ background: "#0b0d12", minHeight: "100vh" }}>
        {schoolPrograms.map((school, i) => (
          <section key={school.id} style={{ padding: "24px 0" }}>
            <h1
              style={{
                color: "#9aa4b2",
                font: "600 13px/1.4 system-ui, sans-serif",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "0 24px 12px",
              }}
            >
              {i + 1} — {school.schoolName} · {school.mascot}
            </h1>
            <div style={{ padding: "0 16px" }}>
              <ProgramWall school={school} />
            </div>
          </section>
        ))}
        <div style={{ height: 32 }} />
      </main>
    </>
  );
}
