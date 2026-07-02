"use client";

// components/program-wall/ProgramWall.tsx
//
// v2 — crest-led hero. The logo/crest lockup is the dominant element, anchored
// center-left with a soft JS-derived spotlight behind it; every other tile
// re-flows around it as supporting texture. Presentational only: no data
// fetching, no state, no controls. Themed off two color props via deriveTheme()
// + inline CSS vars. All styling is scoped `.pw-*`, so the four collage fonts +
// patterns never leak into the rest of the app.

import * as React from "react";
import type { SchoolProgramIdentity } from "@/lib/types/models";
import { deriveTheme } from "./theme";

export interface ProgramWallProps {
  school: SchoolProgramIdentity;
}

/* ------------------------------------------------------------------ icons -- */
/* stroke = --c2, no fills; only placed on dark / c1 tiles so they read. */

type IconProps = { className?: string };

function FleurDeLys({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="none" stroke="var(--c2)" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M12 2c-1.6 2.2-1.6 4.4 0 6.6 1.6-2.2 1.6-4.4 0-6.6z" />
        <path d="M12 8.6c-2.8.4-4.6 2.4-4.6 5 0 1.7.9 3 2.1 3.8-1.7.2-2.7 1.2-2.7 2.9h10.4c0-1.7-1-2.7-2.7-2.9 1.2-.8 2.1-2.1 2.1-3.8 0-2.6-1.8-4.6-4.6-5z" />
        <path d="M8.5 20.3h7" />
      </g>
    </svg>
  );
}

function MapleLeaf({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="none"
        stroke="var(--c2)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d="M12 2l1.5 3.6 3-1.3-.7 3.6 3.4-.4-2 2.7 3.3 1.4-3 1.8 1.4 2.3-3.9-.5.3 2.6L12 20l-2.6-1.9.3-2.6-3.9.5L7.2 13l-3-1.8 3.3-1.4-2-2.7 3.4.4-.7-3.6 3 1.3z"
      />
    </svg>
  );
}

function Basketball({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="none" stroke="var(--c2)" strokeWidth="1.4">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
      </g>
    </svg>
  );
}

function Football({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="none" stroke="var(--c2)" strokeWidth="1.4">
        <ellipse cx="12" cy="12" rx="9" ry="5.5" />
        <path d="M12 9v6M10.3 10.5h3.4M10.3 12h3.4M10.3 13.5h3.4" />
      </g>
    </svg>
  );
}

function Bolt({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="none"
        stroke="var(--c2)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d="M13 2 4 14h6l-1 8 9-12h-6z"
      />
    </svg>
  );
}

function Shield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="none"
        stroke="var(--c2)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        d="M12 3l7 3v5c0 5-3 8.2-7 10-4-1.8-7-5-7-10V6z"
      />
    </svg>
  );
}

function Star({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="var(--c2)"
        d="M12 3l2.5 5.6 6.1.6-4.6 4 1.4 6-5.4-3.1L6.6 19.2l1.4-6-4.6-4 6.1-.6z"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------- tile -- */

function Tile({
  c = 1,
  r = 1,
  className = "",
  style,
  children,
}: {
  c?: number;
  r?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`pw-tile ${className}`}
      // `style` spreads last, so an explicit gridColumn/gridRow start (used for
      // the hero) overrides the default span-based placement.
      style={{ gridColumn: `span ${c}`, gridRow: `span ${r}`, ...style }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------- wall -- */

export default function ProgramWall({ school }: ProgramWallProps) {
  const {
    schoolName,
    mascot,
    city,
    initial,
    slogan,
    established,
    league,
    colorPrimary,
    colorSecondary,
    logoUrl,
  } = school;

  const theme = deriveTheme(colorPrimary, colorSecondary);
  const isU = league === "USPORTS";

  const nation = isU ? "CANADA" : "QUÉBEC";
  const trophy = isU ? "CHAMPION" : "BOL D'OR";
  const leagueLabel = isU ? "U SPORTS" : "RSEQ";
  const NationIcon = isU ? MapleLeaf : FleurDeLys;

  // CSS custom properties consumed by every rule in the scoped stylesheet.
  const rootStyle = {
    "--c1": theme.c1,
    "--c2": theme.c2,
    "--c1-deep": theme.c1Deep,
    "--c1-mid": theme.c1Mid,
    "--c1-glow": theme.c1Glow,
    "--cream": theme.cream,
    "--ink": theme.ink,
  } as React.CSSProperties;

  return (
    <header
      className="pw-root"
      style={rootStyle}
      aria-label={`${schoolName} — ${mascot}`}
    >
      <style dangerouslySetInnerHTML={{ __html: PW_CSS }} />

      <div className="pw-grid">
        {/* ================= HERO CREST — explicit center-left anchor ======= */}
        <Tile
          className="pw-hero"
          style={{ gridColumn: "4 / span 4", gridRow: "2 / span 4" }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="pw-hero-img" />
          ) : (
            <div className="pw-badge">
              <span className="pw-anton pw-badge-initial">{initial}</span>
              <span className="pw-bebas pw-badge-mascot">{mascot}</span>
            </div>
          )}
        </Tile>

        {/* ================= supporting tiles (auto-flow dense) ============= */}

        {/* demoted vertical mascot rail — now a thin left-edge texture */}
        <Tile c={1} r={4} className="pw-fill-deep">
          <span className="pw-anton pw-vertical pw-fs-rail">{mascot}</span>
        </Tile>

        {/* division */}
        <Tile c={2} r={2} className="pw-fill-c1">
          <span className="pw-anton pw-fs-lg" style={{ color: "var(--c2)" }}>
            D1
          </span>
        </Tile>

        {/* city wordmark */}
        <Tile c={3} r={1} className="pw-fill-c2">
          <span className="pw-bebas pw-fs-lg">{city}</span>
        </Tile>

        {/* outlined nation word, tilted */}
        <Tile c={3} r={2} className="pw-fill-deep pw-rot-a">
          <span className="pw-anton pw-outline pw-fs-lg">{nation}</span>
        </Tile>

        {/* league pill */}
        <Tile c={2} r={1} className="pw-fill-c2">
          <span className="pw-pill pw-bebas pw-fs-md">{leagueLabel}</span>
        </Tile>

        {/* checkerboard */}
        <Tile c={2} r={1} className="pw-checker" />

        {/* #1 */}
        <Tile c={1} r={1} className="pw-fill-c1">
          <span className="pw-anton pw-fs-md" style={{ color: "var(--c2)" }}>
            #1
          </span>
        </Tile>

        {/* halftone */}
        <Tile c={2} r={2} className="pw-halftone" />

        {/* slogan in marker script, tilted — collapses to a motif when null so
            the wall never shows an empty box */}
        {slogan ? (
          <Tile c={4} r={2} className="pw-fill-cream pw-rot-b">
            <span className="pw-marker pw-fs-md" style={{ color: "var(--c1)" }}>
              {slogan}
            </span>
          </Tile>
        ) : (
          <Tile c={4} r={2} className="pw-halftone pw-rot-b" />
        )}

        {/* nation icon motif */}
        <Tile c={1} r={2} className="pw-fill-c1 pw-icon">
          <NationIcon className="pw-svg" />
        </Tile>

        {/* SOIS LE NEX */}
        <Tile c={2} r={1} className="pw-fill-deep">
          <span className="pw-barlow-i pw-caps pw-fs-sm">SOIS LE NEX</span>
        </Tile>

        {/* diagonal stripes */}
        <Tile c={2} r={1} className="pw-stripes" />

        {/* big initial echo */}
        <Tile c={1} r={2} className="pw-fill-c2">
          <span className="pw-anton pw-fs-lg">{initial}</span>
        </Tile>

        {/* trophy / bol d'or */}
        <Tile c={3} r={1} className="pw-fill-c1">
          <span className="pw-bebas pw-fs-md" style={{ color: "var(--c2)" }}>
            {trophy}
          </span>
        </Tile>

        {/* stars */}
        <Tile c={2} r={1} className="pw-fill-deep pw-stars">
          <Star className="pw-svg-sm" />
          <Star className="pw-svg-sm" />
          <Star className="pw-svg-sm" />
        </Tile>

        {/* basketball icon */}
        <Tile c={1} r={1} className="pw-fill-c1 pw-icon">
          <Basketball className="pw-svg" />
        </Tile>

        {/* chevron pattern with torn bottom edge */}
        <Tile c={2} r={1} className="pw-chevron pw-torn" />

        {/* CHAMPIONS */}
        <Tile c={3} r={1} className="pw-fill-c2">
          <span className="pw-bebas pw-fs-md">CHAMPIONS</span>
        </Tile>

        {/* football icon */}
        <Tile c={1} r={1} className="pw-fill-deep pw-icon">
          <Football className="pw-svg" />
        </Tile>

        {/* EST. established — swaps to a pattern tile when null */}
        {established ? (
          <Tile c={2} r={1} className="pw-fill-cream">
            <span
              className="pw-barlow pw-caps pw-fs-sm"
              style={{ color: "var(--c1)" }}
            >
              EST. {established}
            </span>
          </Tile>
        ) : (
          <Tile c={2} r={1} className="pw-stripes" />
        )}

        {/* bolt icon */}
        <Tile c={1} r={1} className="pw-fill-c1 pw-icon">
          <Bolt className="pw-svg" />
        </Tile>

        {/* checkerboard #2, tilted */}
        <Tile c={2} r={1} className="pw-checker pw-rot-a" />

        {/* shield icon */}
        <Tile c={1} r={1} className="pw-fill-deep pw-icon">
          <Shield className="pw-svg" />
        </Tile>

        {/* QC / CA */}
        <Tile c={1} r={1} className="pw-fill-c2">
          <span className="pw-anton pw-fs-md">{isU ? "CA" : "QC"}</span>
        </Tile>

        {/* halftone #2 */}
        <Tile c={2} r={1} className="pw-halftone" />

        {/* nation wordmark small, outlined */}
        <Tile c={3} r={1} className="pw-fill-deep">
          <span className="pw-bebas pw-fs-md pw-outline">{nation}</span>
        </Tile>

        {/* stripes #2 */}
        <Tile c={2} r={1} className="pw-stripes" />
      </div>
    </header>
  );
}

/* --------------------------------------------------------------- scoped css -- */
/* Everything is prefixed `.pw-` and only applies under `.pw-root`, so the
   collage fonts + patterns never touch the rest of the app. */

const PW_CSS = `
.pw-root {
  --row: 76px;
  position: relative;
  width: 100%;
  background: var(--c1-deep);
  border-radius: 18px;
  padding: 14px;
  overflow: hidden;
  container-type: inline-size;
  box-shadow: inset 0 0 0 3px rgba(255,255,255,0.04);
}
.pw-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: var(--row);
  grid-auto-flow: row dense;
  gap: 6px;
}
.pw-tile {
  position: relative;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  line-height: 0.9;
  padding: 6px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.28);
}

/* ---- fills ---- */
.pw-fill-c1    { background: var(--c1); color: var(--c2); }
.pw-fill-c2    { background: var(--c2); color: var(--ink); }
.pw-fill-deep  { background: var(--c1-mid); color: var(--c2); }
.pw-fill-cream { background: var(--cream); color: var(--c1); }

/* ---- hero crest ---- */
.pw-hero {
  z-index: 4;
  padding: 12px;
  /* soft spotlight — lighter shade of c1 at the center, fading to the wall */
  background: radial-gradient(circle at 50% 40%, var(--c1-glow), var(--c1-deep) 72%);
  box-shadow:
    0 10px 30px rgba(0,0,0,0.5),
    0 3px 0 rgba(0,0,0,0.3);
}
.pw-hero-img { width: 100%; height: 100%; object-fit: contain; }
.pw-badge {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 6px solid var(--c2);
  border-radius: 16px;
  background: var(--c1-deep);
  /* subtle inner border + faint highlight ring */
  box-shadow:
    inset 0 0 0 3px var(--c1),
    inset 0 0 0 7px rgba(255,255,255,0.06);
  color: var(--c2);
}
.pw-badge-initial {
  font-family: 'Anton', system-ui, sans-serif;
  text-transform: uppercase;
  line-height: 0.82;
  font-size: clamp(52px, 13cqw, 168px);
}
.pw-badge-mascot {
  font-family: 'Bebas Neue', system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: clamp(14px, 2.6cqw, 34px);
}

/* ---- fonts (scoped) ---- */
.pw-anton    { font-family: 'Anton', system-ui, sans-serif; font-weight: 400; letter-spacing: 0.02em; text-transform: uppercase; }
.pw-bebas    { font-family: 'Bebas Neue', system-ui, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; }
.pw-barlow   { font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 600; }
.pw-barlow-i { font-family: 'Barlow Condensed', system-ui, sans-serif; font-weight: 600; font-style: italic; }
.pw-marker   { font-family: 'Permanent Marker', cursive; line-height: 1; }
.pw-caps     { text-transform: uppercase; letter-spacing: 0.06em; }

/* ---- type sizes (container-query driven) ---- */
.pw-fs-sm { font-size: clamp(11px, 1.6cqw, 18px); }
.pw-fs-md { font-size: clamp(15px, 2.6cqw, 30px); }
.pw-fs-lg { font-size: clamp(22px, 4.4cqw, 54px); }
.pw-fs-xl { font-size: clamp(34px, 8cqw, 118px); }
/* rail size auto-fits longer mascots (e.g. CONDORS) inside its column */
.pw-fs-rail { font-size: clamp(18px, 3.6cqw, 44px); }

.pw-vertical { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 0.02em; line-height: 1; }
.pw-outline  { color: transparent; -webkit-text-stroke: 2px var(--c2); }

/* ---- rotations / collage energy ---- */
.pw-rot-a { transform: rotate(-3.5deg) scale(1.02); z-index: 2; }
.pw-rot-b { transform: rotate(4deg) scale(1.02); z-index: 2; }

/* ---- pill ---- */
.pw-pill {
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 2px 14px;
}

/* ---- icons ---- */
.pw-icon { padding: 10px; }
.pw-svg    { width: 100%; height: 100%; max-width: 46px; max-height: 46px; }
.pw-svg-sm { width: 24px; height: 24px; }
.pw-stars  { gap: 4px; }

/* ---- patterns (built from the two theme colors only) ---- */
.pw-checker {
  background-color: var(--c1);
  background-image:
    linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%),
    linear-gradient(45deg, var(--c2) 25%, transparent 25%, transparent 75%, var(--c2) 75%);
  background-size: 26px 26px;
  background-position: 0 0, 13px 13px;
}
.pw-halftone {
  background-color: var(--c1-mid);
  background-image: radial-gradient(var(--c2) 24%, transparent 26%);
  background-size: 16px 16px;
}
.pw-stripes {
  background-image: repeating-linear-gradient(45deg, var(--c1) 0 10px, var(--c2) 10px 20px);
}
.pw-chevron {
  background-color: var(--c1);
  background-image:
    linear-gradient(135deg, var(--c2) 25%, transparent 25%),
    linear-gradient(225deg, var(--c2) 25%, transparent 25%);
  background-size: 22px 22px;
}

/* ---- torn / perforated bottom edge (CSS mask) ---- */
.pw-torn {
  -webkit-mask:
    linear-gradient(#000 0 0) 0 0 / 100% calc(100% - 7px) no-repeat,
    radial-gradient(circle at 6px 0, transparent 5.5px, #000 6px) 0 100% / 12px 7px repeat-x;
  mask:
    linear-gradient(#000 0 0) 0 0 / 100% calc(100% - 7px) no-repeat,
    radial-gradient(circle at 6px 0, transparent 5.5px, #000 6px) 0 100% / 12px 7px repeat-x;
}

/* ---- mobile ---- */
@container (max-width: 640px) {
  .pw-root { --row: 56px; padding: 10px; border-radius: 12px; }
  .pw-grid { gap: 4px; }
}
`;
