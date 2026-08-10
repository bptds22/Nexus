"use client";

// components/team-page/TerrainStageMobile.tsx
//
// LE TERRAIN DU RENDU NATIF. Fichier SÉPARÉ de TerrainStage.tsx, qui sert la
// page équipe WEB — et la séparation est le point, pas un détail d'organisation.
//
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  DEUX FICHIERS, PARCE QUE DEUX ÉCRANS AUX CONTRAINTES OPPOSÉES.           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
//
// Le web dispose de plus de mille pixels : une photo réelle inclinée en
// perspective y est lisible et les postes peuvent garder leur placement réel.
// Le mobile n'a que 354px : la photo devient une texture illisible sous les
// plaques, la perspective tasse le tracé sur le dernier tiers, et le placement
// réel produit des chevauchements. Les deux réponses sont justes, chacune chez
// elle — et incompatibles.
//
// Un seul composant à deux branches (prop `variant`, ou garde IS_CAPACITOR)
// aurait laissé les deux rendus dans le même fichier : toucher au mobile aurait
// continué de risquer le web, ce qui est précisément ce qui vient d'arriver.
// Deux fichiers rendent l'accident IMPOSSIBLE, pas seulement improbable.
//
// ── CE QUI RESTE PARTAGÉ ─────────────────────────────────────────────────────
// Le SENS, et lui seul : les quatre niveaux, leurs libellés (LEVEL_LABEL) et la
// couleur de l'échelle de plateforme. Un athlète qui passe du téléphone au
// navigateur doit lire le même système. Seule la GÉOMÉTRIE diverge.
// La contrepartie assumée : une correction de rendu utile aux deux devra être
// portée deux fois. C'est le prix de l'isolement, et il est plus faible que
// celui d'un web qui bouge à chaque retouche mobile.
//
// ── LE TERRAIN ───────────────────────────────────────────────────────────────
import * as React from "react";
import { LEVEL_LABEL, type Level, type Plaque, type TeamData } from "./content";

/** Ordre de lecture de la légende : du plus urgent au complet. */
const NIVEAUX: readonly Level[] = ["pri", "hi", "mid", "full"];

export default function TerrainStageMobile({
  sportKey,
  plaques,
  watermark,
}: {
  sportKey?: TeamData["sportKey"];
  plaques: Plaque[];
  /** Nom (ou surnom) du collège, posé en filigrane dans la zone des buts. */
  watermark?: string | null;
}) {
  return (
    <>
      <div className="stage">
        <div className="scene">
          <div className="imgwrap">
            <PitchSvg sportKey={sportKey} watermark={watermark} />
          </div>
        </div>
        <div className="tokens">
          {plaques.map((p, i) => (
            // Plaque = INITIALES en gros (Anton) + nom du groupe + niveau, comme le
            // spec éditeur : l'athlète lit d'abord le poste, à distance.
            <div key={i} className={`tk ${p.level}`} style={{ left: `${p.left}%`, top: `${p.top}%` }}>
              <div className="pl">
                {p.acro && <div className="pa">{p.acro}</div>}
                <div className="po">{p.label}</div>
                <div className="pn">{p.levelLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* La légende dit ce que les quatre traitements de plaque veulent dire.
          Les libellés viennent de LEVEL_LABEL — la même source que les plaques,
          donc jamais deux vocabulaires qui divergent. */}
      <ul className="tlegend" aria-label="Échelle des besoins">
        {NIVEAUX.map((n) => (
          <li key={n} className={n}>
            <span className="lg-dot" aria-hidden />
            {LEVEL_LABEL[n]}
          </li>
        ))}
      </ul>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LES TERRAINS DESSINÉS — À PLAT, EN POURCENTAGES

   ── UN SEUL REPÈRE ──────────────────────────────────────────────────────────
   Chaque terrain est tracé dans un viewBox `0 0 100 100` avec
   `preserveAspectRatio="none"`. Le SVG épouse donc le cadre, et x=50 tombe
   exactement à 50 % de sa largeur, y=88 à 88 % de sa hauteur. C'est LE MÊME
   repère que les plaques, qui sont posées en `left:%` / `top:%` sur `.tokens`.
   « La plaque tombe-t-elle sur le terrain » devient une question d'arithmétique,
   plus une question d'œil.

   ── POURQUOI LE CADRE NE CHANGE PAS DE RAPPORT ──────────────────────────────
   Il reste 354 × 430 (portrait, 0,823). Trois raisons :
     · les seuils de non-collision mesurés — 96/354 = 27,1 % en largeur et
       90/430 = 20,9 % en hauteur — ne tiennent que si NI la largeur NI la
       hauteur ne bougent. Changer le cadre obligeait à tout reprendre ;
     · les plaques occupent y de 14 % à 88 % : un cadre plus large et plus court
       les tasserait verticalement, là où elles ont le moins de marge ;
     · le tracé n'a plus besoin d'un rapport « réel » puisqu'il ne simule plus une
       vue en perspective. Il est stylisé, comme un schéma de diffusion.
   La contrepartie assumée : les proportions ne sont pas à l'échelle
   réglementaire. Un terrain de football fait 0,44 dans la vraie vie, pas 0,82.
   `vector-effect="non-scaling-stroke"` empêche l'étirement d'épaissir les traits
   dans un sens plus que dans l'autre.

   ── LA SURFACE REMPLIT TOUT ─────────────────────────────────────────────────
   Le fond du SVG couvre 0→100 dans les deux axes : aucune plaque ne peut tomber
   « dans le vide ». Les LIGNES, elles, sont posées en retrait (4 → 96), comme
   des lignes de touche. Une plaque proche du bord chevauche donc la ligne — un
   joueur près de la touche, pas une plaque hors terrain.

   Aucune couleur en dur : surface --pitch, tracé --pitch-line, encre
   --pitch-ink. Le tracé est BLANC translucide et jamais rouge — le rouge est
   réservé à l'échelle des besoins (voir le bloc palette de content.ts).
   ═══════════════════════════════════════════════════════════════════════════ */

const TRAIT = "var(--pitch-line)";
const ENCRE = "var(--pitch-ink)";

/** Attributs communs à tous les tracés. `vector-effect` est posé en CSS et non
 *  ici : Chrome ne l'hérite pas d'un <g>, et l'étirement du viewBox épaississait
 *  alors les lignes horizontales 4× plus que les verticales. */
const LIGNE = { fill: "none", stroke: TRAIT, strokeWidth: 1.2 } as const;

/* Le filigrane est posé à y=99, taille 3,4, pour TOUS les sports. Ce n'est pas
 * un réglage esthétique mais une contrainte géométrique :
 *   · la rangée de plaques la plus basse est à 84 %, demi-hauteur 11,6 % → rien
 *     ne descend sous 95,6 % ;
 *   · une ligne de base à 99 place le HAUT des capitales vers 96,5 — au-dessous.
 * À y=96 le texte remontait à 92,9 et passait DERRIÈRE la plaque : invisible
 * sous une plaque pleine, et parasite sous une plaque fantôme, où il
 * transparaissait au milieu du libellé. Vu à la capture sur « P · BOTTEUR DÉG. ».
 * Le seul cas plus bas est le gardien de soccer (86 %, bas à 97,6) : il est en
 * colonne 17, le filigrane est centré en 50, aucun recouvrement horizontal. */
function Filigrane({ texte, x, y, taille }: { texte: string; x: number; y: number; taille: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={ENCRE}
      opacity={0.38}
      fontFamily="'Anton', sans-serif"
      fontSize={taille}
      letterSpacing={taille * 0.14}
    >
      {texte}
    </text>
  );
}

function PitchSvg({ sportKey, watermark }: { sportKey?: TeamData["sportKey"]; watermark?: string | null }) {
  // Coupé court : une raison sociale de 43 caractères ne tient sur aucun terrain.
  const nom = (watermark ?? "").trim().toUpperCase().slice(0, 18);

  if (sportKey === "baseball") return <BaseballPitch nom={nom} />;
  if (sportKey === "soccer") return <SoccerPitch nom={nom} />;
  if (sportKey === "volleyball") return <VolleyPitch nom={nom} />;
  if (sportKey === "basketball") return <BasketPitch nom={nom} />;
  if (sportKey === "hockey") return <HockeyPitch nom={nom} />;
  return <FootballPitch nom={nom} />;
}

/** Cadre commun : la surface remplit le cadre, les lignes vivent en retrait. */
function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <svg className="court" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      <rect width="100" height="100" fill="var(--pitch)" />
      {children}
    </svg>
  );
}

/* ═══ LE TRACÉ EST DÉLIBÉRÉMENT PAUVRE ══════════════════════════════════════
   À 354px de large, un terrain réglementaire complet devient du bruit : la
   version précédente empilait verges tous les 10, hachures sur deux rangs et
   numéros des DEUX côtés, et les numéros traversaient les plaques de bord.
   Critère unique retenu : le sport doit être reconnaissable au premier coup
   d'œil. Ne subsiste donc que ce qui SIGNE le sport — les lignes bleues au
   hockey, le losange au baseball, l'arc à trois points au basketball — plus le
   cadre et la ligne médiane. Tout le reste est parti :
     · football  — hachures retirées, numéros sur UN seul côté
     · soccer    — surfaces de but (les petits rectangles) retirées
     · basket    — panneau et cercle retirés
     · hockey    — quatre cercles d'engagement retirés, créases conservés
     · baseball  — limite d'avant-champ retirée
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── FOOTBALL et FLAG — verges à l'horizontale, jeu vertical. */
function FootballPitch({ nom }: { nom: string }) {
  const HAUT = 14, BAS = 86;
  const PAS = (BAS - HAUT) / 10;
  const lignes = Array.from({ length: 11 }, (_, i) => HAUT + i * PAS);
  const numeros = [10, 20, 30, 40, 50, 40, 30, 20, 10];
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="4" y={HAUT} width="92" height={BAS - HAUT} />
        <rect x="4" y="4" width="92" height={HAUT - 4} />
        <rect x="4" y={BAS} width="92" height={96 - BAS} />
        {lignes.map((y) => (
          <line key={y} x1="4" y1={y} x2="96" y2={y} strokeWidth={y === 50 ? 2.4 : 1.2} />
        ))}
      </g>
      {/* LES NUMÉROS DE VERGES ONT ÉTÉ RETIRÉS. §2 prévoyait de les passer en
          gris moyen ; la capture a montré qu'ils sont irrécupérables à cette
          taille. Les plaques occupent les trois colonnes 17 / 50 / 83, chacune
          large de 31,6 % : il ne reste aucune bande verticale libre où poser une
          colonne de chiffres, et ils passaient sous la plaque de gauche à toutes
          les positions. Le critère de §3 tranche — le football reste reconnu au
          premier coup d'œil par ses verges tous les 10, sa ligne de 50 épaissie
          et ses deux zones de but. Les chiffres n'ajoutaient rien qu'ils ne
          disaient déjà. --pitch-ink sert encore au filigrane. */}
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}

/* ── SOCCER — buts en haut et en bas, les plaques sont en colonne. */
function SoccerPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="6" y="4" width="88" height="92" />
        <line x1="6" y1="50" x2="94" y2="50" />
        <ellipse cx="50" cy="50" rx="15" ry="10" />
        <rect x="26" y="4" width="48" height="16" />
        <rect x="26" y="80" width="48" height="16" />
      </g>
      <circle cx="50" cy="50" r="1.1" fill={TRAIT} />
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}

/* ── VOLLEYBALL — filet en HAUT : les plaques tiennent dans une seule moitié. */
function VolleyPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="10" y="10" width="80" height="86" />
        <line x1="10" y1="32" x2="90" y2="32" />
      </g>
      <line x1="4" y1="10" x2="96" y2="10" stroke={TRAIT} strokeWidth="2.6" />
      <line x1="4" y1="5" x2="96" y2="5" stroke={TRAIT} strokeWidth="1" strokeDasharray="2 2" />
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}

/* ── BASKETBALL — demi-terrain, panier en HAUT. L'arc à trois points signe. */
function BasketPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="6" y="4" width="88" height="92" />
        <rect x="37" y="4" width="26" height="34" />
        <ellipse cx="50" cy="38" rx="13" ry="9" />
        <path d="M14 4 L14 26 A40 34 0 0 0 86 26 L86 4" />
      </g>
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}

/* ── HOCKEY — les deux lignes bleues signent la patinoire à elles seules. */
function HockeyPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="4" y="3" width="92" height="94" rx="20" ry="14" />
        <line x1="14" y1="13" x2="86" y2="13" />
        <line x1="14" y1="87" x2="86" y2="87" />
        <line x1="4" y1="33" x2="96" y2="33" strokeWidth="2.2" />
        <line x1="4" y1="67" x2="96" y2="67" strokeWidth="2.2" />
        <line x1="4" y1="50" x2="96" y2="50" strokeWidth="2.2" strokeDasharray="4 3" />
        <ellipse cx="50" cy="50" rx="13" ry="9" />
        <path d="M42 13 A9 6 0 0 1 58 13" />
        <path d="M42 87 A9 6 0 0 0 58 87" />
      </g>
      {/* y=92 et non 95 : à 95 le filigrane passait sous le coin arrondi. */}
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}

/* ── BASEBALL — le seul terrain qui n'est pas un rectangle ─────────────────
   Repères posés sous les coordonnées de SPORT_CONFIGS :
     marbre (50,90) sous C (50,88) · monticule (50,68) sous P (50,62)
     coussins 1B (76,70) et 3B (24,70), les joueurs jouant écartés du sac
     coussin 2B (50,44), encadré par SS (30,40) et 2B (70,40)
   La clôture culmine à y=7 pour que CF (50,16) reste dans le parc. */
function BaseballPitch({ nom }: { nom: string }) {
  const MARBRE = { x: 50, y: 90 };
  const bases = [{ x: 76, y: 70 }, { x: 50, y: 44 }, { x: 24, y: 70 }];
  return (
    <Cadre>
      <g {...LIGNE}>
        <path d={`M${MARBRE.x} ${MARBRE.y} L2 40`} />
        <path d={`M${MARBRE.x} ${MARBRE.y} L98 40`} />
        <path d="M2 40 Q50 -26 98 40" />
        <path d={`M${MARBRE.x} ${MARBRE.y} L76 70 L50 44 L24 70 Z`} />
        <ellipse cx="50" cy="68" rx="5" ry="4" />
      </g>
      <g fill={TRAIT}>
        {bases.map((b) => (
          <rect key={`${b.x}-${b.y}`} x={b.x - 2} y={b.y - 2} width="4" height="4" />
        ))}
        <path d={`M${MARBRE.x - 2.6} ${MARBRE.y - 2.6} h5.2 v2.6 l-2.6 2.6 l-2.6 -2.6 z`} />
      </g>
      {/* y=20 : au-dessus des plaques d'avant-champ (dont le haut est à 29 %) et
          sous celle du voltigeur de centre. La seule bande libre. */}
      {nom ? <Filigrane texte={nom} x={50} y={99} taille={3.4} /> : null}
    </Cadre>
  );
}
