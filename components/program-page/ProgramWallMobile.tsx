"use client";

// components/program-page/ProgramWallMobile.tsx
//
// LE MUR — rendu NATIF (bundle Capacitor), portage 1:1 de la grille PORTRAIT
// 5 colonnes × 8 rangées de docs/reference/page-ecole-mobile-v3.html.
//
// Le mur WEB (components/program-wall/ProgramWall.tsx) reste intact : il vit sur
// une grille 10×5 paysage et s'appuie sur des assets raster (foam finger, écusson)
// qui ne sont pas disponibles ici. Ce mur-ci est RECONSTRUIT en CSS + SVG :
//   • aucun asset raster, aucune dépendance nouvelle ;
//   • les motifs (damiers, pointillés, rayures, fleurs de lys) sont des
//     background-image CSS ou des <path> ;
//   • la typo de DÉCOR (Anton / Bebas / Playfair / Permanent Marker) est celle du
//     mur, pas celle du corps de page — c'est une affiche, pas de l'UI.
//
// Structurellement conforme au mock : bande NEXUS · RSEQ · QUÉBEC · damier en
// PREMIÈRE rangée, GRASSET (= le mot du rail) en rangée de FERMETURE, damiers,
// écusson, foam finger.
//
// ZÉRO invention : chaque mot variable vient de resolveWall() — la MÊME
// résolution que le mur web (initiales, mot du rail, ville, regionTag, code
// régional, devise flèche, mots personnalisés, slogan, mascotte). Un slot sans
// donnée n'est pas rendu.

import * as React from "react";
import { resolveWall, type SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { WallTheme } from "@/components/program-wall/theme";

/** Ajustement de corps pour un mot variable : plafond `cap` (la valeur du mock),
 *  puis rétrécissement proportionnel à la longueur pour qu'un nom long ne déborde
 *  pas de sa tuile. Même principe que railFont/cityFont de slots.ts. */
const fit = (cap: number, span: number, len: number): string =>
  `${Math.min(cap, span / Math.max(1, len)).toFixed(2)}cqw`;

/* ── Glyphes de décor, dessinés (aucun emoji, aucun caractère de symbole) ──── */

function Lys({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 40 48" aria-hidden focusable="false">
      {/* pétale central */}
      <path d="M20 3c-3.2 5-4.6 9.6-4.6 13.6 0 3.6 1.5 7 4.6 10.2 3.1-3.2 4.6-6.6 4.6-10.2 0-4-1.4-8.6-4.6-13.6z" />
      {/* pétale gauche — sortie en volute, pointe recourbée */}
      <path d="M18.6 27.4C14 22.6 8.2 20 4.2 22.4 1 24.3 1.4 29 5.2 30.6c1.4.6 2.8.4 3.5-.5-2.1-.3-3.3-1.3-3.5-2.5-.3-1.4.7-2.4 2.4-2.3 3.2.2 7.6 1.7 11 3.9z" />
      {/* pétale droit — miroir exact */}
      <path d="M21.4 27.4C26 22.6 31.8 20 35.8 22.4 39 24.3 38.6 29 34.8 30.6c-1.4.6-2.8.4-3.5-.5 2.1-.3 3.3-1.3 3.5-2.5.3-1.4-.7-2.4-2.4-2.3-3.2.2-7.6 1.7-11 3.9z" />
      {/* bandeau + hampe */}
      <path d="M13.6 31.2h12.8v3.2H13.6z" />
      <path d="M17.8 34.4h4.4v8.2c0 1.9 1.3 3.2 3.4 3.8H14.4c2.1-.6 3.4-1.9 3.4-3.8z" />
    </svg>
  );
}

function Etoile({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}

export interface ProgramWallMobileProps {
  school: SchoolProgramIdentity;
  theme: WallTheme;
  /** Division affichée dans la pastille du bloc ville. AUTO (table teams) —
   *  absente → la pastille n'est pas rendue (jamais une division inventée). */
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
        {/* ── rangée de tête : NEXUS · ligue · province · damier ── */}
        <div className="t nex">
          <b>
            NE<i>X</i>US
          </b>
        </div>
        <div className="t rse">
          <b className={school.league === "RSEQ" ? "lg-rseq" : "lg-alt"}>{school.league}</b>
        </div>
        <div className="t que">
          <b style={{ fontSize: fit(4.2, 27, provinceMot.length) }}>{provinceMot}</b>
        </div>
        <div className="t dam" />

        {/* ── playbook X & O ── */}
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
        <div className="t dmr" />
        <div className="t eli">
          <b style={{ fontSize: fit(4, 22, w.eliteWord.length) }}>{w.eliteWord.toUpperCase()}</b>
        </div>

        {/* ── bloc VILLE ── */}
        <div className="t mtl">
          {division ? (
            <div className="d1">
              <b>{division}</b>
              <i>DIVISION</i>
            </div>
          ) : null}
          {/* railFont() de slots.ts est calibré sur le rail VERTICAL du mur web
              (pleine hauteur) : réutilisé tel quel ici, « MONTRÉAL » déborde de
              la tuile 2 colonnes. Même forme de règle, empan mesuré sur CETTE
              tuile (40cqw moins ses marges), plafond identique. */}
          <div className="rail" style={{ fontSize: fit(9.4, 40, w.cityUpper.length) }}>
            {w.cityUpper}
          </div>
          {w.regionTag ? <div className="city">{w.regionTag}</div> : null}
          {w.areaCode ? (
            <div className="area" style={{ fontSize: fit(14, 44, w.areaCode.length) }}>
              {w.areaCode}
            </div>
          ) : null}
          <Lys className="fly" />
          <div className="arw">{w.arrowPhrase}</div>
        </div>

        {/* ── motif fleurs de lys ── */}
        <div className="t fdl">
          <div className="g">
            {Array.from({ length: 12 }, (_, i) => (
              <Lys key={i} />
            ))}
          </div>
        </div>
        <div className="t rdt" />
        <div className="t str" />

        {/* ── foam finger ── */}
        <div className="t ffg">
          <svg viewBox="0 0 44 66" aria-hidden focusable="false">
            <path
              d="M17 4a4 4 0 0 1 8 0v26h3a5 5 0 0 1 5 5v3h3a4 4 0 0 1 4 4v9a11 11 0 0 1-11 11H18A13 13 0 0 1 5 49V36a4 4 0 0 1 8 0v-6a4 4 0 0 1 4-4z"
              fill="var(--red)"
              stroke="var(--cream)"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <text x="21" y="54" fontFamily="Anton, sans-serif" fontSize="12" fill="var(--cream)" textAnchor="middle">
              #1
            </text>
          </svg>
        </div>
        <div className="t ag">
          <b style={{ fontSize: fit(15, 30, w.initials.length) }}>{w.initials}</b>
        </div>
        <div className="t fdb">
          <Lys />
        </div>

        {/* ── ALLEZ · étoile · CANADA ── */}
        <div className="t alz">
          <b style={{ fontSize: fit(4, 22, w.allezWord.length) }}>{w.allezWord.toUpperCase()}</b>
        </div>
        <div className="t stx">
          <Etoile />
        </div>
        <div className="t cnd">
          <b>CANADA</b>
        </div>

        {/* ── rangée de fermeture ── */}
        <div className="t gra">
          <b style={{ fontSize: fit(16, 112, gra.length) }}>{gra}</b>
        </div>

        {/* ── surcouche : écusson + autocollants ── */}
        <div className="shield">
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
          <div className="stick ph" style={{ fontSize: fit(6, 40, mascotte.length) }}>
            {mascotte}
          </div>
        ) : null}
        {w.sloganLines ? (
          <div className="note">
            {w.sloganLines.map((l, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <br /> : null}
                {l}
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS du mur — portrait 5 × 8, portage verbatim du mock (unités cqw sur un
   conteneur `container-type:inline-size`). Injecté par ProgramPageMobile.
   ────────────────────────────────────────────────────────────────────────── */
export const WALL_CSS = `
.ppm .pw7 .mosaic{
  container-type:inline-size; aspect-ratio:9/13; background:var(--ink);
  display:grid; grid-template-columns:repeat(5,20%); grid-template-rows:repeat(8,12.5%); gap:0;
  position:relative;
  /* ⚠ CORRECTION DU MOCK — dans page-ecole-mobile-v3.html, la tuile « str »
     occupe r5c3+r5c4 ET r6c4 : une forme en L. grid-template-areas n'accepte
     que des RECTANGLES → la déclaration entière est invalide et le navigateur
     la jette (grid-template-areas calculé = none). Vérifié dans le mock
     lui-même : ses 18 tuiles s'y replient en 26×23px hors grille — le mur n'y
     rend pas. Une seule cellule change ici : r6c4 passe de « str » à « ag », ce
     qui rend les DEUX rectangulaires. Structure du ticket intacte : portrait
     5×8, bande NEXUS · ligue · province · damier en PREMIÈRE rangée, mot du
     rail en rangée de FERMETURE, damiers, écusson, foam finger, 18 tuiles. */
  grid-template-areas:
    "nex nex rse que dam"
    "pbk pbk dmr dmr eli"
    "mtl mtl fdl fdl rdt"
    "mtl mtl fdl fdl rdt"
    "mtl mtl str str rdt"
    "ffg ag  ag  ag  fdb"
    "alz stx cnd cnd fdb"
    "gra gra gra gra gra";
}
.ppm .pw7 .t{position:relative;overflow:hidden;display:grid;place-items:center}

/* rangée de tête */
.ppm .pw7 .nex{grid-area:nex;background:var(--red);display:flex;align-items:center;justify-content:center}
.ppm .pw7 .nex b{font-family:'Anton',sans-serif;font-size:6.4cqw;color:var(--cream);letter-spacing:.02em}
.ppm .pw7 .nex b i{font-style:normal;color:var(--ink)}
.ppm .pw7 .rse{grid-area:rse;background:var(--cream)}
.ppm .pw7 .rse b{font-family:'Anton',sans-serif;font-size:4.4cqw;letter-spacing:.01em}
.ppm .pw7 .rse b.lg-rseq{color:#0B6FB8}
.ppm .pw7 .rse b.lg-alt{color:var(--ink)}
.ppm .pw7 .que{grid-area:que;background:var(--cream)}
.ppm .pw7 .que b{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--ink)}
.ppm .pw7 .dam{grid-area:dam;background:var(--ink);
  background-image:linear-gradient(45deg,var(--red) 25%,transparent 25%,transparent 75%,var(--red) 75%),
                   linear-gradient(45deg,var(--red) 25%,transparent 25%,transparent 75%,var(--red) 75%);
  background-size:5cqw 5cqw;background-position:0 0,2.5cqw 2.5cqw}

/* playbook X & O */
.ppm .pw7 .pbk{grid-area:pbk;background:var(--char)}
.ppm .pw7 .pbk svg{position:absolute;inset:0;width:100%;height:100%;opacity:.5}
/* damier rouge / clair */
.ppm .pw7 .dmr{grid-area:dmr;background:var(--cream);
  background-image:linear-gradient(45deg,var(--red) 25%,transparent 25%,transparent 75%,var(--red) 75%),
                   linear-gradient(45deg,var(--red) 25%,transparent 25%,transparent 75%,var(--red) 75%);
  background-size:7cqw 7cqw;background-position:0 0,3.5cqw 3.5cqw}
/* mot ÉLITE */
.ppm .pw7 .eli{grid-area:eli;background:var(--ink)}
.ppm .pw7 .eli b{font-family:'Anton',sans-serif;color:transparent;
  -webkit-text-stroke:.34cqw var(--cream);letter-spacing:.02em;text-align:center}

/* bloc VILLE */
.ppm .pw7 .mtl{grid-area:mtl;background:var(--cream);display:block;padding:3cqw 3.4cqw}
.ppm .pw7 .mtl .d1{position:absolute;top:-3cqw;left:3cqw;width:13cqw;height:13cqw;border-radius:50%;
  background:var(--red-deep);display:grid;place-items:center;align-content:center;z-index:3}
.ppm .pw7 .mtl .d1 b{font-family:'Anton',sans-serif;font-size:5cqw;color:var(--cream);line-height:1}
.ppm .pw7 .mtl .d1 i{font-family:'Bebas Neue',sans-serif;font-style:normal;font-size:1.9cqw;color:var(--cream);letter-spacing:.14em}
.ppm .pw7 .mtl .rail{margin-top:9cqw;font-family:'Anton',sans-serif;color:var(--red);
  line-height:.9;letter-spacing:-.01em;border-bottom:.5cqw solid var(--ink);padding-bottom:.6cqw}
.ppm .pw7 .mtl .city{display:inline-block;margin-top:1.6cqw;background:var(--red);color:var(--cream);
  font-family:'Bebas Neue',sans-serif;font-size:2.6cqw;letter-spacing:.1em;padding:.5cqw 1.6cqw}
.ppm .pw7 .mtl .area{font-family:'Anton',sans-serif;color:var(--ink);line-height:.92;margin-top:.8cqw}
.ppm .pw7 .mtl .fly{position:absolute;left:3.4cqw;bottom:6.4cqw;width:6cqw;height:auto;fill:var(--kraft)}
.ppm .pw7 .mtl .arw{position:absolute;left:3.4cqw;bottom:2.2cqw;font-family:'Barlow Condensed',sans-serif;
  font-weight:800;font-style:italic;font-size:3cqw;color:var(--red);letter-spacing:.02em}

/* motif fleurs de lys */
.ppm .pw7 .fdl{grid-area:fdl;background:var(--ink);display:block}
.ppm .pw7 .fdl .g{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);
  align-content:center;gap:1.4cqw;padding:1.6cqw;opacity:.5}
.ppm .pw7 .fdl .g svg{width:3.4cqw;height:auto;margin:0 auto;display:block;fill:var(--kraft)}
/* pointillés */
.ppm .pw7 .rdt{grid-area:rdt;background:var(--red);
  background-image:radial-gradient(rgba(0,0,0,.30) 1.1cqw,transparent 1.2cqw);background-size:4.4cqw 4.4cqw}
/* rayures */
.ppm .pw7 .str{grid-area:str;background:var(--cream);
  background-image:repeating-linear-gradient(115deg,var(--red) 0 2.4cqw,transparent 2.4cqw 6cqw)}
/* foam finger */
.ppm .pw7 .ffg{grid-area:ffg;background:var(--ink)}
.ppm .pw7 .ffg svg{width:52%;height:auto}
/* initiales */
.ppm .pw7 .ag{grid-area:ag;background:var(--cream)}
.ppm .pw7 .ag b{font-family:'Anton',sans-serif;color:var(--red);line-height:.86;letter-spacing:-.02em}
/* grande fleur de lys */
.ppm .pw7 .fdb{grid-area:fdb;background:var(--cream)}
.ppm .pw7 .fdb svg{width:19cqw;height:auto;fill:var(--ink)}
/* ALLEZ */
.ppm .pw7 .alz{grid-area:alz;background:var(--red);display:block;padding:2.4cqw}
.ppm .pw7 .alz b{position:absolute;left:2.4cqw;bottom:2.6cqw;font-family:'Bebas Neue',sans-serif;
  color:var(--cream);letter-spacing:.1em;border-bottom:.5cqw solid var(--cream);padding-bottom:.5cqw}
/* étoile */
.ppm .pw7 .stx{grid-area:stx;background:var(--char);
  background-image:radial-gradient(rgba(255,255,255,.13) 1cqw,transparent 1.1cqw);background-size:4cqw 4cqw}
.ppm .pw7 .stx svg{width:7cqw;height:auto;fill:var(--cream)}
/* CANADA */
.ppm .pw7 .cnd{grid-area:cnd;background:var(--cream)}
.ppm .pw7 .cnd b{font-family:'Bebas Neue',sans-serif;font-size:4.6cqw;color:var(--ink);letter-spacing:.13em}
/* rangée de fermeture */
.ppm .pw7 .gra{grid-area:gra;background:var(--char)}
.ppm .pw7 .gra b{font-family:'Anton',sans-serif;color:transparent;
  -webkit-text-stroke:.42cqw rgba(237,230,214,.42);letter-spacing:.02em;line-height:1;text-align:center}

/* surcouche : écusson + autocollants */
.ppm .pw7 .shield{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);z-index:6;
  width:44cqw;background:var(--cream);border-radius:2.6cqw;padding:3cqw;
  box-shadow:0 3cqw 6cqw rgba(0,0,0,.45)}
.ppm .pw7 .shield svg,.ppm .pw7 .shield img{width:100%;height:auto;display:block}
.ppm .pw7 .stick{position:absolute;z-index:7;background:var(--red);color:var(--cream);
  border:.7cqw solid var(--cream);border-radius:1.6cqw;padding:1.4cqw 3cqw;
  font-family:'Anton',sans-serif;letter-spacing:.02em;
  box-shadow:0 2cqw 4cqw rgba(0,0,0,.45);transform:rotate(-2deg)}
.ppm .pw7 .stick.ph{right:2cqw;top:42%}
.ppm .pw7 .note{position:absolute;z-index:7;right:2cqw;top:56%;width:40cqw;background:var(--cream);
  padding:2cqw 2.4cqw;transform:rotate(-3deg);box-shadow:0 2cqw 4cqw rgba(0,0,0,.4);
  font-family:'Permanent Marker',cursive;font-size:3cqw;color:var(--red);line-height:1.35}
`;
