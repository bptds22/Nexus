"use client";

// components/program-wall/ProgramWall.tsx
//
// v7 — 1:1 port of docs/reference/wall-final-FREEZE.html. FROZEN 10×5 slot map;
// the layout is NEVER modified per school. Only the ~14 variable bindings
// (theme colors, type-block, rail, kraft, initials, hero logo/monogram, mascot,
// slogan, nickname, foam filter) come from data via resolveWall(). Everything
// else is constant Nexus copy, ported verbatim.
//
// Contrast: the reference hardcodes cream/red; here the SAME v3 floor drives
// --on-c1 (text on the primary surface) and --c1-cream (primary as text on a
// light surface), so neon-green (and any low-contrast primary) flips to legible
// automatically. No color-mix — Capacitor-safe. Rotations live on inner nodes;
// entry animations are opacity-only on positioned/rotated overlays (rule #3).

import * as React from "react";
import { deriveWallTheme } from "./theme";
import { resolveWall, type SchoolProgramIdentity } from "./slots";

export interface ProgramWallProps {
  school: SchoolProgramIdentity;
  /** Override the display-scale contrast floor (default WALL_DISPLAY_MIN_CONTRAST
   *  = 2.4). Only used by the /wall-test A/B comparison. */
  minContrast?: number;
}

export default function ProgramWall({ school, minContrast }: ProgramWallProps) {
  const theme = deriveWallTheme(
    school.colorPrimary,
    school.colorDarker,
    school.colorNeutral,
    minContrast,
  );
  const r = resolveWall(school, theme);
  const mosaicRef = React.useRef<HTMLDivElement>(null);

  // name-card guard: cap font for long mascots (dormant for ≤8 chars). Follow-up:
  // center-grow anchor (translateX(-50%)) for very long mascots.
  const nameFont =
    r.nameCard.length <= 8 ? "3.8cqw" : r.nameCard.length <= 11 ? "3cqw" : "2.4cqw";

  const rootStyle = {
    "--red": theme.red,
    "--red-deep": theme.redDeep,
    "--ink": theme.ink,
    "--char": theme.char,
    "--cream": theme.cream,
    "--kraft": theme.kraft,
    "--beige": theme.beige,
    "--on-c1": theme.onC1,
    "--c1-cream": theme.c1OnCream,
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
  } as React.CSSProperties;

  // Motion: scroll-into-view stagger (once) + hero pointer tilt (pointer:fine).
  React.useEffect(() => {
    const m = mosaicRef.current;
    if (!m) return;
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) return;

    m.querySelectorAll<HTMLElement>(".blk").forEach((b, i) => {
      b.style.animationDelay = i * 32 + "ms";
    });
    // Above-the-fold walls must animate on first paint — add `run` synchronously
    // if already in view, so there is never a blank hold waiting on the async IO
    // callback. Off-screen walls wait for scroll-into-view (once).
    const inView = () => {
      const rect = m.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    };
    let io: IntersectionObserver | null = null;
    if (inView()) {
      m.classList.add("run");
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              m.classList.add("run");
              io?.disconnect();
            }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.01 },
      );
      io.observe(m);
    }

    const tilt = m.querySelector<HTMLElement>(".hero-tilt");
    const fine = window.matchMedia("(pointer:fine)").matches;
    const onMove = (e: PointerEvent) => {
      const rect = m.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
      if (tilt)
        tilt.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const onLeave = () => {
      if (tilt) tilt.style.transform = "";
    };
    if (tilt && fine) {
      m.addEventListener("pointermove", onMove);
      m.addEventListener("pointerleave", onLeave);
    }
    return () => {
      io?.disconnect();
      m.removeEventListener("pointermove", onMove);
      m.removeEventListener("pointerleave", onLeave);
    };
  }, [school.id]);

  return (
    <div className="pw7" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: PW7_CSS }} />
      <div className="mosaic" ref={mosaicRef}>
        {/* ===== ROW 1 ===== */}
        <div className="blk b-play f-ink" style={{ gridColumn: "1/3", gridRow: "1" }}>
          <svg viewBox="0 0 300 130" fill="none" stroke="#F1EBDD" strokeOpacity=".2" strokeWidth="3">
            <circle cx="50" cy="95" r="11" /><circle cx="86" cy="95" r="11" /><circle cx="122" cy="95" r="11" />
            <path d="M30 55l17 17M47 55l-17 17" />
            <path d="M86 82V50c0-18 28-16 42-32" strokeDasharray="6 7" />
            <path d="M122 26l14-8-2 16" />
            <circle cx="225" cy="45" r="11" />
            <path d="M225 58v30c0 16-26 14-36 30" strokeDasharray="6 7" />
          </svg>
        </div>
        <div className="blk p-check sunk" style={{ gridColumn: "3", gridRow: "1" }} />
        <div className="blk wblk f-ink" style={{ gridColumn: "4", gridRow: "1" }}>
          <div className="anton stroke-cream" style={{ fontSize: "2cqw" }}>{r.eliteWord}</div>
        </div>
        <div className="blk p-fleurs sunk" style={{ gridColumn: "5", gridRow: "1" }} />
        <div className="blk wblk f-cream" style={{ gridColumn: "6", gridRow: "1" }}>
          <div className="bebas underlined" style={{ fontSize: "1.7cqw", color: "var(--c1-cream)", borderColor: "var(--c1-cream)" }}>{r.boldWord}</div>
        </div>
        <div className="blk b-type f-red raise grunge" style={{ gridColumn: "7/9", gridRow: "1/3" }}>
          <div className="l1">{r.typeL1}</div>
          <div className="l2" style={{ fontSize: r.typeL2Font }}>
            {r.typeL2Lines.map((ln, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{ln}</React.Fragment>
            ))}
          </div>
          <div className="l3">élite collégiale</div>
        </div>
        <div className="blk wblk f-cream" style={{ gridColumn: "9", gridRow: "1" }}>
          <div className="bebas" style={{ fontSize: "1.55cqw", color: "var(--c1-cream)" }}>SOIS LE NEX</div>
        </div>
        <div className="blk b-vert pop" style={{ gridColumn: "10", gridRow: "1/6" }}>
          <div className="w" style={{ fontSize: r.railFont }}>{r.railWord}</div>
        </div>

        {/* ===== ROW 2 ===== */}
        <div className="blk b-kraft raise" style={{ gridColumn: "1/3", gridRow: "2/5" }}>
          <div className="kw" style={{ left: "10%", top: "5%", fontFamily: "'Bebas Neue'", fontSize: "1.25cqw", letterSpacing: ".26em" }}>— ICI C'EST —</div>
          <div className="kw red" style={{ left: "9%", top: "11.5%", fontFamily: "'Anton'", fontSize: r.cityFont }}>{r.cityUpper}</div>
          <div className="k-rule" style={{ left: "10%", top: "24%", width: "56%" }} />
          <div className="k-bnr" style={{ left: "10%", top: "28%", fontSize: "1.15cqw", transform: "rotate(-2deg)" }}>{r.regionTag}</div>
          <div className="kw" style={{ left: "14%", top: "38%", fontFamily: "'Anton'", fontSize: "5cqw", opacity: ".92" }}>{r.areaCode}</div>
          <div className="kw red" style={{ left: "66%", top: "38%", fontFamily: "'Bebas Neue'", fontSize: "1.4cqw", letterSpacing: ".18em", transform: "rotate(90deg)", transformOrigin: "left top" }}>FIER · FORT</div>
          <div style={{ position: "absolute", left: "12%", top: "62%", width: "26%", aspectRatio: "1", background: "#cdbf9f" }} className="mask-fleur" />
          <div className="kw" style={{ left: "14%", top: "84%", fontFamily: "'Barlow Condensed'", fontStyle: "italic", fontWeight: 800, fontSize: "1.8cqw", color: "var(--c1-cream)" }}>D'ICI ➔ POUR ICI</div>
          <div className="k-rule" style={{ left: "10%", top: "95%", width: "64%", opacity: ".35" }} />
        </div>
        <div className="blk p-stripe-h" style={{ gridColumn: "3", gridRow: "2" }} />
        <div className="blk f-red icwrap" style={{ gridColumn: "4", gridRow: "2" }}>
          <svg style={{ width: "42%", color: "var(--on-c1)", opacity: ".9" }} viewBox="0 0 24 24" fill="currentColor"><path d="M4 3a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm2 1 15 3.2a.6.6 0 0 1 .12 1.13L6 14V4Z" /></svg>
        </div>
        <div className="blk wblk f-ink raise grunge" style={{ gridColumn: "5", gridRow: "2" }}>
          <div className="anton" style={{ fontSize: "1.75cqw", color: "var(--cream)" }}>CHAMPIONS</div>
        </div>
        <div className="blk p-check-mini sunk" style={{ gridColumn: "6", gridRow: "2" }} />
        <div className="blk f-cream raise" style={{ gridColumn: "9", gridRow: "2" }}>
          <div className="mask-fleur" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(-6deg)", width: "175%", aspectRatio: "1", background: "var(--char)" }} />
        </div>

        {/* ===== ROW 3 ===== */}
        <div className="blk f-ink icwrap" style={{ gridColumn: "3", gridRow: "3" }}>
          <div className="anton" style={{ fontSize: "8.8cqw", color: "var(--cream)", letterSpacing: 0, lineHeight: ".8" }}>{r.initials}</div>
        </div>
        <div className="blk p-chev" style={{ gridColumn: "4", gridRow: "3" }} />
        <div className="blk p-dots-red" style={{ gridColumn: "5", gridRow: "3" }} />
        <div className="blk p-diag-wide" style={{ gridColumn: "6", gridRow: "3" }} />
        <div className="blk f-red icwrap raise" style={{ gridColumn: "7", gridRow: "3", gap: ".9cqw" }}>
          <svg style={{ width: "26%", color: "var(--on-c1)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          <svg style={{ width: "26%", color: "var(--on-c1)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="7" /></svg>
        </div>
        <div className="blk wblk f-cream" style={{ gridColumn: "8", gridRow: "3" }}>
          <div className="anton" style={{ fontSize: "8.2cqw", color: "var(--c1-cream)", lineHeight: ".8" }}>#1</div>
        </div>
        <div className="blk b-fleur" style={{ gridColumn: "9", gridRow: "3/5" }}>
          <div className="mask-fleur" style={{ position: "absolute", left: "10%", top: "8%", width: "40%", aspectRatio: "1", background: "#C4B48D", transform: "rotate(-8deg)" }} />
          <div className="mask-maple" style={{ position: "absolute", right: "6%", top: "46%", width: "52%", aspectRatio: "1", background: "#C4B48D", transform: "rotate(6deg)" }} />
          <div className="mask-maple" style={{ position: "absolute", right: "10%", top: "8%", width: "26%", aspectRatio: "1", background: "#C4B48D", transform: "rotate(14deg)" }} />
          <div className="mask-maple" style={{ position: "absolute", left: "8%", bottom: "5%", width: "30%", aspectRatio: "1", background: "#C4B48D", transform: "rotate(-12deg)" }} />
        </div>

        {/* ===== ROW 4 ===== */}
        <div className="blk p-grid" style={{ gridColumn: "3", gridRow: "4" }} />
        <div className="blk wblk f-red" style={{ gridColumn: "4", gridRow: "4" }}>
          <div className="bebas underlined" style={{ fontSize: "1.9cqw", color: "var(--on-c1)", borderColor: "var(--on-c1)" }}>{r.allezWord}</div>
        </div>
        <div className="blk p-tri sunk" style={{ gridColumn: "5", gridRow: "4" }} />
        <div className="blk wblk f-cream" style={{ gridColumn: "6", gridRow: "4" }}>
          <div className="marker" style={{ fontSize: "1.6cqw", color: "var(--c1-cream)", transform: "rotate(-3deg)" }}>Fierté</div>
        </div>
        <div className="blk b-play2" style={{ gridColumn: "7", gridRow: "4" }}>
          <svg viewBox="0 0 150 130" fill="none" stroke="#F1EBDD" strokeOpacity=".22" strokeWidth="3.2">
            <path d="M10 118a64 64 0 0 1 130 0" />
            <circle cx="52" cy="86" r="10" />
            <path d="M88 66l20 12M98 60l-2 24" strokeWidth="2.8" />
            <path d="M52 74V44c0-14 26-12 40-24" strokeDasharray="6 7" />
            <path d="M88 26l14-8-2 16" />
          </svg>
        </div>
        <div className="blk wblk f-ink" style={{ gridColumn: "8", gridRow: "4" }}>
          <div className="bebas line-behind" style={{ fontSize: "1.6cqw", color: "var(--cream)" }}>{r.ensembleWord}</div>
        </div>

        {/* ===== ROW 5 ===== */}
        <div className="blk b-nexus pop" style={{ gridColumn: "1/3", gridRow: "5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/nexus-wordmark-white.png" alt="NEXUS" />
        </div>
        <div className="blk b-rseq" style={{ gridColumn: "3", gridRow: "5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.leagueLogo} alt="RSEQ" />
        </div>
        <div className="blk f-ink" style={{ gridColumn: "4", gridRow: "5" }}>
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 150 130" fill="none" stroke="#F1EBDD" strokeOpacity=".85" strokeWidth="3.6">
            <circle cx="38" cy="98" r="12" />
            <path d="M38 84V56c0-15 24-16 44-27" strokeDasharray="7 8" />
            <path d="M92 24l-12 1M92 24l-6 12" />
          </svg>
        </div>
        <div className="blk f-red icwrap grunge" style={{ gridColumn: "5", gridRow: "5" }}>
          <svg style={{ width: "34%", color: "var(--on-c1)" }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5Z" /></svg>
        </div>
        <div className="blk p-diag" style={{ gridColumn: "6", gridRow: "5" }} />
        <div className="blk wblk f-red" style={{ gridColumn: "7", gridRow: "5" }}>
          <div className="anton" style={{ fontSize: "2.2cqw", color: "var(--on-c1)", transform: "rotate(-8deg)" }}>CANADA</div>
        </div>
        <div className="blk wblk f-cream raise" style={{ gridColumn: "8", gridRow: "5" }}>
          <div style={{ fontFamily: "'Playfair Display'", fontStyle: "italic", fontWeight: 700, fontSize: "1.8cqw", color: "var(--c1-cream)" }}>QUÉBEC</div>
        </div>
        <div className="blk p-check-ink sunk" style={{ gridColumn: "9", gridRow: "5" }} />

        {/* ===== roundels ===== */}
        <div className="roundwrap" style={{ left: "26%", top: "14.5%", animationDelay: "1.1s" }}>
          <div className="roundel"><div className="d1">D1</div><div className="rs">DIVISION</div></div>
        </div>
        <div className="roundwrap" style={{ left: "80%", top: "40%", animationDelay: "1.2s" }}>
          <div className="roundel" style={{ transform: "rotate(8deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="xic" src="/logos/nexus-x.png" alt="X" />
          </div>
        </div>

        <div className="vign" />
        <div className="scrim" />
        <svg className="grain"><filter id="pw7n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" /></filter><rect width="100%" height="100%" filter="url(#pw7n)" /></svg>

        {/* ===== floats ===== */}
        <div className="float" style={{ left: "40%", top: "40%", width: "3.6cqw", animationDelay: "1.25s" }}>
          <svg style={{ color: "var(--cream)", transform: "rotate(-9deg)" }} viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v2h2.5A1.5 1.5 0 0 1 22 6.5c0 2.7-1.9 4.9-4.4 5.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1a6 6 0 0 1-4.6-4C3.9 11.4 2 9.2 2 6.5A1.5 1.5 0 0 1 3.5 5H6V3Z" /></svg>
        </div>
        <div className="float" style={{ left: "17.5%", top: "54%", width: "6.5cqw", animationDelay: "1.5s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/foam-red.png" alt="#1" style={{ width: "100%", transform: "rotate(-15deg)", filter: r.foamFilter }} />
        </div>

        {r.sloganLines && (
          <div className="slogan-card">
            {r.sloganLines.map((ln, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{ln}</React.Fragment>
            ))}
          </div>
        )}
        {r.nickname && <div className="under-card">{r.nickname}</div>}

        {/* ===== HERO ===== */}
        <div className="hero">
          <div className="hero-tilt" id="tilt">
            <div className="logo-card">
              {r.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logoUrl!} alt={`${school.schoolName} — ${school.mascot}`} />
              ) : (
                <div className="mono">{r.monogram}</div>
              )}
            </div>
            <div className="name-card" style={{ fontSize: nameFont }}>{r.nameCard}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- scoped CSS (1:1) -- */
/* Ported verbatim from wall-final-FREEZE.html, scoped under `.pw7`; entry
   animations gated under `.mosaic.run` (added on scroll-into-view). */

const PW7_CSS = `
.pw7{--pop:cubic-bezier(0.34,1.56,0.64,1)}
.pw7 .mosaic{position:relative;aspect-ratio:21/9;border-radius:12px 12px 0 0;overflow:hidden;
  container-type:inline-size;background:var(--ink);
  display:grid;grid-template-columns:repeat(10,10%);grid-template-rows:repeat(5,20%);gap:0}

.pw7 .blk{position:relative;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05);
  opacity:0;transform:translateY(14px) scale(.985)}
.pw7 .mosaic.run .blk{animation:pw7in .46s var(--pop) both}
@keyframes pw7in{to{opacity:1;transform:none}}
@keyframes pw7fadein{to{opacity:1}}
.pw7 .blk:nth-child(3n){filter:brightness(1.035)}
.pw7 .blk:nth-child(4n){filter:brightness(.965)}
.pw7 .raise{z-index:8;box-shadow:0 .95cqw 2.4cqw rgba(0,0,0,.72), inset 0 0 0 1px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07)}
.pw7 .pop{z-index:12;transform:scale(1.05);
  box-shadow:0 1.3cqw 3cqw rgba(0,0,0,.75), inset 0 0 0 1px rgba(0,0,0,.25)}
.pw7 .mosaic.run .pop{animation:pw7fadein .5s ease both}
.pw7 .sunk{box-shadow:inset 0 .65cqw 1.8cqw rgba(0,0,0,.72), inset 0 0 0 1px rgba(0,0,0,.4);filter:brightness(.84)}
.pw7 .grunge::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:1;
  background-image:radial-gradient(rgba(0,0,0,.5) 1.2px,transparent 1.8px),radial-gradient(rgba(255,255,255,.26) 1.1px,transparent 1.7px),radial-gradient(rgba(0,0,0,.35) 2px,transparent 2.6px);
  background-size:.8cqw .8cqw,1.4cqw 1.1cqw,3.1cqw 2.7cqw;background-position:0 0,.55cqw .35cqw,1.2cqw .8cqw}

.pw7 .grain{position:absolute;inset:0;z-index:40;pointer-events:none;mix-blend-mode:overlay;opacity:.55}
.pw7 .vign{position:absolute;inset:0;z-index:39;pointer-events:none;
  background:radial-gradient(120% 100% at 50% 40%, transparent 58%, rgba(0,0,0,.3) 100%)}
.pw7 .scrim{position:absolute;z-index:41;left:38%;top:12%;width:24%;height:76%;pointer-events:none;
  background:radial-gradient(55% 55% at 50% 48%, rgba(12,4,6,.16), transparent 75%)}

.pw7 .p-check{background:repeating-conic-gradient(var(--red) 0 25%,var(--cream) 0 50%) 0 0/2.6cqw 2.6cqw}
.pw7 .p-check-ink{background:repeating-conic-gradient(var(--ink) 0 25%,var(--red) 0 50%) 0 0/2cqw 2cqw}
.pw7 .p-check-mini{background:repeating-conic-gradient(var(--red-deep) 0 25%,var(--kraft) 0 50%) 0 0/1.4cqw 1.4cqw}
.pw7 .p-fleurs{background:var(--char)}
.pw7 .p-fleurs::after{content:"";position:absolute;inset:0;background:var(--cream);opacity:.32;
  -webkit-mask:url(/logos/fleur-de-lys.png) 0 0/2cqw 2cqw repeat;mask:url(/logos/fleur-de-lys.png) 0 0/2cqw 2cqw repeat}
.pw7 .p-dots-red{background:var(--red) radial-gradient(rgba(25,20,20,.55) 18%,transparent 20%) 0 0/1.2cqw 1.2cqw}
.pw7 .p-dots-cream{background:var(--cream) radial-gradient(var(--red) 15%,transparent 17%) 0 0/1.6cqw 1.6cqw}
.pw7 .p-diag{background:repeating-linear-gradient(-45deg,var(--cream) 0 .9cqw,var(--red) .9cqw 2cqw)}
.pw7 .p-diag-wide{background:repeating-linear-gradient(45deg,var(--red) 0 1.4cqw,var(--cream) 1.4cqw 3cqw)}
.pw7 .p-stripe-h{background:repeating-linear-gradient(0deg,var(--cream) 0 1.1cqw,var(--char) 1.1cqw 2.4cqw)}
.pw7 .p-chev{background:var(--cream);position:relative}
.pw7 .p-chev::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(-58deg,var(--red) 0 .9cqw,transparent .9cqw 2.5cqw)}
.pw7 .p-tri{background:var(--red-deep);position:relative}
.pw7 .p-tri::before{content:"";position:absolute;inset:0;background:conic-gradient(from 60deg at 50% 65%, var(--cream) 0 60deg, transparent 0) 0 0/2.4cqw 2.2cqw;opacity:.85}
.pw7 .p-grid{background:var(--cream);position:relative}
.pw7 .p-grid::before{content:"";position:absolute;inset:0;
  background:linear-gradient(rgba(30,26,25,.55) 1px,transparent 1px) 0 0/100% 1.5cqw,linear-gradient(90deg,rgba(30,26,25,.55) 1px,transparent 1px) 0 0/1.5cqw 100%}
.pw7 .f-red{background:var(--red)} .pw7 .f-ink{background:var(--char)} .pw7 .f-cream{background:var(--cream)}

.pw7 .wblk{display:flex;align-items:center;justify-content:center;text-align:center;padding:.4cqw}
.pw7 .anton{font-family:'Anton'} .pw7 .bebas{font-family:'Bebas Neue';letter-spacing:.06em}
.pw7 .marker{font-family:'Permanent Marker'}
.pw7 .icwrap{display:flex;align-items:center;justify-content:center}
.pw7 .mask-fleur{-webkit-mask:url(/logos/fleur-de-lys.png) center/contain no-repeat;mask:url(/logos/fleur-de-lys.png) center/contain no-repeat}
.pw7 .mask-maple{-webkit-mask:url(/logos/maple-leaf.png) center/contain no-repeat;mask:url(/logos/maple-leaf.png) center/contain no-repeat}
.pw7 .stroke-cream{color:transparent;-webkit-text-stroke:.12cqw rgba(241,235,221,.85)}
.pw7 .line-behind{position:relative;z-index:1}
.pw7 .line-behind::before{content:"";position:absolute;left:-14%;right:-14%;top:52%;height:.28cqw;background:var(--red);z-index:-1}
.pw7 .underlined{border-bottom:.22cqw solid var(--cream);padding-bottom:.25cqw}

.pw7 .b-kraft{background:var(--kraft);color:var(--ink)}
.pw7 .kw{position:absolute;white-space:nowrap;line-height:1}
.pw7 .kw.red{color:var(--c1-cream)}
.pw7 .k-rule{position:absolute;height:2px;background:var(--ink);opacity:.6}
.pw7 .k-bnr{position:absolute;background:var(--red);color:var(--on-c1);font-family:'Bebas Neue';padding:.22cqw .8cqw;letter-spacing:.06em}
.pw7 .b-play svg,.pw7 .b-play2 svg{position:absolute;inset:0;width:100%;height:100%}
.pw7 .b-play2{background:var(--char)}
.pw7 .b-type{display:flex;flex-direction:column;justify-content:center;padding:1.4cqw;gap:.3cqw}
.pw7 .b-type .l1{font-family:'Bebas Neue';font-size:1.25cqw;letter-spacing:.32em;color:var(--on-c1);opacity:.85}
.pw7 .b-type .l2{font-family:'Anton';font-size:2.5cqw;line-height:.95;color:var(--on-c1);text-transform:uppercase}
.pw7 .b-type .l3{font-family:'Playfair Display';font-style:italic;font-weight:500;font-size:1.15cqw;color:var(--on-c1);opacity:.9;margin-top:.35cqw}
.pw7 .b-fleur{background:var(--beige)}
.pw7 .b-vert{background:var(--char);display:flex;align-items:center;justify-content:center}
.pw7 .b-vert .w{writing-mode:vertical-rl;font-family:'Anton';font-size:9.4cqw;line-height:.86;letter-spacing:.02em;color:transparent;-webkit-text-stroke:.12cqw rgba(241,235,221,.4);text-transform:uppercase}
.pw7 .b-nexus{background:var(--red);display:flex;align-items:center;justify-content:center}
.pw7 .b-nexus::before{content:"";position:absolute;inset:0;opacity:.5;background:repeating-linear-gradient(35deg,rgba(255,255,255,.03) 0 2px,transparent 2px 6px)}
.pw7 .b-nexus img{width:58%;display:block;position:relative}
.pw7 .b-rseq{background:var(--cream);display:flex;align-items:center;justify-content:center}
.pw7 .b-rseq img{width:66%;display:block}

.pw7 .roundwrap{position:absolute;z-index:45;opacity:0}
.pw7 .mosaic.run .roundwrap{animation:pw7fadein .5s ease both}
.pw7 .roundel{width:6cqw;height:6cqw;border-radius:50%;background:var(--red-deep);border:.28cqw solid var(--cream);
  display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 .5cqw 1.2cqw rgba(0,0,0,.45);transform:rotate(-7deg)}
.pw7 .roundel .d1{font-family:'Anton';font-size:1.9cqw;color:var(--cream);line-height:1}
.pw7 .roundel .rs{font-family:'Bebas Neue';font-size:.75cqw;letter-spacing:.26em;color:var(--cream);opacity:.85;margin-top:.12cqw}
.pw7 .roundel .xic{width:2.6cqw;filter:grayscale(1) brightness(3.2)}

.pw7 .float{position:absolute;z-index:45;filter:drop-shadow(0 .5cqw 1.1cqw rgba(0,0,0,.55));opacity:0}
.pw7 .mosaic.run .float{animation:pw7fadein .5s ease both}
.pw7 .float svg,.pw7 .float img{display:block}

.pw7 .slogan-card{position:absolute;z-index:46;left:80%;top:80%;transform:rotate(7deg);
  background:var(--cream);border-radius:.6cqw;padding:1.1cqw 1.7cqw;box-shadow:0 .8cqw 1.8cqw rgba(0,0,0,.5);
  font-family:'Permanent Marker';font-size:1.95cqw;color:var(--c1-cream);line-height:1.3;text-align:center;white-space:nowrap;opacity:0}
.pw7 .mosaic.run .slogan-card{animation:pw7fadein .55s ease 1.4s both}

.pw7 .hero{position:absolute;z-index:50;left:50%;top:46%;transform:translate(-50%,-50%);opacity:0}
.pw7 .mosaic.run .hero{animation:pw7heroIn .62s var(--pop) 1.05s both}
@keyframes pw7heroIn{from{opacity:0;transform:translate(-50%,-66%) scale(.88)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
.pw7 .hero-tilt{transition:transform .18s ease-out;will-change:transform}
.pw7 .hero .logo-card{width:24.5cqw;background:var(--cream);border-radius:1.2cqw;padding:1.6cqw;transform:rotate(-2deg);box-shadow:0 2cqw 4cqw rgba(0,0,0,.66), 0 .35cqw 1cqw rgba(0,0,0,.42)}
.pw7 .hero .logo-card img{width:100%;display:block}
.pw7 .hero .logo-card .mono{font-family:'Anton';font-size:12.5cqw;line-height:1;color:var(--c1-cream);text-align:center;padding:1.6cqw 0}
.pw7 .name-card{position:absolute;z-index:51;left:57%;bottom:-2.4cqw;transform:rotate(3deg);max-width:46cqw;
  background:var(--red);color:var(--on-c1);font-family:'Anton';font-size:3.8cqw;letter-spacing:.015em;
  padding:.55cqw 1.8cqw .7cqw;border-radius:.6cqw;border:.28cqw solid var(--cream);box-shadow:0 1.2cqw 2.6cqw rgba(0,0,0,.55);white-space:nowrap}
.pw7 .under-card{position:absolute;z-index:49;left:40.5%;top:67%;transform:rotate(-5deg);will-change:opacity;
  background:var(--cream);color:var(--c1-cream);font-family:'Bebas Neue';font-size:1.6cqw;letter-spacing:.08em;
  padding:.5cqw 1.2cqw;border-radius:.4cqw;box-shadow:0 .5cqw 1.2cqw rgba(0,0,0,.4);opacity:0}
.pw7 .mosaic.run .under-card{animation:pw7fadein .5s ease .9s both}

@media (prefers-reduced-motion:reduce){
  .pw7 .blk{opacity:1;transform:none}
  .pw7 .roundwrap,.pw7 .float,.pw7 .slogan-card,.pw7 .under-card,.pw7 .hero{opacity:1}
}
`;
