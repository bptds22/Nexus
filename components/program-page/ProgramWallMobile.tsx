"use client";

// components/program-page/ProgramWallMobile.tsx
//
// LE MUR — rendu NATIF (bundle Capacitor). PORTAGE de
// docs/reference/page-niveau1-mobile-first.html
// (sha256 7d76e034…dbc9aa, 449 851 o, blob git b1a90be3, intact) — le mock
// « ProgramWall — mobile · Collège André-Grasset ».
//
// Ce qui est porté : la STRUCTURE et le PLACEMENT. Les tuiles sont posées en
// grid-column / grid-row INLINE, comme le mock et comme le mur web — pas en
// grid-template-areas. Les valeurs en cqw sont reprises telles quelles.
//
// Ce qui n'est PAS porté : les valeurs. Le mock est du Grasset figé (noms,
// couleurs, logo, slogan, images base64). Chaque texte vient de resolveWall(),
// chaque couleur du thème, chaque image de public/logos/ avec son mécanisme de
// teinte — filter pour le foam, masque pour la fleur de lys. Un slot sans
// donnée n'est pas rendu.
//
// Le mur WEB (components/program-wall/ProgramWall.tsx) reste la référence et
// n'est pas touché.
//
// ── GÉOMÉTRIE ────────────────────────────────────────────────────────────────
// Le mock fait 8 rangées en aspect-ratio 9/13. La rangée de tête (playbook,
// damier, ÉLITE) est retirée → 7 rangées. Pour que la FORME DES CELLULES ne
// bouge pas, le ratio suit : une rangée vaut (13/9)/8 = 13/72 de la largeur,
// donc 7 rangées valent 91/72 → aspect-ratio 72/91. À 390px de large le mur
// passe de 563 à 493px, et la cellule reste 78 × 70,4 (forme 1,108). Garder
// 9/13 aurait rendu les cellules quasi carrées (0,969) et obligé à re-régler
// TOUTES les valeurs cqw.

import * as React from "react";
import { resolveWall, type SchoolProgramIdentity } from "@/components/program-wall/slots";
import type { WallTheme } from "@/components/program-wall/theme";

/** Ajustement de corps pour un mot variable : plafond `cap` (la valeur du
 *  mock), puis rétrécissement proportionnel à la longueur pour qu'un nom long
 *  ne déborde pas de sa tuile. Même principe que railFont/cityFont de slots.ts. */
const fit = (cap: number, span: number, len: number): string =>
  `${Math.min(cap, span / Math.max(1, len)).toFixed(2)}cqw`;

export interface ProgramWallMobileProps {
  school: SchoolProgramIdentity;
  theme: WallTheme;
  /** Division du médaillon. AUTO (table teams) — absente → pas de médaillon. */
  division?: string | null;
}

export default function ProgramWallMobile({ school, theme, division }: ProgramWallMobileProps) {
  const w = resolveWall(school, theme);

  // « Québec » en toutes lettres pour le Québec seul ; toute autre province
  // garde son code, jamais un nom deviné.
  const provinceMot = school.province.toUpperCase() === "QC" ? "Québec" : school.province.toUpperCase();
  const railMot = w.railWord.toUpperCase();
  // Le corps de la name-card se calcule sur le MOT LE PLUS LONG et non sur la
  // chaîne entière : « LES PATRIOTES » se replie en deux lignes au lieu de
  // rétrécir jusqu'à l'illisible.
  const motLePlusLong = Math.max(...w.nameCard.split(/\s+/).map((m) => m.length), 1);
  const ligneLaPlusLongue = Math.max(...w.typeL2Lines.map((l) => l.length), 1);

  return (
    <div className="pw7">
      <div className="mosaic">
        {/* ══ RANGÉE 1 — damier · province · CANADA · NEXUS ═════════════════
            §2a : cette rangée était en BAS dans le mock (r8). Elle remonte en
            tête.

            MIROIR EXACT de l'ordre précédent (NEXUS · QUÉBEC · CANADA · damier).
            Le damier passe en c1 parce que c'est la SEULE tuile de la rangée
            sans contenu : la pastille de retour vient s'y poser à gauche
            (.ppm .backbtn, left:14px → x 14-50 dans la colonne x 0-78), là où
            elle masquait 64 % du mot NEXUS avant.

            Voisinage revérifié après l'échange — « claire » = tuile en aplat
            de --cream (QUÉBEC, Fierté, lys géante, initiales, RSEQ) :
              · QUÉBEC (c2) → damier en c1 et CANADA en c3 sont foncées, le
                kraft en dessous n'est pas un aplat crème : 0 voisine claire ;
              · lys géante (c4-5, r2-3) → au-dessus, NEXUS est un aplat de
                primaire, pas une claire : 0 ;
              · initiales ⇄ RSEQ restent le seul contact clair-clair : 1 chacune.
            Maximum inchangé à 1 — aucune claire n'en touche plus d'une. */}
        <div className="blk b-nexus pop" style={{ gridColumn: "4/6", gridRow: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/nexus-wordmark-white.png" alt="NEXUS" />
        </div>
        <div className="blk wblk f-ink" style={{ gridColumn: 3, gridRow: 1 }}>
          <div className="anton canada">CANADA</div>
        </div>
        <div className="blk b-rseq" style={{ gridColumn: 2, gridRow: 6 }}>
          {/* USPORTS : slots.ts pointe /logos/usports.png, qui N'EXISTE PAS.
              On ne fabrique pas l'image — repli sur le sigle, dette signalée. */}
          {school.league === "RSEQ" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.leagueLogo} alt="RSEQ" />
          ) : (
            <b className="lg-alt">{school.league}</b>
          )}
        </div>
        <div className="blk wblk f-cream" style={{ gridColumn: 2, gridRow: 1 }}>
          <div className="prov" style={{ fontSize: fit(3.8, 26, provinceMot.length) }}>{provinceMot}</div>
        </div>
        {/* Le damier — tuile SANS contenu, d'où le choix de lui donner la
            colonne 1 : elle accueille la pastille de retour sans rien masquer. */}
        <div className="blk p-check-ink sunk" style={{ gridColumn: 1, gridRow: 1 }} />

        {/* ══ RANGÉES 2-4 — le bloc kraft : mots-clés, filets, banderole ══ */}
        <div className="blk b-kraft raise" style={{ gridColumn: "1/3", gridRow: "2/5" }}>
          <div className="kw kick">— ICI C&apos;EST —</div>
          <div className="kw ville" style={{ fontSize: fit(6, 52, w.cityUpper.length) }}>{w.cityUpper}</div>
          <div className="k-rule" />
          {w.regionTag ? <div className="k-bnr">{w.regionTag}</div> : null}
          {w.areaCode ? (
            <div className="kw code" style={{ fontSize: fit(10.5, 34, w.areaCode.length) }}>{w.areaCode}</div>
          ) : null}
          <div className="kw dev" style={{ fontSize: fit(2.9, 40, w.devise.length) }}>{w.devise}</div>
          <div className="mask-fleur lys-kraft" />
          <div className="kw arw" style={{ fontSize: fit(3.7, 46, w.arrowPhrase.length) }}>{w.arrowPhrase}</div>
        </div>
        <div className="blk p-fleurs sunk" style={{ gridColumn: 3, gridRow: 2 }} />
        {/* §3j — le bloc or a motif et la grande fleur de lys ont echange.
            Memes colonnes, meme gabarit 2x2 : l'echange est exact. */}
        <div className="blk b-type f-red raise grunge" style={{ gridColumn: "4/6", gridRow: "5/7" }}>
          <div className="l1">{w.typeL1}</div>
          <div className="l2 anton" style={{ fontSize: fit(5.2, 46, ligneLaPlusLongue) }}>
            {w.typeL2Lines.map((l, i) => (
              <React.Fragment key={i}>{i > 0 ? <br /> : null}{l}</React.Fragment>
            ))}
          </div>
          <div className="l3">{w.tagline}</div>
        </div>
        <div className="blk f-red icw xo" style={{ gridColumn: 3, gridRow: 3 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden focusable="false"><circle cx="12" cy="12" r="7" /></svg>
        </div>
        {/* Fierté est en colonne 3 et non 4, et les rayures en 4 : l'échange
            §2d met les initiales au contact du bloc fleur, ce qui donnait DEUX
            voisines claires à la fleur. Le lys sombre la couvre chez Grasset,
            mais une école à lys pâle remettrait trois clairs côte à côte.
            Vérifié par calcul de voisinage : maximum ramené à 1. */}
        <div className="blk wblk f-cream" style={{ gridColumn: 3, gridRow: 4 }}>
          <div className="fierte marker">Fierté</div>
        </div>
        <div className="blk p-stripe-h" style={{ gridColumn: 4, gridRow: 4 }} />
        <div className="blk p-tri sunk" style={{ gridColumn: 5, gridRow: 4 }} />

        {/* ══ RANGÉE 5 ══ */}
        <div className="blk wblk f-ink grunge" style={{ gridColumn: 1, gridRow: 5 }}>
          <div className="bebas line-behind ens" style={{ fontSize: fit(3.2, 26, w.ensembleWord.length) }}>{w.ensembleWord}</div>
        </div>
        {/* §3k — l'etoile prend la place qu'occupait CANADA. */}
        <div className="blk f-ink icw grunge etoile" style={{ gridColumn: 2, gridRow: 5 }}>
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false"><path d="M12 2.5l2.7 5.9 6.4.7-4.8 4.3 1.3 6.3L12 16.9 6.4 19.7l1.3-6.3L2.9 9.1l6.4-.7L12 2.5Z" /></svg>
        </div>
        <div className="blk p-chev" style={{ gridColumn: 3, gridRow: 5 }} />
        {/* Grande fleur de lys — masque PNG, couleur du thème : elle suit la
            teinte de chaque école sans PNG par collège. */}
        <div className="blk f-cream raise" style={{ gridColumn: "4/6", gridRow: "2/4" }}>
          <div className="mask-fleur lys-geante" />
        </div>

        {/* ══ RANGÉE 6 ══ */}
        <div className="blk wblk f-red" style={{ gridColumn: 1, gridRow: 6 }}>
          <div className="bebas underlined alz" style={{ fontSize: fit(3.9, 25, w.allezWord.length) }}>{w.allezWord}</div>
        </div>
        <div className="blk wblk f-cream" style={{ gridColumn: 3, gridRow: 6 }}>
          <div className="anton init" style={{ fontSize: fit(17, 36, w.initials.length) }}>{w.initials}</div>
        </div>

        {/* ══ RANGÉE 7 — fermeture : le nom du collège ══════════════════════
            §2b : la bande était en r7 dans le mock, au-dessus de NEXUS. NEXUS
            étant remonté en tête, elle devient la tuile de FERMETURE. */}
        <div className="blk b-band pop" style={{ gridColumn: "1/6", gridRow: 7 }}>
          <div className="w" style={{ fontSize: fit(16, 112, railMot.length) }}>{railMot}</div>
        </div>

        {/* ══ SURCOUCHE ═══════════════════════════════════════════════════ */}
        <div className="vign" />
        <div className="scrim" />
        <svg className="grain" aria-hidden focusable="false">
          <filter id="pwm-noise">
            <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#pwm-noise)" />
        </svg>

        {/* Médaillons. Le D1 n'existe que si la table teams porte une division. */}
        {division ? (
          <div className="roundwrap" style={{ left: "1%", top: "10.5%" }}>
            <div className="roundel" style={{ transform: "rotate(-7deg)" }}>
              <div className="d1">{division}</div>
              <div className="rs">DIVISION</div>
            </div>
          </div>
        ) : null}
        <div className="roundwrap" style={{ left: "76%", top: "54%" }}>
          {/* Medaillon Nexus en couleur FONCEE de l'ecole (--ink), la ou celui
              de la division porte la primaire assombrie. Le X n'est plus une
              image filtree mais un MASQUE : sa couleur devient pilotable, et
              c'est --on-ink qui la donne — l'encre que pickNeutralOn() choisit
              deja pour ecrire sur le fonce, plancher de contraste compris. Un
              filter grayscale/brightness ne pouvait pas respecter ce plancher,
              il forcait un blanc quelle que soit la teinte dessous. */}
          <div className="roundel nx" style={{ transform: "rotate(8deg)" }}>
            <span className="xic" />
          </div>
        </div>

        {/* LE FOAM FINGER — objet de surcouche, PAS une tuile. Il déborde de
            la mosaïque, incliné, avec son ombre portée, exactement comme dans
            le mock et comme sur le web. Reteinté par theme.foamFilter :
            hue-rotate + saturate + brightness dérivés de la primaire. Le terme
            de luminosité est indispensable — hue-rotate seul laissait un doigt
            brun aux écoles à primaire claire (le PNG source est un rouge
            sombre). */}
        <div className="float foam" style={{ left: "2.5%", top: "54%", width: "14cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/foam-red.png" alt="" style={{ filter: theme.foamFilter }} />
        </div>

        {/* Le slogan est cale dans le TIERS SUPERIEUR, au niveau de la tuile
            QUEBEC. C'est la seule bande ou il est integralement lisible : plus
            bas il entrait dans la carte logo (jusqu'a 45 % masques sur un
            slogan long, ou l'on ne lisait que la fin de la phrase), plus haut
            il recouvrait la pastille de retour et la rendait intouchable. */}
        {w.sloganLines ? (
          <div className="slogan-card">
            {w.sloganLines.map((l, i) => (
              <React.Fragment key={i}>{i > 0 ? <br /> : null}{l}</React.Fragment>
            ))}
          </div>
        ) : null}

        {w.nickname ? <div className="under-card">{w.nickname}</div> : null}

        {/* HERO — carte logo + name-card. Sans logo, le repli reste l'écusson
            dessiné : le mock replie sur le monogramme, mais les initiales
            occupent DÉJÀ une tuile ici, on ne les doublerait pas. */}
        <div className="hero">
          <div className="logo-card">
            {w.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.logoUrl!} alt="" />
            ) : (
              <svg viewBox="0 0 120 132" aria-hidden focusable="false">
                <path d="M60 4 114 22v52c0 26-24 43-54 54C30 117 6 100 6 74V22z" fill="var(--cream)" stroke="var(--red)" strokeWidth="7" />
                <path d="M44 92c-6-14-3-30 8-40-2 9 1 16 7 21-4-12 0-24 10-31-3 12 2 20 10 27 7 6 10 14 8 23-2-8-7-13-14-16 5 8 5 16 0 23-3-9-9-14-17-16 4 7 4 14-1 20-4-4-7-8-11-11z" fill="var(--red)" />
                <path d="M40 60c-6-3-10-8-11-14 7 2 13 1 18-3-3 7-4 12-7 17z" fill="var(--red)" />
              </svg>
            )}
          </div>
          {w.nameCard ? (
            <div className="name-card" style={{ fontSize: fit(8.4, 38, motLePlusLong) }}>{w.nameCard}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CSS du mur — portage verbatim du mock, valeurs cqw comprises. Les couleurs
   en dur du mock sont remplacées par les variables de thème, et les encres par
   les valeurs planchérées : --on-c1 sur un aplat de primaire, --c1-cream pour
   la primaire écrite sur une surface claire.
   ────────────────────────────────────────────────────────────────────────── */
export const WALL_CSS = `
.ppm .pw7 .mosaic{position:relative;container-type:inline-size;background:var(--ink);overflow:hidden;
  display:grid;grid-template-columns:repeat(5,20%);grid-template-rows:repeat(7,14.2857%);aspect-ratio:72/91}
.ppm .pw7 .blk{position:relative;overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.05)}
.ppm .pw7 .raise{z-index:8;box-shadow:0 1.6cqw 4.2cqw rgba(0,0,0,.72), inset 0 0 0 1px rgba(0,0,0,.25)}
.ppm .pw7 .sunk{box-shadow:inset 0 1.1cqw 3cqw rgba(0,0,0,.72), inset 0 0 0 1px rgba(0,0,0,.4);filter:brightness(.84)}
.ppm .pw7 .pop{z-index:12;transform:scale(1.05);box-shadow:0 2.2cqw 5cqw rgba(0,0,0,.75)}
.ppm .pw7 .grunge::after{content:"";position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:1;
  background-image:radial-gradient(rgba(0,0,0,.5) 1.2px,transparent 1.8px),radial-gradient(rgba(255,255,255,.26) 1.1px,transparent 1.7px),radial-gradient(rgba(0,0,0,.35) 2px,transparent 2.6px);
  background-size:1.7cqw 1.7cqw,3cqw 2.3cqw,6.6cqw 5.7cqw;background-position:0 0,1.1cqw .7cqw,2.5cqw 1.7cqw}
.ppm .pw7 .grain{position:absolute;inset:0;width:100%;height:100%;z-index:40;pointer-events:none;mix-blend-mode:overlay;opacity:.55}
.ppm .pw7 .vign{position:absolute;inset:0;z-index:39;pointer-events:none;
  background:radial-gradient(130% 90% at 50% 38%,transparent 55%,rgba(0,0,0,.32) 100%)}
.ppm .pw7 .scrim{position:absolute;z-index:41;left:8%;top:16%;width:84%;height:44%;pointer-events:none;
  background:radial-gradient(50% 50% at 50% 50%,rgba(12,4,6,.18),transparent 75%)}

.ppm .pw7 .f-red{background:var(--red)}
.ppm .pw7 .f-ink{background:var(--char)}
.ppm .pw7 .f-cream{background:var(--cream)}
.ppm .pw7 .wblk{display:flex;align-items:center;justify-content:center;text-align:center}
.ppm .pw7 .anton{font-family:'Anton',sans-serif;font-weight:400}
.ppm .pw7 .bebas{font-family:'Bebas Neue',sans-serif;letter-spacing:.06em}
.ppm .pw7 .marker{font-family:'Permanent Marker',cursive}
.ppm .pw7 .line-behind{position:relative;z-index:1}
.ppm .pw7 .line-behind::before{content:"";position:absolute;left:-14%;right:-14%;top:52%;height:.6cqw;background:var(--red);z-index:-1}
.ppm .pw7 .underlined{border-bottom:.5cqw solid currentColor;padding-bottom:.5cqw}
.ppm .pw7 .icw{display:flex;align-items:center;justify-content:center}
/* MASQUE : le PNG découpe, la couleur vient du background — la fleur suit la
   teinte de chaque école sans PNG par collège. */
.ppm .pw7 .mask-fleur{-webkit-mask:url(/logos/fleur-de-lys.png) center/contain no-repeat;
  mask:url(/logos/fleur-de-lys.png) center/contain no-repeat}

/* ── MOTIFS, à l'échelle cqw du mock ── */
.ppm .pw7 .p-check-ink{background:repeating-conic-gradient(var(--ink) 0 25%,var(--red) 0 50%) 0 0/4.2cqw 4.2cqw}
.ppm .pw7 .p-fleurs{background:var(--char)}
.ppm .pw7 .p-fleurs::after{content:"";position:absolute;inset:0;background:var(--cream);opacity:.32;
  -webkit-mask:url(/logos/fleur-de-lys.png) 0 0/4.4cqw 4.4cqw repeat;mask:url(/logos/fleur-de-lys.png) 0 0/4.4cqw 4.4cqw repeat}
.ppm .pw7 .p-stripe-h{background:repeating-linear-gradient(0deg,var(--cream) 0 2.4cqw,var(--char) 2.4cqw 5.2cqw)}
.ppm .pw7 .p-chev{background:var(--cream)}
.ppm .pw7 .p-chev::before{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(-58deg,var(--red) 0 2cqw,transparent 2cqw 5.4cqw)}
.ppm .pw7 .p-tri{background:var(--red-deep)}
.ppm .pw7 .p-tri::before{content:"";position:absolute;inset:0;
  background:conic-gradient(from 60deg at 50% 65%,var(--cream) 0 60deg,transparent 0) 0 0/5.2cqw 4.8cqw;opacity:.85}

/* ── RANGÉE 1 ── */
.ppm .pw7 .b-nexus{background:var(--red);display:flex;align-items:center;justify-content:center}
.ppm .pw7 .b-nexus img{width:60%;display:block}
.ppm .pw7 .b-rseq{background:var(--cream);display:flex;align-items:center;justify-content:center}
.ppm .pw7 .b-rseq img{width:70%;display:block}
.ppm .pw7 .b-rseq .lg-alt{font-family:'Anton',sans-serif;font-size:4.4cqw;color:var(--ink)}
.ppm .pw7 .prov{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--c1-cream)}

/* ── BLOC KRAFT ── */
.ppm .pw7 .b-kraft{background:var(--kraft);color:var(--ink)}
.ppm .pw7 .kw{position:absolute;white-space:nowrap;line-height:1}
.ppm .pw7 .kw.kick{left:9%;top:5%;font-family:'Bebas Neue',sans-serif;font-size:2.7cqw;letter-spacing:.24em}
.ppm .pw7 .kw.ville{left:8%;top:11%;font-family:'Anton',sans-serif;color:var(--c1-cream)}
.ppm .pw7 .k-rule{position:absolute;left:9%;top:22%;width:58%;height:2px;background:var(--ink);opacity:.6}
.ppm .pw7 .k-bnr{position:absolute;left:9%;top:26%;background:var(--red);color:var(--on-c1);
  font-family:'Bebas Neue',sans-serif;font-size:2.4cqw;padding:.5cqw 1.8cqw;letter-spacing:.06em;
  transform:rotate(-2deg)}
.ppm .pw7 .kw.code{left:13%;top:36%;font-family:'Anton',sans-serif;opacity:.92}
.ppm .pw7 .kw.dev{left:68%;top:37%;font-family:'Bebas Neue',sans-serif;letter-spacing:.18em;
  color:var(--c1-cream);transform:rotate(90deg);transform-origin:left top}
.ppm .pw7 .lys-kraft{position:absolute;left:12%;top:60%;width:26%;aspect-ratio:1;background:var(--beige)}
.ppm .pw7 .kw.arw{left:13%;top:84%;font-family:'Barlow Condensed',sans-serif;font-style:italic;
  font-weight:800;color:var(--c1-cream)}

/* ── BLOC TYPE ── */
.ppm .pw7 .b-type{display:flex;flex-direction:column;justify-content:center;padding:2.6cqw;gap:.7cqw}
.ppm .pw7 .b-type .l1{font-family:'Bebas Neue',sans-serif;font-size:2.6cqw;letter-spacing:.32em;
  color:var(--on-c1);opacity:.85}
.ppm .pw7 .b-type .l2{line-height:.95;color:var(--on-c1);text-transform:uppercase}
.ppm .pw7 .b-type .l3{font-family:'Playfair Display',serif;font-style:italic;font-size:2.5cqw;
  color:var(--on-c1);opacity:.9;margin-top:.7cqw}
.ppm .pw7 .xo{gap:1.9cqw}
.ppm .pw7 .xo svg{width:32%;color:var(--on-c1)}

/* ── TUILES DE MOT ── */
.ppm .pw7 .fierte{font-size:3.4cqw;color:var(--c1-cream);transform:rotate(-3deg)}
.ppm .pw7 .ens{color:var(--cream)}
.ppm .pw7 .canada{font-size:3.4cqw;color:var(--cream);transform:rotate(-8deg)}
.ppm .pw7 .alz{color:var(--on-c1)}
.ppm .pw7 .etoile svg{width:38%;color:var(--cream)}
.ppm .pw7 .init{color:var(--c1-cream);line-height:.8}
.ppm .pw7 .lys-geante{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);
  width:150%;aspect-ratio:1;background:var(--char)}

/* ── FERMETURE ── */
.ppm .pw7 .b-band{background:var(--char);display:flex;align-items:center;justify-content:center;overflow:hidden}
.ppm .pw7 .b-band .w{font-family:'Anton',sans-serif;letter-spacing:.06em;color:transparent;
  -webkit-text-stroke:.3cqw rgba(241,235,221,.4);text-transform:uppercase;white-space:nowrap}

/* ── SURCOUCHE ── */
/* z-52 : AU-DESSUS du hero (50) et de la name-card (51). Ceinture par-dessus la
   borne de largeur — même si un nom très long passait dessous, le médaillon
   resterait lisible. */
.ppm .pw7 .roundwrap{position:absolute;z-index:52}
.ppm .pw7 .roundel{width:13cqw;height:13cqw;border-radius:50%;background:var(--red-deep);
  border:.6cqw solid var(--cream);display:flex;flex-direction:column;align-items:center;justify-content:center;
  box-shadow:0 1.1cqw 2.6cqw rgba(0,0,0,.45)}
.ppm .pw7 .roundel .d1{font-family:'Anton',sans-serif;font-size:4.2cqw;color:var(--cream);line-height:1}
.ppm .pw7 .roundel .rs{font-family:'Bebas Neue',sans-serif;font-size:1.6cqw;letter-spacing:.26em;
  color:var(--cream);opacity:.85;margin-top:.3cqw}
.ppm .pw7 .roundel.nx{background:var(--ink)}
.ppm .pw7 .roundel .xic{display:block;width:5.6cqw;height:5.6cqw;background:var(--on-ink);
  -webkit-mask:url(/logos/nexus-x.png) center/contain no-repeat;
  mask:url(/logos/nexus-x.png) center/contain no-repeat}
/* Le foam DÉBORDE de la mosaïque : c'est un objet posé dessus, pas une tuile. */
.ppm .pw7 .float{position:absolute;z-index:45;filter:drop-shadow(0 1.1cqw 2.4cqw rgba(0,0,0,.55))}
.ppm .pw7 .float img{width:100%;display:block;transform:rotate(-15deg)}
.ppm .pw7 .slogan-card{position:absolute;z-index:46;right:3%;bottom:79%;transform:rotate(7deg);
  background:var(--cream);border-radius:1.3cqw;padding:2.2cqw 3.4cqw;box-shadow:0 1.7cqw 3.8cqw rgba(0,0,0,.5);
  font-family:'Permanent Marker',cursive;font-size:3.9cqw;color:var(--c1-cream);line-height:1.3;text-align:center}
.ppm .pw7 .under-card{position:absolute;z-index:49;left:29%;top:51%;transform:rotate(-5deg);
  background:var(--cream);color:var(--c1-cream);font-family:'Bebas Neue',sans-serif;font-size:3.4cqw;
  letter-spacing:.08em;padding:1.1cqw 2.6cqw;border-radius:.9cqw;box-shadow:0 1.1cqw 2.6cqw rgba(0,0,0,.4)}
.ppm .pw7 .hero{position:absolute;z-index:50;left:50%;top:41%;transform:translate(-50%,-50%)}
.ppm .pw7 .logo-card{width:52cqw;background:var(--cream);border-radius:2.6cqw;padding:3.4cqw;
  transform:rotate(-2deg);box-shadow:0 4.4cqw 9cqw rgba(0,0,0,.66)}
.ppm .pw7 .logo-card img,.ppm .pw7 .logo-card svg{width:100%;display:block}
.ppm .pw7 .name-card{position:absolute;z-index:51;left:57%;bottom:-5.2cqw;transform:rotate(3deg);
  background:var(--red);color:var(--on-c1);font-family:'Anton',sans-serif;
  padding:1.2cqw 4cqw 1.5cqw;border-radius:1.3cqw;border:.6cqw solid var(--cream);
  box-shadow:0 2.6cqw 5.6cqw rgba(0,0,0,.55);
  /* BORNÉE. Avec nowrap et sans max-width, la plaque s'étendait vers la droite
     sans limite à mesure que la mascotte s'allongeait, et recouvrait le
     médaillon Nexus — fixe à left:76%. Mesuré : 22 % sur « CNDF », 69 % sur
     « PHÉNIX », et 100 % sur un nom de treize lettres. Elle se replie
     maintenant au lieu de déborder. */
  max-width:26cqw;text-align:center;line-height:1.05}
`;
