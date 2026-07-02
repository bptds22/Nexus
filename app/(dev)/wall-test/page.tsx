// app/(dev)/wall-test/page.tsx
//
// Throwaway dev route to eyeball <ProgramWall>. Loads the four collage fonts via
// a <link> here (NOT in the global layout), so the rest of the app stays on
// Outfit. Renders two contrasting schools to sanity-check theming + ink flip.

import ProgramWall from "@/components/program-wall/ProgramWall";

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
        <section style={{ padding: "24px 0" }}>
          <h1
            style={{
              color: "#9aa4b2",
              font: "600 13px/1.4 system-ui, sans-serif",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "0 24px 12px",
            }}
          >
            1 — RSEQ · navy / gold
          </h1>
          {/* full-bleed */}
          <div style={{ padding: "0 16px" }}>
            <ProgramWall
              schoolName="Cégep de la Rive-Nord"
              mascot="LYNX"
              city="REPENTIGNY"
              initial="R"
              slogan="Ici, tu fais partie de quelque chose"
              established="2004"
              league="RSEQ"
              colorPrimary="#12233F"
              colorSecondary="#E3B341"
            />
          </div>
        </section>

        <section style={{ padding: "24px 0 48px" }}>
          <h1
            style={{
              color: "#9aa4b2",
              font: "600 13px/1.4 system-ui, sans-serif",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "0 24px 12px",
            }}
          >
            2 — U SPORTS · maroon / cream (ink flip)
          </h1>
          <div style={{ padding: "0 16px" }}>
            <ProgramWall
              schoolName="Condors College"
              mascot="CONDORS"
              city="MONTRÉAL"
              initial="C"
              slogan="Rise above the rest"
              established="1969"
              league="USPORTS"
              colorPrimary="#7A1420"
              colorSecondary="#E9E4D4"
            />
          </div>
        </section>
      </main>
    </>
  );
}
