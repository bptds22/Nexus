"use client";

// components/program-page/ProgramPage.tsx
//
// Niveau-1 page — 1:1 port of docs/reference/page-niveau1-web-v7.html (desktop).
// Assembles: Wall (committed, untouched) + Menu (mb2) + Ticker + 6 sections +
// CTA + ghost layer. FIXED Nexus shell (#111317 / #1A1D24 / #0C0E11); ONE école
// colour via the wall theme vars (--red + derived --red-deep; --cream = neutral).
// Platform moments stay #E63946 (strip counter, CTA). No color-mix.

import * as React from "react";
import ProgramWall from "@/components/program-wall/ProgramWall";
import ProgramWallMenu from "@/components/program-wall/ProgramWallMenu";
import { deriveWallTheme } from "@/components/program-wall/theme";
import type { SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { ProgramPageContent } from "./content";
import Ticker from "./Ticker";
import StatRows from "./StatRows";
import SportsGrid from "./SportsGrid";
import AboutSell from "./AboutSell";
import CampusSection from "./CampusSection";
import AcademicPlanche from "./AcademicPlanche";
import ParcoursRoute from "./ParcoursRoute";
import CtaCibles from "./CtaCibles";

export interface ProgramPageProps {
  school: SchoolProgramIdentity;
  content: ProgramPageContent;
}

export default function ProgramPage({ school, content }: ProgramPageProps) {
  const theme = deriveWallTheme(school.colorPrimary, school.colorDarker, school.colorNeutral);
  const ref = React.useRef<HTMLDivElement>(null);

  const rootStyle = {
    "--red": theme.red,
    "--red-deep": theme.redDeep,
    "--ink": theme.ink,
    "--char": theme.char,
    "--cream": theme.cream,
    "--kraft": theme.kraft,
    "--beige": theme.beige,
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)",
  } as React.CSSProperties;

  // Reveals (above-fold sync fix) + counters (ease-out cubic). Reduced-motion →
  // reveals static via CSS, counters jump to final value.
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const counters = [...root.querySelectorAll<HTMLElement>("[data-count]")];
    const setFinal = (el: HTMLElement) =>
      (el.textContent = (el.dataset.count ?? "") + (el.dataset.suffix ?? ""));

    if (reduce) {
      counters.forEach(setFinal);
      return; // CSS shows .rv/.rvy at full opacity under reduced-motion
    }

    // reveals — staggered per parent group
    const groups = new Map<Element, number>();
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const p = el.parentElement!;
          const i = groups.get(p) ?? 0;
          groups.set(p, i + 1);
          window.setTimeout(() => el.classList.add("in"), Math.min(i * 70, 520));
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );
    root.querySelectorAll<HTMLElement>(".rv,.rvy").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add("in");
      else io.observe(el);
    });

    // counters
    const co = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const end = +(el.dataset.count ?? 0);
          const suf = el.dataset.suffix ?? "";
          const t0 = performance.now();
          const D = 1050;
          const tk = (t: number) => {
            const k = Math.min((t - t0) / D, 1);
            el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suf;
            if (k < 1) requestAnimationFrame(tk);
          };
          requestAnimationFrame(tk);
          co.unobserve(el);
        });
      },
      { threshold: 0.6 },
    );
    counters.forEach((el) => co.observe(el));

    return () => {
      io.disconnect();
      co.disconnect();
    };
  }, [school.id]);

  return (
    <div className="pp" ref={ref} style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: PP_CSS }} />

      <div className="frame">
        <ProgramWall school={school} />
        <ProgramWallMenu school={school} />
      </div>

      <Ticker words={content.ticker} />

      <div className="pagewrap">
        <svg className="pgrain"><filter id="pg"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" /></filter><rect width="100%" height="100%" filter="url(#pg)" /></svg>

        <StatRows schoolName={school.schoolName} city={school.city} stats={content.stats} />
        <SportsGrid sports={content.sports} />
        <CampusSection content={content} />
        <AboutSell title={content.sellTitle} sellText={content.sellText} />
        <AcademicPlanche featured={content.featuredPrograms} programs={content.programsList} />
        <ParcoursRoute
          schoolName={school.schoolName}
          initials={school.initials}
          slogan={school.slogan}
          route={content.route}
          universities={content.universities}
          nexusStripText={content.nexusStripText}
          nexusRecruitedCount={content.nexusRecruitedCount}
        />
        <CtaCibles ctaTitle={content.ctaTitle} notifyName={content.ctaNotifyName} />
        <div className="pfoot">⚡ Propulsé par Nexus · données de démonstration</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ scoped page CSS (1:1) ----- */
const PP_CSS = `
.pp{background:#111317;color:#EDEFF3;font-family:'Barlow Condensed',sans-serif;scroll-margin-top:60px}
.pp .frame{max-width:1500px;margin:0 auto}
/* menu v2 lives in ProgramWallMenu (.mb2) */
/* ticker */
.pp .ticker{overflow:hidden;background:#0C0E11;border-bottom:1px solid #1E2129}
.pp .ticker-in{display:flex;align-items:center;width:max-content;animation:pptick 26s linear infinite;padding:10px 0}
.pp .ticker span{font-family:'Bebas Neue';letter-spacing:.22em;font-size:13.5px;white-space:nowrap;padding:0 18px;color:#B9BFC9}
.pp .ticker span.g{color:var(--red);filter:brightness(1.45)}
.pp .ticker i{color:#3A404D;font-style:normal}
@keyframes pptick{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.pp .ticker-in{animation:none}}
/* sections */
.pp .pagewrap{max-width:1500px;margin:0 auto;position:relative}
.pp .pgrain{position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:overlay;opacity:.18}
.pp section{position:relative;z-index:2;padding:72px 26px 64px;border-bottom:1px solid #1E2129;overflow:hidden}
.pp .sec-in{max-width:1180px;margin:0 auto;position:relative}
.pp .kick{font-family:'Bebas Neue';letter-spacing:.34em;font-size:13px;color:var(--red);filter:brightness(1.5)}
.pp .sec-h{font-family:'Anton';font-size:clamp(30px,3.6vw,46px);text-transform:uppercase;color:#EDEFF3;margin:6px 0 4px;line-height:1.02}
.pp .sec-h em{font-style:normal;color:var(--red);filter:brightness(1.3)}
.pp .pbar{width:100px;height:9px;background:repeating-conic-gradient(var(--red) 0 25%,transparent 0 50%) 0 0/9px 9px;margin:14px 0 8px}
.pp .lead{font-family:'Outfit';font-size:15.5px;line-height:1.65;color:#B9BFC9;max-width:640px}
.pp .spine{position:absolute;pointer-events:none;color:#EDEFF3;opacity:.05}
/* S1 */
.pp .bigid .l1x{font-family:'Anton';font-size:clamp(26px,2.6vw,36px);color:var(--red);filter:brightness(1.3);text-transform:uppercase;line-height:1}
.pp .bigid .l2x{font-family:'Anton';font-size:clamp(44px,5.4vw,76px);color:#EDEFF3;text-transform:uppercase;line-height:1;margin-top:2px}
.pp .tstack{margin:30px -26px 0;position:relative;z-index:2}
.pp .trow{display:flex;align-items:baseline;gap:22px;padding:26px 8%;line-height:1}
.pp .trow .big{font-family:'Anton';font-size:clamp(46px,5.6vw,78px)}
.pp .trow .lab{font-family:'Bebas Neue';letter-spacing:.18em;font-size:clamp(14px,1.4vw,19px);opacity:.85}
.pp .tr-ink{background:#191414;color:#EDEFF3}
.pp .tr-red{background:var(--red);color:#fff}
.pp .tr-cream{background:#EFF1F4;color:#15171B}
.pp .tr-cream .big{color:var(--red)}
/* S2 */
.pp .sports{display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:14px;margin-top:30px}
.pp .scard{background:#1A1D24;border:1.5px solid #262A33;border-radius:16px;padding:20px 18px 16px;position:relative;min-height:196px;display:flex;flex-direction:column;cursor:pointer;text-decoration:none;transition:transform .28s cubic-bezier(0.34,1.56,0.64,1),border-color .2s,box-shadow .28s}
.pp .scard:hover{transform:translateY(-5px);border-color:var(--red);box-shadow:0 16px 34px rgba(0,0,0,.4)}
.pp .scard svg.si{width:54px;height:54px;color:var(--red);filter:brightness(1.25);opacity:.9;margin-bottom:auto}
.pp .scard .go{position:absolute;top:16px;right:16px;color:#5A616D;font-family:'Outfit';font-weight:800;transition:.2s}
.pp .scard:hover .go{color:var(--red);filter:brightness(1.4)}
.pp .scard .sn{font-family:'Anton';font-size:18px;color:#EDEFF3;text-transform:uppercase;margin-top:12px}
.pp .scard .sd{font-family:'Outfit';font-weight:600;font-size:12px;color:#8A909C;margin-top:3px}
.pp .sb{display:flex;gap:6px;margin-top:11px;flex-wrap:wrap}
.pp .bdg{font-family:'Bebas Neue';letter-spacing:.1em;font-size:11px;padding:4px 10px;border-radius:99px}
.pp .b-d1{background:var(--red);color:#fff}
.pp .b-rec{background:rgba(34,197,94,.15);color:#6EE7A0}
/* S3 */
.pp .sell{font-family:'Outfit';font-size:clamp(17px,1.7vw,21px);line-height:1.7;color:#D5D8DE;max-width:820px;margin-top:22px}
.pp .sell b{color:#fff}
.pp .sell .hl{color:var(--red);filter:brightness(1.4);font-weight:700}
/* Campus (v8.2) — fiche + carte + facts + vstrip */
.pp .fiche{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:28px}
.pp .itile{background:#1A1D24;border:1.5px solid #262A33;border-radius:14px;padding:18px 20px}
.pp .itile .il{font-family:'Bebas Neue';letter-spacing:.22em;font-size:12px;color:#8A909C}
.pp .itile .iv{font-family:'Anton';font-size:clamp(20px,1.9vw,26px);color:#EDEFF3;margin-top:5px;text-transform:uppercase}
.pp .itile.hot{background:var(--red);border-color:transparent}
.pp .itile.hot .il{color:rgba(255,255,255,.75)}
.pp .itile.hot .iv{color:#fff}
.pp .cgrid{display:grid;grid-template-columns:1.15fr 1fr;gap:20px;margin-top:20px}
@media(max-width:880px){.pp .cgrid{grid-template-columns:1fr}}
.pp .mapwrap{position:relative;border-radius:16px;overflow:hidden;border:1.5px solid #262A33;min-height:340px;background:#14161C}
.pp .mapwrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0;filter:grayscale(.2) contrast(1.02)}
.pp .mappin{position:absolute;left:12px;bottom:12px;background:#14161Cee;color:#C9CCD4;font-family:'Outfit';font-weight:600;font-size:12.5px;padding:9px 13px;border-radius:9px;border:1px solid #262A33}
/* facts (reference ships no .fact/.fi CSS — minimal layout added, mirroring .pr) */
.pp .facts{display:flex;flex-direction:column;gap:14px}
.pp .fact{display:flex;gap:13px;align-items:flex-start;background:#1A1D24;border:1.5px solid #262A33;border-radius:14px;padding:16px 18px}
.pp .fact .fi{flex:0 0 auto;color:var(--red);filter:brightness(1.3);margin-top:1px}
.pp .fact .fi svg{width:22px;height:22px;display:block}
.pp .fact b{font-family:'Outfit';font-weight:700;font-size:14.5px;color:#EDEFF3;display:block}
.pp .fact span{font-family:'Outfit';font-size:12.5px;color:#98A0AB;line-height:1.5;display:block;margin-top:3px}
.pp .hfact{border-color:var(--red)}
.pp .hbdg{display:inline-block;font-family:'Bebas Neue';letter-spacing:.16em;font-size:10.5px;background:var(--red);color:#fff;padding:3px 9px;border-radius:99px;margin-bottom:5px;transform:rotate(-1.5deg)}
.pp .vstrip{display:block;margin-top:20px;font-family:'Outfit';font-weight:600;font-size:12.5px;color:#6A707C;background:#14161C;border:1.4px dashed #2A2F3A;border-radius:11px;padding:12px 16px;text-decoration:none}
.pp .vstrip .vp{display:inline-flex;width:24px;height:24px;border-radius:50%;background:#1D2027;align-items:center;justify-content:center;margin-right:8px;font-size:10px}
.pp .vstrip b{color:#9AA0AC}
/* S5 */
.pp .planche{margin-top:30px;background:#161A21;border:1.6px dashed rgba(237,239,243,.28);border-radius:18px;padding:30px;position:relative;overflow:hidden}
.pp .planche svg.xo{position:absolute;right:6px;top:10px;width:180px;opacity:.07;color:#EDEFF3}
.pp .vedette{display:inline-block;font-family:'Bebas Neue';letter-spacing:.24em;font-size:12.5px;background:var(--red);color:#fff;padding:6px 14px;border-radius:99px;transform:rotate(-2deg);margin-bottom:20px}
.pp .prim{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}
.pp .pr{display:flex;gap:14px;align-items:flex-start}
.pp .pr .no{font-family:'Anton';font-size:24px;color:var(--red);filter:brightness(1.45);min-width:34px}
.pp .pr b{font-family:'Outfit';font-weight:700;font-size:15px;color:#EDEFF3;display:block}
.pp .pr span{font-family:'Outfit';font-size:12.5px;color:#98A0AB;line-height:1.5}
.pp .chalkline{border:0;border-top:1.4px dashed rgba(241,235,221,.2);margin:24px 0 18px}
.pp .pl-t{font-family:'Bebas Neue';letter-spacing:.22em;font-size:12px;color:#8A909C;margin-bottom:12px}
.pp .progs{display:flex;gap:9px;flex-wrap:wrap}
.pp .prog{font-family:'Outfit';font-weight:600;font-size:12.5px;color:#C9CCD4;background:#1D212A;padding:9px 14px;border-radius:99px}
.pp .prog i{font-style:normal;color:var(--red);filter:brightness(1.4);margin-right:6px}
.pp .psearch{width:100%;max-width:440px;display:block;margin:0 0 14px;background:#1D212A;border:1.5px solid #2A2F3A;border-radius:11px;padding:12px 16px;font-family:'Outfit';font-weight:600;font-size:13.5px;color:#EDEFF3;outline:none}
.pp .psearch:focus{border-color:var(--red)}
.pp .psearch::placeholder{color:#6A707C}
/* S6 */
.pp .route{position:relative;margin-top:34px;padding-left:74px;max-width:760px}
.pp .route::before{content:"";position:absolute;left:31px;top:10px;bottom:40px;border-left:3px dashed rgba(237,239,243,.3)}
.pp .stop{position:relative;padding:0 0 40px}
.pp .stop .dot{position:absolute;left:-74px;top:-4px;width:62px;height:62px;border-radius:50%;background:var(--red-deep);border:3px solid #F2F3F6;display:flex;align-items:center;justify-content:center;transform:rotate(-4deg);font-family:'Anton';font-size:16px;color:#fff;box-shadow:0 10px 22px rgba(0,0,0,.45)}
.pp .stop:nth-child(2) .dot{transform:rotate(4deg)}
.pp .stop:nth-child(3) .dot{transform:rotate(-5deg);background:var(--red)}
.pp .stop .sl{font-family:'Bebas Neue';letter-spacing:.2em;font-size:12.5px;color:#8A909C}
.pp .stop h4{font-family:'Anton';font-size:23px;color:#EDEFF3;text-transform:uppercase;margin:3px 0 5px}
.pp .stop p{font-family:'Outfit';font-size:13.5px;color:#98A0AB;line-height:1.55;max-width:520px}
.pp .stop .nums{display:flex;gap:28px;margin-top:12px;flex-wrap:wrap}
.pp .stop .nums div{font-family:'Anton';font-size:32px;color:var(--red);filter:brightness(1.45)}
.pp .stop .nums small{display:block;font-family:'Bebas Neue';letter-spacing:.12em;font-size:11px;color:#8A909C;filter:none;margin-top:2px}
.pp .uni{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.pp .uc{font-family:'Bebas Neue';letter-spacing:.1em;font-size:13px;color:#C9CCD4;border:1.4px solid #3A404D;padding:8px 15px;border-radius:9px}
.pp .route .fin{position:absolute;left:18px;bottom:0;color:#EDEFF3;opacity:.7}
.pp .mknote{font-family:'Permanent Marker';color:var(--red);filter:brightness(1.5);font-size:clamp(17px,1.9vw,23px);transform:rotate(-2deg);display:inline-block;margin-top:8px}
/* nexus strip */
.pp .nstrip{display:flex;align-items:center;gap:18px;background:#0C0E11;border:1px solid #23262E;border-radius:16px;padding:22px 26px;margin-top:36px;flex-wrap:wrap;position:relative;z-index:2}
.pp .nxmask{width:46px;height:46px;background:var(--red);filter:brightness(1.25);-webkit-mask:url(/logos/nexus-x.png) center/contain no-repeat;mask:url(/logos/nexus-x.png) center/contain no-repeat}
.pp .nstrip .t{flex:1;min-width:240px}
.pp .nstrip .t b{font-family:'Outfit';font-weight:800;font-size:16px;color:#EDEFF3;display:block}
.pp .nstrip .t span{font-family:'Outfit';font-size:13px;color:#8A909C}
.pp .nstrip .nn{font-family:'Anton';font-size:38px;color:#E63946}
/* CTA */
.pp .cta-band{padding:96px 26px;text-align:center;position:relative;overflow:hidden;background:#0C0E11;border-bottom:0}
.pp .cta-band .gw{position:absolute;left:-2%;top:12%;font-family:'Anton';font-size:clamp(70px,10vw,150px);color:transparent;-webkit-text-stroke:1.4px rgba(237,239,243,.06);white-space:nowrap}
.pp .cta-band h2{font-family:'Anton';font-size:clamp(30px,4.4vw,56px);text-transform:uppercase;color:#EDEFF3;line-height:1.05;position:relative;z-index:2}
.pp .cta-band h2 em{font-style:normal;color:var(--red);filter:brightness(1.35)}
.pp .cta-band p{font-family:'Outfit';color:#B9BFC9;margin:16px 0 28px;font-size:15.5px;position:relative;z-index:2}
.pp .btn-xl{font-family:'Outfit';font-weight:800;font-size:16px;background:#E63946;color:#fff;border:0;border-radius:12px;padding:17px 34px;cursor:pointer;box-shadow:0 14px 34px rgba(230,57,70,.35);transition:transform .28s cubic-bezier(0.34,1.56,0.64,1);position:relative;z-index:2}
.pp .btn-xl:hover{transform:translateY(-3px)}
.pp .pfoot{font-family:'Outfit';font-size:12px;color:#5A616D;text-align:center;padding:26px;background:#0C0E11}
/* reveals */
.pp .rv{opacity:0;transition:opacity .55s ease}
.pp .rvy{opacity:0;transform:translateY(18px);transition:opacity .5s ease, transform .5s cubic-bezier(0.34,1.56,0.64,1)}
.pp .rv.in,.pp .rvy.in{opacity:1}.pp .rvy.in{transform:translateY(0)}
@media(prefers-reduced-motion:reduce){.pp .rv,.pp .rvy{opacity:1;transform:none;transition:none}}
/* ghost layer */
.pp .gm{position:absolute;pointer-events:none;background:var(--red);z-index:0}
.pp .gm-fleur{-webkit-mask:url(/logos/fleur-de-lys.png) center/contain no-repeat;mask:url(/logos/fleur-de-lys.png) center/contain no-repeat}
.pp .gm-maple{-webkit-mask:url(/logos/maple-leaf.png) center/contain no-repeat;mask:url(/logos/maple-leaf.png) center/contain no-repeat}
.pp .gm-nx{-webkit-mask:url(/logos/nexus-x.png) center/contain no-repeat;mask:url(/logos/nexus-x.png) center/contain no-repeat}
.pp .gwd{position:absolute;pointer-events:none;font-family:'Anton';text-transform:uppercase;color:transparent;-webkit-text-stroke:1.4px rgba(237,239,243,.06);white-space:nowrap;z-index:0;line-height:1}
.pp .gwi{position:absolute;pointer-events:none;font-family:'Playfair Display';font-style:italic;font-weight:700;color:rgba(237,239,243,.05);white-space:nowrap;z-index:0}
.pp .gmk{position:absolute;pointer-events:none;font-family:'Permanent Marker';color:rgba(237,239,243,.06);white-space:nowrap;z-index:0}
.pp .grseq{position:absolute;pointer-events:none;z-index:0;filter:grayscale(1) brightness(2.6);opacity:.045}
.pp .gchalk{position:absolute;pointer-events:none;color:#EDEFF3;opacity:.05;z-index:0}
.pp section > .sec-in{position:relative;z-index:2}
`;
