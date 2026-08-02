"use client";

// components/program-page/ProgramWallMobile.tsx
//
// LE MUR — rendu NATIF (bundle Capacitor), grille PORTRAIT 5 colonnes × 8
// rangées, plus la SURCOUCHE de collage portée du mur web.
//
// Le mur WEB (components/program-wall/ProgramWall.tsx) reste la RÉFÉRENCE et
// n'est pas touché. Ce mur-ci en reprend :
//   • les 9 dégradés de motif (p-check, p-check-ink, p-dots-red, p-dots-cream,
//     p-diag, p-diag-wide, p-grid, p-chev), à l'échelle cqw du portrait ;
//   • la profondeur (ombre interne de tuile, .raise / .sunk / .grunge) ;
//   • la surcouche : mots-clés, filets, banderole, semis fleur/érable en
//     masque, médaillons, flottant, carte slogan, hero, name-card, under-card,
//     vignette, scrim, grain.
// Seul le PLACEMENT diverge : les % du web sont calibrés sur 21/9 et ne
// transposent pas en 9/13 — ils sont recoordonnés ici. Les VALEURS viennent du
// même resolveWall() : aucun contenu ne diverge entre web et mobile.
//
// ZÉRO invention : chaque mot variable vient de resolveWall() (initiales, mot du
// rail, ville, regionTag, code régional, devise, flèche, mots personnalisés,
// slogan, surnom, mascotte). Un slot sans donnée n'est pas rendu.

import * as React from "react";
import { resolveWall, type SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { WallTheme } from "@/components/program-wall/theme";

/** Ajustement de corps pour un mot variable : plafond `cap` (la valeur du mock),
 *  puis rétrécissement proportionnel à la longueur pour qu'un nom long ne déborde
 *  pas de sa tuile. Même principe que railFont/cityFont de slots.ts. */
const fit = (cap: number, span: number, len: number): string =>
  `${Math.min(cap, span / Math.max(1, len)).toFixed(2)}cqw`;

/* ── Glyphes de décor ──────────────────────────────────────────────────────
   La fleur de lys, l'érable et les logos viennent de public/logos/ (assets figés
   depuis f7cc2a5). Seuls l'étoile et le trophée restent dessinés : aucun PNG ne
   les porte, et le mur web les dessine aussi en <path>. ── */

function Etoile({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}

/** Trophée — <path> repris VERBATIM du flottant du mur web (ProgramWall.tsx,
 *  premier .float). Même dessin, même rotation. */
function Trophee() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M6 3h12v2h2.5A1.5 1.5 0 0 1 22 6.5c0 2.7-1.9 4.9-4.4 5.4A6 6 0 0 1 13 15.9V18h3v2H8v-2h3v-2.1a6 6 0 0 1-4.6-4C3.9 11.4 2 9.2 2 6.5A1.5 1.5 0 0 1 3.5 5H6V3Z" />
    </svg>
  );
}

export interface ProgramWallMobileProps {
  school: SchoolProgramIdentity;
  theme: WallTheme;
  /** Division affichée dans le médaillon. AUTO (table teams) — absente → le
   *  médaillon n'est pas rendu (jamais une division inventée). */
  division?: string | null;
}

export default function ProgramWallMobile({ school, theme, division }: ProgramWallMobileProps) {
  const w = resolveWall(school, theme);

  // « Québec » n'est écrit en toutes lettres que pour le Québec ; toute autre
  // province garde son code, jamais un nom deviné.
  const provinceMot = school.province.toUpperCase() === "QC" ? "Québec" : school.province.toUpperCase();
  const gra = w.railWord.toUpperCase();
  const mascotte = w.nameCard;

  return (
    <div className="pw7">
      <div className="mosaic">
        {/* ══ RANGÉE 1 — NEXUS · ligue · province · damier (ordre imposé) ══ */}
        <div className="t nex raise">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/nexus-wordmark-white.png" alt="NEXUS" />
        </div>
        <div className="t rse">
          {/* USPORTS : slots.ts pointe /logos/usports.png, qui N'EXISTE PAS dans
              public/logos/. On ne fabrique pas l'image — repli sur le sigle en
              toutes lettres, et dette signalée. RSEQ, lui, a son PNG.
              Seule tuile claire laissée en aplat PUR : une marque de ligue se
              pose sur du blanc propre, jamais sur un motif. */}
          {school.league === "RSEQ" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.leagueLogo} alt="RSEQ" />
          ) : (
            <b className="lg-alt">{school.league}</b>
          )}
        </div>
        <div className="t que p-dots-cream">
          <b style={{ fontSize: fit(4.2, 27, provinceMot.length) }}>{provinceMot}</b>
        </div>
        <div className="t dam p-check-ink sunk" />

        {/* ══ RANGÉE 2 — CANADA · playbook · grande fleur ══ */}
        <div className="t cnd p-chev raise">
          <b>CANADA</b>
        </div>
        <div className="t pbk">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden focusable="false">
            <g stroke="var(--cream)" strokeWidth=".8" fill="none" opacity=".8">
              <path d="M6 8l6 6M12 8l-6 6" strokeWidth="1.2" />
              <circle cx="26" cy="12" r="3.4" />
              <circle cx="38" cy="12" r="3.4" />
              <circle cx="50" cy="12" r="3.4" />
              <path d="M22 24c10-8 24-8 36 0" strokeDasharray="3 2.4" />
              <path d="M70 30l7-7M77 30l-7-7" strokeWidth="1.2" />
            </g>
          </svg>
        </div>
        <div className="t fdb p-diag-wide">
          <span className="lys" />
        </div>

        {/* ══ RANGÉE 3 — damier · ALLEZ · étoile ══ */}
        <div className="t dmr p-check sunk" />
        <div className="t alz grunge">
          <b style={{ fontSize: fit(4, 22, w.allezWord.length) }}>{w.allezWord.toUpperCase()}</b>
        </div>
        <div className="t stx">
          <Etoile />
        </div>

        {/* ══ RANGÉE 4 — ÉLITE · foam finger · initiales ══ */}
        <div className="t eli grunge">
          <b style={{ fontSize: fit(4, 22, w.eliteWord.length) }}>{w.eliteWord.toUpperCase()}</b>
        </div>
        <div className="t ffg">
          {/* Reteinté par theme.foamFilter — hue-rotate + saturate + brightness,
              dérivés de la primaire. Le terme de luminosité est indispensable :
              hue-rotate seul laissait un doigt brun aux écoles à primaire claire
              (le PNG source est un rouge sombre). Mécanisme identique au web. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/foam-red.png" alt="" style={{ filter: theme.foamFilter }} />
        </div>
        <div className="t ag p-grid raise">
          <b style={{ fontSize: fit(15, 30, w.initials.length) }}>{w.initials}</b>
        </div>

        {/* ══ RANGÉES 5-7 — bloc VILLE · pois · semis · diagonales ══ */}
        {/* Bloc ville = le b-kraft du web : mots-clés, filets, banderole, code
            régional, devise à la verticale, fleur en masque, devise-flèche. */}
        <div className="t mtl raise">
          <div className="kick">— ICI C&apos;EST —</div>
          <div className="rail" style={{ fontSize: fit(9.4, 40, w.cityUpper.length) }}>
            {w.cityUpper}
          </div>
          <div className="k-rule" />
          {w.regionTag ? <div className="k-bnr">{w.regionTag}</div> : null}
          {w.areaCode ? (
            <div className="area" style={{ fontSize: fit(11, 40, w.areaCode.length) }}>
              {w.areaCode}
            </div>
          ) : null}
          <div className="dev">{w.devise}</div>
          <span className="fly lys" />
          <div className="arw">{w.arrowPhrase}</div>
          <div className="k-rule-b" />
        </div>
        <div className="t rdt p-dots-red sunk" />
        {/* Semis fleur + érable, rotations reprises du b-fleur du web. */}
        <div className="t fdl">
          <span className="mk mask-fleur" style={{ left: "8%", top: "7%", width: "34%", transform: "rotate(-8deg)" }} />
          <span className="mk mask-maple" style={{ right: "7%", top: "12%", width: "24%", transform: "rotate(14deg)" }} />
          <span className="mk mask-maple" style={{ right: "9%", top: "46%", width: "44%", transform: "rotate(6deg)" }} />
          <span className="mk mask-maple" style={{ left: "10%", bottom: "6%", width: "27%", transform: "rotate(-12deg)" }} />
          <span className="mk mask-fleur" style={{ left: "46%", bottom: "9%", width: "20%", transform: "rotate(9deg)" }} />
        </div>
        <div className="t str p-diag sunk" />

        {/* ══ RANGÉE 8 — fermeture : le mot du rail ══ */}
        <div className="t gra grunge">
          <b style={{ fontSize: fit(16, 112, gra.length) }}>{gra}</b>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SURCOUCHE — c'est elle qui fait l'AFFICHE plutôt que le damier.
            Portée du mur web ; les coordonnées sont recalculées pour le 9/13
            (le web est calibré sur 21/9 et ne transpose pas).
            ═══════════════════════════════════════════════════════════════ */}
        <div className="vign" />
        <div className="scrim" />
        <svg className="grain" aria-hidden focusable="false">
          <filter id="pwm-noise">
            <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pwm-noise)" />
        </svg>

        {/* Médaillons — le D1 n'existe que si la table teams porte une division. */}
        {/* Les deux médaillons se posent sur des tuiles SANS texte — le damier
            ink de la rangée 1 et l'angle haut-gauche du hero. Toute la colonne
            de gauche (bloc ville) reste dégagée : c'est la seule tuile dense en
            texte du mur, elle ne se laisse pas recouvrir. */}
        {division ? (
          <div className="roundwrap" style={{ left: "38%", top: "48%" }}>
            <div className="roundel">
              <div className="d1">{division}</div>
              <div className="rs">DIVISION</div>
            </div>
          </div>
        ) : null}
        <div className="roundwrap" style={{ left: "82%", top: "3%" }}>
          <div className="roundel" style={{ transform: "rotate(8deg)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="xic" src="/logos/nexus-x.png" alt="" />
          </div>
        </div>

        {/* Flottant — trophée. Le SECOND flottant du web est le foam finger ;
            en portrait il reste une TUILE (ffg) : l'en sortir viderait une
            cellule de la grille, qui n'a pas de tuile de remplacement. */}
        <div className="float" style={{ left: "11%", top: "31%", width: "9cqw" }}>
          <Trophee />
        </div>

        {w.sloganLines ? (
          <div className="slogan-card">
            {w.sloganLines.map((l, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <br /> : null}
                {l}
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {w.nickname ? <div className="under-card">{w.nickname}</div> : null}

        {/* HERO — carte logo + name-card, comme le web. Sans logo, le repli
            reste l'écusson dessiné (le web replie sur le monogramme, mais les
            initiales occupent DÉJÀ une tuile ici : on ne les doublerait pas). */}
        <div className="hero">
          <div className="logo-card">
            {w.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.logoUrl!} alt="" />
            ) : (
              <svg viewBox="0 0 120 132" aria-hidden focusable="false">
                <path
                  d="M60 4 114 22v52c0 26-24 43-54 54C30 117 6 100 6 74V22z"
                  fill="var(--cream)"
                  stroke="var(--red)"
                  strokeWidth="7"
                />
                <path
                  d="M44 92c-6-14-3-30 8-40-2 9 1 16 7 21-4-12 0-24 10-31-3 12 2 20 10 27 7 6 10 14 8 23-2-8-7-13-14-16 5 8 5 16 0 23-3-9-9-14-17-16 4 7 4 14-1 20-4-4-7-8-11-11z"
                  fill="var(--red)"
                />
                <path d="M40 60c-6-3-10-8-11-14 7 2 13 1 18-3-3 7-4 12-7 17z" fill="var(--red)" />
              </svg>
            )}
          </div>
          {mascotte ? (
            <div className="name-card" style={{ fontSize: fit(5.2, 46, mascotte.length) }}>
              {mascotte}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS du mur — portrait 5 × 8 (unités cqw sur un conteneur
   `container-type:inline-size`). Injecté par ProgramPageMobile.
   ────────────────────────────────────────────────────────────────────────── */
export const WALL_CSS = `
.ppm .pw7 .mosaic{
  container-type:inline-size; aspect-ratio:9/13; background:var(--ink);
  display:grid; grid-template-columns:repeat(5,20%); grid-template-rows:repeat(8,12.5%); gap:0;
  position:relative; overflow:hidden;
  /* AGENCEMENT — vérifié par calcul de voisinage, pas à l'oeil : aucune tuile
     claire n'en touche une autre sur plus d'un côté. Les trois seuls contacts
     clair-clair sont rse-que (imposé par l'ordre NEXUS · RSEQ · QUÉBEC ·
     damier de la première rangée), cnd-dmr et ag-fdb. Le bloc massif de six
     tuiles blanches contiguës (rse que mtl ag cnd fdb) est rompu.
     Contraintes tenues : rangée 1 = NEXUS · ligue · province · damier ;
     rangée 8 = mot du rail (fermeture) ; 18 tuiles, 40 cellules, chaque tuile
     garde EXACTEMENT sa forme d'origine — donc aucun réglage cqw à refaire. */
  grid-template-areas:
    "nex nex rse que dam"
    "cnd cnd pbk pbk fdb"
    "dmr dmr alz stx fdb"
    "eli ffg ag  ag  ag "
    "mtl mtl rdt fdl fdl"
    "mtl mtl rdt fdl fdl"
    "mtl mtl rdt str str"
    "gra gra gra gra gra";
}
/* Ombre interne de tuile — portée du web (.blk). C'est elle qui donne le
   « papier découpé » : sans arête, la mosaïque lit comme un aplat continu. */
.ppm .pw7 .t{position:relative;overflow:hidden;display:grid;place-items:center;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05)}
/* Les grid items portent z-index sans position:static à corriger — le contenu
   passe donc AU-DESSUS des ::before de motif. */
.ppm .pw7 .t > *{z-index:1}
.ppm .pw7 .raise{z-index:8;
  box-shadow:0 .5cqw 1.3cqw rgba(0,0,0,.72), inset 0 0 0 1px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.07)}
.ppm .pw7 .sunk{box-shadow:inset 0 .4cqw 1cqw rgba(0,0,0,.7), inset 0 0 0 1px rgba(0,0,0,.4);filter:brightness(.88)}
.ppm .pw7 .grunge::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;z-index:2;
  background-image:radial-gradient(rgba(0,0,0,.5) 1.2px,transparent 1.8px),radial-gradient(rgba(255,255,255,.26) 1.1px,transparent 1.7px),radial-gradient(rgba(0,0,0,.35) 2px,transparent 2.6px);
  background-size:1.6cqw 1.6cqw,2.8cqw 2.2cqw,6.2cqw 5.4cqw;background-position:0 0,1.1cqw .7cqw,2.4cqw 1.6cqw}

/* ── MOTIFS portés du mur web, à l'échelle du portrait (tuile = 20cqw ici
   contre 10cqw sur le web : toutes les trames sont doublées). ── */
.ppm .pw7 .p-check{background:repeating-conic-gradient(var(--red) 0 25%,var(--cream) 0 50%) 0 0/5.2cqw 5.2cqw}
.ppm .pw7 .p-check-ink{background:repeating-conic-gradient(var(--ink) 0 25%,var(--red) 0 50%) 0 0/4cqw 4cqw}
.ppm .pw7 .p-dots-red{background:var(--red) radial-gradient(rgba(25,20,20,.55) 18%,transparent 20%) 0 0/2.4cqw 2.4cqw}
.ppm .pw7 .p-dots-cream{background:var(--cream) radial-gradient(var(--red) 15%,transparent 17%) 0 0/3.2cqw 3.2cqw}
.ppm .pw7 .p-diag{background:repeating-linear-gradient(-45deg,var(--cream) 0 1.8cqw,var(--red) 1.8cqw 4cqw)}
.ppm .pw7 .p-diag-wide{background:repeating-linear-gradient(45deg,var(--red) 0 2.8cqw,var(--cream) 2.8cqw 6cqw)}
.ppm .pw7 .p-chev{background:var(--cream)}
.ppm .pw7 .p-chev::before{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(-58deg,var(--red) 0 1.8cqw,transparent 1.8cqw 5cqw)}
.ppm .pw7 .p-grid{background:var(--cream)}
.ppm .pw7 .p-grid::before{content:"";position:absolute;inset:0;
  background:linear-gradient(rgba(30,26,25,.5) 1px,transparent 1px) 0 0/100% 3cqw,
             linear-gradient(90deg,rgba(30,26,25,.5) 1px,transparent 1px) 0 0/3cqw 100%}

/* ── MASQUES — le PNG découpe, la couleur vient du background : la fleur et
   l'érable suivent la teinte de chaque école sans PNG par collège. Même
   mécanisme que .mask-fleur / .mask-maple du mur web. ── */
.ppm .pw7 .lys,.ppm .pw7 .mask-fleur{display:block;background:currentColor;
  -webkit-mask:url(/logos/fleur-de-lys.png) center/contain no-repeat;
  mask:url(/logos/fleur-de-lys.png) center/contain no-repeat}
.ppm .pw7 .mask-maple{display:block;background:currentColor;
  -webkit-mask:url(/logos/maple-leaf.png) center/contain no-repeat;
  mask:url(/logos/maple-leaf.png) center/contain no-repeat}

/* ── RANGÉE 1 ── */
/* Le mot NEXUS ne prend PAS le grain (.grunge) : à l'échelle du portrait la
   trame le salissait. Il reçoit la micro-rayure diagonale du b-nexus du web,
   qui texture sans mordre sur la marque. */
.ppm .pw7 .nex{grid-area:nex;background:var(--red);display:flex;align-items:center;justify-content:center}
.ppm .pw7 .nex::before{content:"";position:absolute;inset:0;opacity:.5;
  background:repeating-linear-gradient(35deg,rgba(255,255,255,.03) 0 2px,transparent 2px 6px)}
.ppm .pw7 .nex img{width:62%;height:auto;display:block}
.ppm .pw7 .rse{grid-area:rse;background:var(--cream)}
.ppm .pw7 .rse img{width:64%;height:auto;display:block}
.ppm .pw7 .rse b.lg-alt{font-family:'Anton',sans-serif;font-size:4.4cqw;letter-spacing:.01em;color:var(--ink)}
.ppm .pw7 .que{grid-area:que}
.ppm .pw7 .que b{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--ink)}
.ppm .pw7 .dam{grid-area:dam}

/* ── RANGÉE 2 ── */
.ppm .pw7 .cnd{grid-area:cnd}
.ppm .pw7 .cnd b{font-family:'Bebas Neue',sans-serif;font-size:4.6cqw;color:var(--ink);letter-spacing:.13em}
.ppm .pw7 .pbk{grid-area:pbk;background:var(--char)}
.ppm .pw7 .pbk svg{position:absolute;inset:0;width:100%;height:100%;opacity:.5}
.ppm .pw7 .fdb{grid-area:fdb}
.ppm .pw7 .fdb .lys{width:15cqw;height:20cqw;color:var(--ink)}

/* ── RANGÉE 3 ── */
.ppm .pw7 .dmr{grid-area:dmr}
.ppm .pw7 .alz{grid-area:alz;background:var(--red);display:block;padding:2.4cqw}
.ppm .pw7 .alz b{position:absolute;left:2.4cqw;bottom:2.6cqw;font-family:'Bebas Neue',sans-serif;
  color:var(--on-c1);letter-spacing:.1em;border-bottom:.5cqw solid var(--on-c1);padding-bottom:.5cqw}
.ppm .pw7 .stx{grid-area:stx;background:var(--char);
  background-image:radial-gradient(rgba(255,255,255,.13) 1cqw,transparent 1.1cqw);background-size:4cqw 4cqw}
.ppm .pw7 .stx svg{width:7cqw;height:auto;fill:var(--cream)}

/* ── RANGÉE 4 ── */
.ppm .pw7 .eli{grid-area:eli;background:var(--ink)}
.ppm .pw7 .eli b{font-family:'Anton',sans-serif;color:transparent;
  -webkit-text-stroke:.34cqw var(--cream);letter-spacing:.02em;text-align:center}
.ppm .pw7 .ffg{grid-area:ffg;background:var(--ink)}
.ppm .pw7 .ffg img{width:78%;height:auto;display:block;transform:rotate(-15deg)}
.ppm .pw7 .ag{grid-area:ag}
.ppm .pw7 .ag b{font-family:'Anton',sans-serif;color:var(--c1-cream);line-height:.86;letter-spacing:-.02em}

/* ── RANGÉES 5-7 : bloc VILLE (= le b-kraft du web) ── */
.ppm .pw7 .mtl{grid-area:mtl;background:var(--cream);display:block;padding:3cqw 3.4cqw}
.ppm .pw7 .mtl .kick{font-family:'Bebas Neue',sans-serif;font-size:2.1cqw;letter-spacing:.26em;
  color:var(--ink);opacity:.66}
.ppm .pw7 .mtl .rail{margin-top:1.4cqw;font-family:'Anton',sans-serif;color:var(--c1-cream);
  line-height:.9;letter-spacing:-.01em}
.ppm .pw7 .mtl .k-rule{margin-top:1.4cqw;width:76%;height:.34cqw;background:var(--ink);opacity:.6}
.ppm .pw7 .mtl .k-bnr{display:inline-block;margin-top:1.8cqw;background:var(--red);color:var(--on-c1);
  font-family:'Bebas Neue',sans-serif;font-size:2.5cqw;letter-spacing:.08em;padding:.5cqw 1.6cqw;
  transform:rotate(-2deg)}
.ppm .pw7 .mtl .area{font-family:'Anton',sans-serif;color:var(--ink);line-height:.92;margin-top:1.6cqw;opacity:.92}
/* Devise à la verticale — ancrée à GAUCHE comme sur le web. Avec
   transform-origin:right top, rotate(90deg) renvoyait le début de la chaîne
   au-dessus du bord de la tuile, qui le rognait (« FIE » perdu). */
.ppm .pw7 .mtl .dev{position:absolute;left:34cqw;top:5cqw;transform:rotate(90deg);transform-origin:left top;
  font-family:'Bebas Neue',sans-serif;font-size:2.2cqw;letter-spacing:.18em;color:var(--c1-cream);white-space:nowrap}
.ppm .pw7 .mtl .fly{position:absolute;left:3.4cqw;bottom:8cqw;width:7cqw;height:7cqw;color:var(--kraft);
  transform:rotate(-9deg)}
.ppm .pw7 .mtl .arw{position:absolute;left:3.4cqw;bottom:3.6cqw;font-family:'Barlow Condensed',sans-serif;
  font-weight:800;font-style:italic;font-size:3cqw;color:var(--c1-cream);letter-spacing:.02em}
.ppm .pw7 .mtl .k-rule-b{position:absolute;left:3.4cqw;bottom:1.8cqw;width:80%;height:.34cqw;
  background:var(--ink);opacity:.32}
.ppm .pw7 .rdt{grid-area:rdt}
.ppm .pw7 .fdl{grid-area:fdl;background:var(--ink);display:block;color:var(--kraft)}
.ppm .pw7 .fdl .mk{position:absolute;aspect-ratio:1;opacity:.55}
.ppm .pw7 .str{grid-area:str}

/* ── RANGÉE 8 : fermeture ── */
.ppm .pw7 .gra{grid-area:gra;background:var(--char)}
.ppm .pw7 .gra b{font-family:'Anton',sans-serif;color:transparent;
  -webkit-text-stroke:.42cqw rgba(237,230,214,.42);letter-spacing:.02em;line-height:1;text-align:center}

/* ═══ SURCOUCHE ═══ */
.ppm .pw7 .vign{position:absolute;inset:0;z-index:39;pointer-events:none;
  background:radial-gradient(120% 100% at 50% 42%, transparent 58%, rgba(0,0,0,.3) 100%)}
.ppm .pw7 .grain{position:absolute;inset:0;width:100%;height:100%;z-index:40;pointer-events:none;
  mix-blend-mode:overlay;opacity:.5}
.ppm .pw7 .scrim{position:absolute;z-index:41;left:26%;top:44%;width:52%;height:44%;pointer-events:none;
  background:radial-gradient(55% 55% at 50% 48%, rgba(12,4,6,.18), transparent 75%)}

/* médaillons */
.ppm .pw7 .roundwrap{position:absolute;z-index:45}
.ppm .pw7 .roundel{width:13cqw;height:13cqw;border-radius:50%;background:var(--red-deep);
  border:.6cqw solid var(--cream);display:flex;flex-direction:column;align-items:center;justify-content:center;
  box-shadow:0 1cqw 2.4cqw rgba(0,0,0,.5);transform:rotate(-7deg)}
.ppm .pw7 .roundel .d1{font-family:'Anton',sans-serif;font-size:4.4cqw;color:var(--cream);line-height:1}
.ppm .pw7 .roundel .rs{font-family:'Bebas Neue',sans-serif;font-size:1.7cqw;letter-spacing:.24em;
  color:var(--cream);opacity:.85;margin-top:.2cqw}
.ppm .pw7 .roundel .xic{width:5.6cqw;filter:grayscale(1) brightness(3.2)}

/* flottant */
.ppm .pw7 .float{position:absolute;z-index:45;filter:drop-shadow(0 1cqw 2.2cqw rgba(0,0,0,.55))}
.ppm .pw7 .float svg{display:block;width:100%;height:auto;color:var(--cream);transform:rotate(-9deg)}

/* carte slogan */
.ppm .pw7 .slogan-card{position:absolute;z-index:46;left:57%;top:28%;transform:rotate(7deg);
  background:var(--cream);border-radius:1.2cqw;padding:1.8cqw 2.6cqw;box-shadow:0 1.4cqw 3cqw rgba(0,0,0,.5);
  font-family:'Permanent Marker',cursive;font-size:3.1cqw;color:var(--c1-cream);line-height:1.3;
  text-align:center;white-space:nowrap}

/* surnom */
.ppm .pw7 .under-card{position:absolute;z-index:49;left:9%;top:45%;transform:rotate(-5deg);
  background:var(--cream);color:var(--c1-cream);font-family:'Bebas Neue',sans-serif;font-size:2.7cqw;
  letter-spacing:.08em;padding:.8cqw 2cqw;border-radius:.7cqw;box-shadow:0 .9cqw 2cqw rgba(0,0,0,.4);
  white-space:nowrap}

/* hero — carte logo + name-card */
/* Hero — calé sur la MOITIÉ DROITE : il couvre les tuiles de motif (pois,
   semis, diagonales) et laisse intact le bloc ville, seul texte dense du mur.
   Le web le centre à 50% parce qu'en 21/9 il a de la place des deux côtés ;
   en 9/13 le centrer mangeait le rail de la ville. */
.ppm .pw7 .hero{position:absolute;z-index:50;left:66%;top:69%;transform:translate(-50%,-50%);width:42cqw}
.ppm .pw7 .hero .logo-card{width:100%;background:var(--cream);border-radius:2.2cqw;padding:2.8cqw;
  transform:rotate(-2deg);box-shadow:0 3.4cqw 6.6cqw rgba(0,0,0,.66), 0 .6cqw 1.8cqw rgba(0,0,0,.42)}
.ppm .pw7 .hero .logo-card img,.ppm .pw7 .hero .logo-card svg{width:100%;height:auto;display:block}
.ppm .pw7 .name-card{position:absolute;z-index:51;left:34%;bottom:-3.4cqw;transform:rotate(3deg);max-width:62cqw;
  background:var(--red);color:var(--on-c1);font-family:'Anton',sans-serif;letter-spacing:.015em;
  padding:.9cqw 2.6cqw 1.1cqw;border-radius:1cqw;border:.5cqw solid var(--cream);
  box-shadow:0 2cqw 4cqw rgba(0,0,0,.55);white-space:nowrap}
`;
