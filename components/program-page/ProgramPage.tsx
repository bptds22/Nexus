"use client";

// components/program-page/ProgramPage.tsx
//
// Niveau-1 page — 1:1 port of docs/reference/page-niveau1-web-v7.html (desktop).
// Assembles: Wall (committed, untouched) + Menu (mb2) + Ticker + 6 sections +
// CTA + ghost layer. FIXED Nexus shell (#111317 / #1A1D24 / #0C0E11); ONE école
// colour via the wall theme vars (--red + derived --red-deep; --cream = neutral).
// Platform moments stay #E63946 (strip counter, CTA). No color-mix.

import * as React from "react";
import { DNA_CSS, GrainOverlay } from "@/components/shared/dna";
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
import NewsSection from "./NewsSection";
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
    "--nx-red": "#E63946", // rouge Nexus — moments plateforme (Suivre / CTA)
    "--green": "#22C55E",
    // Rampe TEXTE de la coquille (préfixe --p-* : --ink/--char/--cream sont les
    // vars du THÈME ÉCOLE, pas du texte). 4 crans, aucun hex texte en dur.
    "--p-ink": "#EDEFF3",   // titres / texte primaire
    "--p-soft": "#C9CCD4",  // paragraphes, lead, descriptions
    "--p-mut": "#8A909C",   // labels, kickers, méta
    "--p-faint": "#5A616D", // crédit pied de page
    "--p-inv": "#15171B",   // texte sur surface claire (row crème)
    // Contrat ADN partagé (shared/dna) — ici la marque = la couleur école.
    "--dna-mark": theme.red,
    "--dna-ink": "#EDEFF3",
  } as React.CSSProperties;

  // S1 follow + CTA share ONE targets state — single source of truth. Toggling
  // either reflects the other (no second state, no second backend). Mock this
  // ticket; persistence + notif = Bloc 2 (athlete_targets table).
  const [inTargets, setInTargets] = React.useState(false);
  const toggleTargets = React.useCallback(() => setInTargets((v) => !v), []);

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
    <div className="pp nx-dna" ref={ref} style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: DNA_CSS + PP_CSS }} />

      <div className="frame">
        <ProgramWall school={school} />
        <ProgramWallMenu school={school} />
      </div>

      <Ticker words={content.ticker} />

      <div className="pagewrap">
        <GrainOverlay />

        <StatRows schoolName={school.schoolName} city={school.city} stats={content.stats} inTargets={inTargets} onToggleTargets={toggleTargets} />
        <SportsGrid sports={content.sports} />
        <CampusSection content={content} />
        <AboutSell title={content.sellTitle} sellText={content.sellText} />
        <AcademicPlanche programs={content.programsList} viewerProgrammeVise={content.viewerProgrammeVise} schoolName={school.schoolName} />
        <ParcoursRoute
          schoolName={school.schoolName}
          initials={school.initials}
          slogan={school.slogan}
          route={content.route}
          universities={content.universities}
          nexusStripText={content.nexusStripText}
          nexusRecruitedCount={content.nexusRecruitedCount}
        />
        <NewsSection news={content.news} />
        <CtaCibles ctaTitle={content.ctaTitle} notifyName={content.ctaNotifyName} inTargets={inTargets} onToggleTargets={toggleTargets} />
        <div className="pfoot">⚡ Propulsé par Nexus · données de démonstration</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------ scoped page CSS (1:1) ----- */
const PP_CSS = `
.pp{background:#111317;color:var(--p-ink);font-family:'Barlow Condensed',sans-serif;scroll-margin-top:60px}
.pp .frame{max-width:1500px;margin:0 auto}
/* menu v2 lives in ProgramWallMenu (.mb2) */
/* ticker */
.pp .ticker{overflow:hidden;background:#0C0E11;border-bottom:1px solid #1E2129}
.pp .ticker-in{display:flex;align-items:center;width:max-content;animation:pptick 26s linear infinite;padding:10px 0}
.pp .ticker span{font-family:'Bebas Neue';letter-spacing:.22em;font-size:14px;white-space:nowrap;padding:0 18px;color:var(--p-soft)}
.pp .ticker span.g{color:var(--red);filter:brightness(1.45)}
.pp .ticker i{color:#3A404D;font-style:normal}
@keyframes pptick{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.pp .ticker-in{animation:none}}
/* sections */
.pp .pagewrap{max-width:1500px;margin:0 auto;position:relative}
.pp section{position:relative;z-index:2;padding:72px 26px 64px;border-bottom:1px solid #1E2129;overflow:hidden}
.pp .sec-in{max-width:1180px;margin:0 auto;position:relative}
.pp .kick{font-family:'Bebas Neue';letter-spacing:.34em;font-size:14px;color:var(--red);filter:brightness(1.5)}
.pp .sec-h{font-family:'Anton';font-size:clamp(30px,3.6vw,46px);text-transform:uppercase;color:var(--p-ink);margin:6px 0 4px;line-height:1.02}
.pp .sec-h em{font-style:normal;color:var(--red);filter:brightness(1.3)}
.pp .lead{font-family:'Outfit';font-size:16px;line-height:1.65;color:var(--p-soft);max-width:640px}
.pp .spine{position:absolute;pointer-events:none;color:var(--p-ink);opacity:.05}
/* S1 */
.pp .bigid .l1x{font-family:'Anton';font-size:clamp(26px,2.6vw,36px);color:var(--red);filter:brightness(1.3);text-transform:uppercase;line-height:1}
.pp .bigid .l2x{font-family:'Anton';font-size:clamp(44px,5.4vw,76px);color:var(--p-ink);text-transform:uppercase;line-height:1;margin-top:2px}
.pp .tstack{margin:30px -26px 0;position:relative;z-index:2}
.pp .trow{display:flex;align-items:baseline;gap:22px;padding:26px 8%;line-height:1}
.pp .trow .big{font-family:'Anton';font-size:clamp(46px,5.6vw,78px)}
.pp .trow .lab{font-family:'Bebas Neue';letter-spacing:.18em;font-size:clamp(14px,1.4vw,19px);opacity:.85}
.pp .tr-ink{background:#191414;color:var(--p-ink)}
.pp .tr-red{background:var(--red);color:#fff}
.pp .tr-cream{background:#EFF1F4;color:var(--p-inv)}
.pp .tr-cream .big{color:var(--red)}
/* S1 — Suivre (→ mes cibles) + preuve sociale : moment plateforme = rouge Nexus */
.pp .hd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap}
.pp .hfollow{display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:230px}
.pp .hf-stats{display:flex;gap:8px}
.pp .hf-chip{display:inline-flex;align-items:center;gap:7px;background:#1A1D24;border:1.5px solid #262A33;border-radius:11px;padding:9px 13px;font-family:'Outfit';font-weight:700;font-size:14px;color:var(--p-ink)}
.pp .hf-chip .ic{font-size:14px;line-height:1}
.pp .hf-chip .ic.eye{color:var(--p-mut)}
.pp .hf-chip .ic.heart{color:var(--nx-red)}
.pp .hf-chip .u{font-family:'Outfit';font-weight:500;font-size:12px;color:var(--p-mut);margin-left:1px}
.pp .hf-btn{display:inline-flex;align-items:center;gap:9px;font-family:'Outfit';font-weight:700;font-size:15px;background:var(--nx-red);color:#fff;border:0;border-radius:12px;padding:13px 22px;cursor:pointer;transition:transform .28s var(--pop),background .2s;box-shadow:0 6px 20px -8px rgba(230,57,70,.7);white-space:nowrap}
.pp .hf-btn:hover{transform:translateY(-2px)}
.pp .hf-btn.on{background:#14161C;color:var(--p-ink);border:1.5px solid #2A2F3A;box-shadow:none}
.pp .hf-btn.on .p{color:var(--green)}
.pp .hf-note{font-family:'Outfit';font-weight:600;font-size:14.5px;color:var(--p-mut);text-align:right;max-width:230px}
.pp .hf-note b{color:var(--p-soft)}
.pp .man{display:inline-block;font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.12em;color:var(--p-mut);border:1px dashed #3a3f49;border-radius:6px;padding:2px 7px;margin-left:14px;vertical-align:middle;text-transform:uppercase}
.pp .tr-red .man{color:#fff;border-color:rgba(255,255,255,.5)}
/* S2 — L'affiche (liste éditoriale, aucune icône) */
.pp .pill{font-family:'Outfit';font-weight:700;font-size:12px;letter-spacing:.04em;padding:4px 10px;border-radius:99px;display:inline-flex;align-items:center;white-space:nowrap}
.pp .pill.div1{background:var(--red);color:#fff}
.pp .pill.div{background:transparent;color:var(--p-soft);border:1.5px solid #333844}
.pp .pill.gen{background:#1D212A;color:var(--p-mut)}
.pp .pill.cnt{background:#12151C;color:var(--p-ink);border:1px solid #262A33}
.pp .aList{display:flex;flex-direction:column;border-top:1px solid #1E2129;margin-top:24px}
.pp .aRow{border-bottom:1px solid #1E2129;padding:18px 4px;transition:background .2s}
.pp .aRow.multi{cursor:pointer}
.pp .aRow.multi:hover{background:#14171D}
.pp .aTop{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.pp .aName{font-family:'Anton';font-size:clamp(22px,2.4vw,32px);text-transform:uppercase;line-height:1;min-width:220px}
.pp .aPills{display:flex;gap:7px;flex-wrap:wrap;flex:1}
.pp .aChev{font-size:20px;color:var(--p-faint);transition:transform .25s}
.pp .aRow.open .aChev{transform:rotate(90deg);color:var(--red);filter:brightness(1.4)}
.pp .aRow.single{cursor:pointer}
.pp .aRow.single:hover{background:#14171D}
.pp .aRow.single .aChev{color:var(--red);filter:brightness(1.4)}
.pp .teams{display:none;gap:8px;flex-wrap:wrap;margin-top:14px}
.pp .teams.open{display:flex}
.pp .tchip{display:inline-flex;align-items:center;gap:9px;background:#12151C;border:1.5px solid #262A33;border-radius:11px;padding:9px 13px;font-family:'Outfit';font-weight:600;font-size:14.5px;color:var(--p-ink);cursor:pointer;transition:border-color .2s,transform .2s var(--pop)}
.pp .tchip:hover{border-color:var(--red);transform:translateY(-2px)}
.pp .tchip .ar{color:var(--red);filter:brightness(1.5)}
/* font-size EXPLICITE : <small> hérite sinon du UA (font-size:smaller = 80% du
   parent) et retombe sous le plancher de 12px quand .tchip grossit. */
.pp .tchip small{font-family:'Outfit';font-weight:500;font-size:12px;color:var(--p-mut)}
/* S3 */
.pp .sell{font-family:'Outfit';font-size:clamp(17px,1.7vw,21px);line-height:1.7;color:var(--p-soft);max-width:820px;margin-top:22px}
.pp .sell b{color:#fff}
.pp .sell .hl{color:var(--red);filter:brightness(1.4);font-weight:700}
/* Campus (v8.3) — fiche (3 tiles) + full-width map + carousel */
.pp .fiche{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:28px}
.pp .itile{background:#1A1D24;border:1.5px solid #262A33;border-radius:14px;padding:18px 20px}
.pp .itile .il{font-family:'Bebas Neue';letter-spacing:.22em;font-size:14px;color:var(--p-mut)}
.pp .itile .iv{font-family:'Anton';font-size:clamp(20px,1.9vw,26px);color:var(--p-ink);margin-top:5px;text-transform:uppercase}
.pp .itile.hot{background:var(--red);border-color:transparent}
.pp .itile.hot .il{color:rgba(255,255,255,.75)}
.pp .itile.hot .iv{color:#fff}
/* map — pleine largeur, moins zoomée (z=12), sans mappin */
.pp .mapwrap{position:relative;margin-top:20px;border-radius:16px;overflow:hidden;border:1.5px solid #262A33;height:380px;background:#14161C}
.pp .mapwrap iframe{position:absolute;inset:0;width:100%;height:100%;border:0;filter:grayscale(.2) contrast(1.02)}
/* carousel campus (scroll-snap) */
.pp .cara-head{display:flex;justify-content:space-between;align-items:flex-end;margin:34px 0 14px}
.pp .cara-kick{font-family:'Bebas Neue';letter-spacing:.24em;font-size:14px;color:var(--p-mut)}
.pp .cara-nav{display:flex;gap:8px}
.pp .cara-nav button{width:40px;height:40px;border-radius:50%;background:#1A1D24;border:1.5px solid #2A2F3A;color:var(--p-ink);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .2s var(--pop),border-color .2s}
.pp .cara-nav button:hover{transform:translateY(-2px);border-color:var(--nx-red)}
.pp .cara{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding-bottom:6px;scrollbar-width:none}
.pp .cara::-webkit-scrollbar{display:none}
.pp .ccard{flex:0 0 300px;scroll-snap-align:start;height:380px;border-radius:16px;position:relative;overflow:hidden;border:1.5px solid #262A33;cursor:pointer;transition:transform .3s var(--pop),box-shadow .3s}
.pp .ccard:hover{transform:translateY(-4px);box-shadow:0 18px 40px -20px rgba(230,57,70,.55)}
.pp .ccard .ph{position:absolute;inset:0;background:linear-gradient(150deg,#232a34,#151820 70%)}
.pp .ccard .cimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.pp .ccard .grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,11,14,.92) 8%,rgba(10,11,14,.15) 55%,transparent)}
.pp .cc-t{position:absolute;left:18px;right:18px;bottom:16px;font-family:'Anton';font-size:22px;line-height:1.05;color:#fff;text-transform:uppercase;z-index:2}
.pp .cc-cap{position:absolute;left:18px;right:18px;bottom:16px;transform:translateY(0);z-index:2}
.pp .cc-cap .t{font-family:'Anton';font-size:22px;line-height:1.05;color:#fff;text-transform:uppercase;display:block}
.pp .cc-cap .c{font-family:'Outfit';font-weight:500;font-size:14.5px;color:var(--p-soft);margin-top:6px;display:block}
.pp .cc-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2}
.pp .cc-play span{width:52px;height:52px;border-radius:50%;background:rgba(230,57,70,.92);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;padding-left:3px}
/* S5 */
.pp .planche{margin-top:30px;background:#161A21;border:1.6px dashed rgba(237,239,243,.28);border-radius:18px;padding:30px;position:relative;overflow:hidden}
/* placement seul — apparence (couleur/opacité) portée par l'ADN partagé */
.pp .planche svg.xo{right:6px;top:10px;width:180px}
/* perfect match — remplace .vedette + .prim */
.pp .match-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.pp .mh-kick{font-family:'Bebas Neue';letter-spacing:.22em;font-size:14px;color:var(--p-mut)}
.pp .mh-prog{font-family:'Anton';font-size:clamp(20px,2vw,26px);color:var(--p-ink);text-transform:uppercase}
.pp .mh-tag{font-family:'Outfit';font-weight:600;font-size:12px;letter-spacing:.1em;color:var(--p-mut);border:1px dashed #3a3f49;border-radius:6px;padding:3px 8px;text-transform:uppercase}
.pp .matches{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.pp .mcard{background:#12151C;border:1.5px solid #232833;border-radius:14px;padding:18px 20px;position:relative}
.pp .mcard.exact{border-color:var(--green);box-shadow:0 0 0 1px var(--green) inset, 0 14px 34px -22px rgba(34,197,94,.5)}
.pp .mbadge{display:inline-flex;align-items:center;gap:6px;font-family:'Outfit';font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:99px;margin-bottom:12px}
.pp .mbadge.exact{background:var(--green);color:#07130B}
.pp .mbadge.sim{background:#1D212A;color:var(--p-mut);border:1px solid #2A2F3A}
.pp .mcard b{font-family:'Outfit';font-weight:700;font-size:16px;color:var(--p-ink);display:block}
.pp .mcard span.d{font-family:'Outfit';font-size:14.5px;color:var(--p-soft);line-height:1.5;display:block;margin-top:5px}
.pp .match-empty{background:#12151C;border:1.5px dashed #2A2F3A;border-radius:14px;padding:22px 24px}
.pp .match-empty p{font-family:'Outfit';font-size:14.5px;color:var(--p-soft);line-height:1.55;max-width:640px}
.pp .match-empty p b{color:var(--p-ink)}
.pp .me-cta{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-family:'Outfit';font-weight:700;font-size:14px;background:var(--nx-red);color:#fff;border:0;border-radius:10px;padding:11px 18px;cursor:pointer}
.pp .chalkline{border:0;border-top:1.4px dashed rgba(241,235,221,.2);margin:24px 0 18px}
.pp .pl-t{font-family:'Bebas Neue';letter-spacing:.22em;font-size:14px;color:var(--p-mut);margin-bottom:12px}
.pp .progs{display:flex;gap:9px;flex-wrap:wrap}
.pp .prog{font-family:'Outfit';font-weight:600;font-size:14.5px;color:var(--p-soft);background:#1D212A;padding:9px 14px;border-radius:99px}
.pp .prog i{font-style:normal;color:var(--red);filter:brightness(1.4);margin-right:6px}
.pp .psearch{width:100%;max-width:440px;display:block;margin:0 0 14px;background:#1D212A;border:1.5px solid #2A2F3A;border-radius:11px;padding:12px 16px;font-family:'Outfit';font-weight:600;font-size:14.5px;color:var(--p-ink);outline:none}
.pp .psearch:focus{border-color:var(--red)}
.pp .psearch::placeholder{color:var(--p-mut)}
/* S6 */
.pp .route{position:relative;margin-top:34px;padding-left:74px;max-width:760px}
.pp .route::before{content:"";position:absolute;left:31px;top:10px;bottom:40px;border-left:3px dashed rgba(237,239,243,.3)}
.pp .stop{position:relative;padding:0 0 40px}
.pp .stop .dot{position:absolute;left:-74px;top:-4px;width:62px;height:62px;border-radius:50%;background:var(--red-deep);border:3px solid #F2F3F6;display:flex;align-items:center;justify-content:center;transform:rotate(-4deg);font-family:'Anton';font-size:16px;color:#fff;box-shadow:0 10px 22px rgba(0,0,0,.45)}
.pp .stop:nth-child(2) .dot{transform:rotate(4deg)}
.pp .stop:nth-child(3) .dot{transform:rotate(-5deg);background:var(--red)}
.pp .stop .sl{font-family:'Bebas Neue';letter-spacing:.2em;font-size:14px;color:var(--p-mut)}
.pp .stop h4{font-family:'Anton';font-size:23px;color:var(--p-ink);text-transform:uppercase;margin:3px 0 5px}
.pp .stop p{font-family:'Outfit';font-size:14.5px;color:var(--p-soft);line-height:1.55;max-width:520px}
.pp .stop .nums{display:flex;gap:28px;margin-top:12px;flex-wrap:wrap}
.pp .stop .nums div{font-family:'Anton';font-size:32px;color:var(--red);filter:brightness(1.45)}
.pp .stop .nums small{display:block;font-family:'Bebas Neue';letter-spacing:.12em;font-size:14px;color:var(--p-mut);filter:none;margin-top:2px}
.pp .uni{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.pp .uc{font-family:'Bebas Neue';letter-spacing:.1em;font-size:14px;color:var(--p-soft);border:1.4px solid #3A404D;padding:8px 15px;border-radius:9px}
.pp .route .fin{position:absolute;left:18px;bottom:0;color:var(--p-ink);opacity:.7}
.pp .mknote{font-family:'Permanent Marker';color:var(--red);filter:brightness(1.5);font-size:clamp(17px,1.9vw,23px);transform:rotate(-2deg);display:inline-block;margin-top:8px}
/* nexus strip */
.pp .nstrip{display:flex;align-items:center;gap:18px;background:#0C0E11;border:1px solid #23262E;border-radius:16px;padding:22px 26px;margin-top:36px;flex-wrap:wrap;position:relative;z-index:2}
.pp .nstrip .nxmask{flex:0 0 auto}
.pp .nstrip .t{flex:1;min-width:240px}
.pp .nstrip .t b{font-family:'Outfit';font-weight:800;font-size:16px;color:var(--p-ink);display:block}
.pp .nstrip .t span{font-family:'Outfit';font-size:14.5px;color:var(--p-soft)}
.pp .nstrip .nn{font-family:'Anton';font-size:38px;color:var(--red)}
/* News */
.pp .news-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:28px}
.pp .ncard{background:#1A1D24;border:1.5px solid #262A33;border-radius:14px;padding:22px 22px 20px;display:flex;flex-direction:column;gap:10px}
.pp .n-src{font-family:'Bebas Neue';letter-spacing:.18em;font-size:14px;color:var(--p-mut)}
.pp .n-title{font-family:'Anton';font-size:20px;line-height:1.1;color:var(--p-ink);text-transform:uppercase}
.pp .n-link{margin-top:auto;display:inline-flex;align-items:center;gap:7px;font-family:'Outfit';font-weight:700;font-size:14px;color:var(--p-ink);text-decoration:none;border:1.5px solid #2A2F3A;border-radius:10px;padding:10px 16px;align-self:flex-start;transition:border-color .2s,transform .2s var(--pop)}
.pp .n-link:hover{border-color:var(--red);transform:translateY(-2px)}
.pp .n-link .ar{color:var(--red);filter:brightness(1.5)}
/* CTA */
/* Fond CONTINU : pas de background propre. La bande vit DANS .pagewrap
   (max-width:1500px) — un aplat ici se découpe en panneau visible dès que la
   fenêtre dépasse 1500px (bords gauche/droite = le fond de page qui dépasse).
   Toutes les autres sections sont transparentes ; la bande le devient aussi.
   (Le .ticker garde son #0C0E11 : lui est rendu HORS pagewrap, donc full-bleed
   et sans bords.) */
.pp .cta-band{padding:96px 26px;text-align:center;position:relative;overflow:hidden;border-bottom:0}
.pp .cta-band h2{font-family:'Anton';font-size:clamp(30px,4.4vw,56px);text-transform:uppercase;color:var(--p-ink);line-height:1.05;position:relative;z-index:2}
.pp .cta-band h2 em{font-style:normal;color:var(--red);filter:brightness(1.35)}
.pp .cta-band p{font-family:'Outfit';color:var(--p-soft);margin:16px 0 28px;font-size:16px;position:relative;z-index:2}
.pp .btn-xl{font-family:'Outfit';font-weight:800;font-size:16px;background:var(--nx-red);color:#fff;border:0;border-radius:12px;padding:17px 34px;cursor:pointer;box-shadow:0 14px 34px rgba(230,57,70,.35);transition:transform .28s cubic-bezier(0.34,1.56,0.64,1);position:relative;z-index:2}
.pp .btn-xl:hover{transform:translateY(-3px)}
/* Même raison que .cta-band : dans .pagewrap → un aplat ferait une 2e boîte
   foncée juste sous la bande. Fond continu. */
.pp .pfoot{font-family:'Outfit';font-size:14.5px;color:var(--p-faint);text-align:center;padding:26px}
/* reveals */
.pp .rv{opacity:0;transition:opacity .55s ease}
.pp .rvy{opacity:0;transform:translateY(18px);transition:opacity .5s ease, transform .5s cubic-bezier(0.34,1.56,0.64,1)}
.pp .rv.in,.pp .rvy.in{opacity:1}.pp .rvy.in{transform:translateY(0)}
@media(prefers-reduced-motion:reduce){.pp .rv,.pp .rvy{opacity:1;transform:none;transition:none}}
/* ghost layer / playbook / marque / grain / damier → ADN PARTAGÉ (shared/dna) */
.pp section > .sec-in{position:relative;z-index:2}
`;
