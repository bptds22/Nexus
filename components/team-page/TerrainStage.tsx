"use client";

// components/team-page/TerrainStage.tsx
// Scène terrain : le décor est DESSINÉ (SVG), incliné via perspective+rotateX sur
// .scene seulement. Plaques 2D plates (.tk) par-dessus — jamais de texte
// transformé. Variante .flat = pas de bascule (baseball, voir plus bas).
//
// ── PLUS DE PHOTO ────────────────────────────────────────────────────────────
// Les /terrains/*.jpg ont été retirés du rendu : une photo stock impose sa
// propre palette et jure avec la couleur de chaque école. Le terrain dessiné,
// lui, EST du système — surface crème, tracé à la couleur du collège. Les
// fichiers restent sur disque, plus rien ne les référence.
// Conséquence directe : plus d'état `imgError`, plus de repli `.ph`, plus de
// normalisation de luminance par sport. Un SVG ne peut pas 404.
//
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  L'ÉCOLE POSSÈDE LE TERRAIN. LA PLATEFORME POSSÈDE L'ÉCHELLE.             ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
//
// Le TERRAIN — papier, tracé, verges, filigrane — porte les couleurs du collège.
// C'est un signe d'APPARTENANCE : la page doit être la sienne.
//
// L'ÉCHELLE DES BESOINS — les quatre plaques et la légende — porte le
// vocabulaire Nexus, et lui seul : urgent rouge #E63946, élevé ambre #F59E0B,
// moyen neutre, complet éteint. C'est un instrument de COMPARAISON entre
// collèges, et un instrument de comparaison ne peut pas changer d'unité d'un
// collège à l'autre.
//
// Ce n'est pas un choix esthétique, c'est une mesure. Une échelle teintée par
// l'école a été essayée et chiffrée : les deux distinctions qu'elle fait porter
// à la primaire sont ANTI-CORRÉLÉES, et aucune couleur d'école ne les sauve
// toutes les deux.
//   · primaire foncée (#A6192E, 60 collèges) → l'aplat « urgent » éclate à
//     6,65:1 sur le papier, mais les bordures « élevé » et « moyen » tombent à
//     1,85:1 — deux foncés voisins, indiscernables.
//   · primaire claire (#d0a62d, CNDF) → les bordures se séparent à 3,14:1, mais
//     l'aplat « urgent » se dissout dans le papier à 2,03:1. Pire encore sur un
//     jaune pâle : 1,14:1, l'état rempli devient invisible.
// S'y ajoutait un contresens de lecture : l'or veut dire « attention » là où le
// rouge veut dire « critique ». Un athlète enchaînant deux collèges lisait
// l'urgence du second comme plus faible, à niveau égal.
//
// Donc : ne JAMAIS écrire --red, --c1-cream ou --ink sur une plaque ni sur une
// pastille de légende. Et ne jamais écrire une valeur de l'échelle dans le SVG.
//
// ── CE QUI N'A PAS BOUGÉ ─────────────────────────────────────────────────────
// La GÉOMÉTRIE : .scene{perspective:840px}, .imgwrap{rotateX(44deg)}. Le SVG
// remplace l'image DANS .imgwrap, pas la mise en perspective.
// Les COORDONNÉES : les plaques vivent dans .tokens (inset 0 du .stage), qui
// n'est pas transformé. Changer le décor ne déplace AUCUNE plaque — le zéro
// chevauchement mesuré sur les 5 facettes de football et flag est intact par
// construction.
// Le CONTENU des plaques : acronyme, nom du groupe, niveau.
//
// ── LECTURE DU DESSIN ────────────────────────────────────────────────────────
// Chaque terrain est vu de DESSUS, le fond du terrain en haut (y=0) et le
// devant en bas (y=180) : après rotateX autour du bord bas, le haut s'enfonce
// vers l'horizon. C'est ce qui aligne le dessin sur la logique des plaques, où
// « plus haut » veut dire « plus loin ». Les tracés existants de CourtSvg
// étaient en paysage (buts à gauche et à droite) alors que les plaques sont en
// colonne — un désaccord invisible tant que la photo passait devant, et qui le
// devient dès que le trait est net. Ils ont été redessinés en conséquence.

import * as React from "react";
import { LEVEL_LABEL, type Level, type Plaque, type TeamData } from "./content";

/** Ordre de lecture de la légende : du plus urgent au complet. */
const NIVEAUX: readonly Level[] = ["pri", "hi", "mid", "full"];

export default function TerrainStage({
  perspective,
  sportKey,
  plaques,
  watermark,
}: {
  perspective: boolean;
  sportKey?: TeamData["sportKey"];
  plaques: Plaque[];
  /** Nom (ou surnom) du collège, posé en filigrane dans la zone des buts. */
  watermark?: string | null;
}) {
  return (
    <>
      <div className="stage">
        <div className={perspective ? "scene" : "scene flat"}>
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
   LES TERRAINS DESSINÉS

   Aucune couleur en dur : la surface est --pitch, tout le tracé --c1-cream (la
   primaire de l'école ramenée au plancher de lisibilité sur du clair, la même
   valeur que le mur emploie pour écrire la primaire sur une tuile crème).
   `preserveAspectRatio="none"` : le dessin épouse la boîte, comme le faisait la
   photo. Les traits gardent leur épaisseur grâce à vector-effect.
   ═══════════════════════════════════════════════════════════════════════════ */

const TRAIT = "var(--c1-cream)";

/** Attributs communs à tous les tracés de ligne. */
const LIGNE = {
  fill: "none",
  stroke: TRAIT,
  strokeWidth: 1.4,
  vectorEffect: "non-scaling-stroke",
} as const;

function Filigrane({ texte, x, y, taille }: { texte: string; x: number; y: number; taille: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={TRAIT}
      opacity={0.35}
      fontFamily="'Anton', sans-serif"
      fontSize={taille}
      letterSpacing={taille * 0.14}
    >
      {texte}
    </text>
  );
}

function PitchSvg({ sportKey, watermark }: { sportKey?: TeamData["sportKey"]; watermark?: string | null }) {
  // Le filigrane est coupé court : une raison sociale de 43 caractères
  // (« Centre d'études collégiales de la Matapédie ») ne tient dans aucune zone
  // de but. Le surnom, quand il existe, est déjà court côté appelant.
  const nom = (watermark ?? "").trim().toUpperCase().slice(0, 18);

  if (sportKey === "baseball") return <BaseballPitch nom={nom} />;
  if (sportKey === "soccer") return <SoccerPitch nom={nom} />;
  if (sportKey === "volleyball") return <VolleyPitch nom={nom} />;
  if (sportKey === "basketball") return <BasketPitch nom={nom} />;
  if (sportKey === "hockey") return <HockeyPitch nom={nom} />;
  // football ET flag : même tracé, comme ils partageaient déjà la même photo.
  return <FootballPitch nom={nom} />;
}

/** Cadre commun aux six terrains rectangulaires (vue de dessus, 16/9). */
function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <svg className="court" viewBox="0 0 320 180" preserveAspectRatio="none" aria-hidden focusable="false">
      <rect width="320" height="180" fill="var(--pitch)" />
      {children}
    </svg>
  );
}

/* ── FOOTBALL et FLAG ──────────────────────────────────────────────────────
   Zones de but en haut et en bas, verges tous les 10, ligne de 50 plus épaisse,
   hachures sur les deux rangs réglementaires. Les numéros longent les lignes de
   touche, des deux côtés. */
function FootballPitch({ nom }: { nom: string }) {
  const HAUT = 15, BAS = 165;            // limites du terrain de 100 verges
  const PAS = (BAS - HAUT) / 10;         // une tranche de 10 verges
  const lignes = Array.from({ length: 11 }, (_, i) => HAUT + i * PAS);
  const numeros = [10, 20, 30, 40, 50, 40, 30, 20, 10];
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="10" y={HAUT} width="300" height={BAS - HAUT} />
        {/* zones de but */}
        <rect x="10" y="2" width="300" height={HAUT - 2} />
        <rect x="10" y={BAS} width="300" height={178 - BAS} />
        {lignes.map((y) => (
          <line key={y} x1="10" y1={y} x2="310" y2={y} strokeWidth={Math.abs(y - 90) < 0.5 ? 2.6 : 1.4} />
        ))}
        {/* hachures : deux rangs, un repère toutes les 5 verges */}
        {Array.from({ length: 21 }, (_, i) => HAUT + (i * (BAS - HAUT)) / 20).map((y) => (
          <React.Fragment key={y}>
            <line x1="112" y1={y} x2="124" y2={y} />
            <line x1="196" y1={y} x2="208" y2={y} />
          </React.Fragment>
        ))}
      </g>
      <g fill={TRAIT} opacity="0.45" fontFamily="'Anton', sans-serif" fontSize="11" textAnchor="middle">
        {numeros.map((n, i) => {
          const y = HAUT + (i + 1) * PAS + 4;
          return (
            <React.Fragment key={i}>
              <text x="30" y={y}>{n}</text>
              <text x="290" y={y}>{n}</text>
            </React.Fragment>
          );
        })}
      </g>
      {nom ? <Filigrane texte={nom} x={160} y={175} taille={9} /> : null}
    </Cadre>
  );
}

/* ── SOCCER ────────────────────────────────────────────────────────────────
   Buts en HAUT et en BAS : les plaques sont en colonne (attaque en haut,
   gardien en bas), le tracé les suit. */
function SoccerPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="16" y="8" width="288" height="164" />
        <line x1="16" y1="90" x2="304" y2="90" />
        <ellipse cx="160" cy="90" rx="46" ry="26" />
        {/* surfaces de réparation et de but, en haut puis en bas */}
        <rect x="82" y="8" width="156" height="30" />
        <rect x="126" y="8" width="68" height="13" />
        <rect x="82" y="142" width="156" height="30" />
        <rect x="126" y="159" width="68" height="13" />
      </g>
      <circle cx="160" cy="90" r="2" fill={TRAIT} />
      {nom ? <Filigrane texte={nom} x={160} y={166} taille={8} /> : null}
    </Cadre>
  );
}

/* ── VOLLEYBALL ────────────────────────────────────────────────────────────
   Le filet est en HAUT : les cinq plaques occupent une seule moitié (28 % à
   66 %), donc on montre le demi-terrain de l'équipe, filet au fond. */
function VolleyPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="52" y="22" width="216" height="150" />
        {/* ligne d'attaque à 3 m du filet */}
        <line x1="52" y1="62" x2="268" y2="62" />
      </g>
      {/* filet : trait plein doublé d'un pointillé, au fond du terrain */}
      <line x1="40" y1="22" x2="280" y2="22" stroke={TRAIT} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      <line x1="40" y1="15" x2="280" y2="15" stroke={TRAIT} strokeWidth="1.2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      {nom ? <Filigrane texte={nom} x={160} y={166} taille={8} /> : null}
    </Cadre>
  );
}

/* ── BASKETBALL ────────────────────────────────────────────────────────────
   Demi-terrain, panier en HAUT : meneur au sommet, pivot près du cercle — les
   plaques décrivent une attaque placée, pas un terrain complet. */
function BasketPitch({ nom }: { nom: string }) {
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="24" y="8" width="272" height="164" />
        {/* raquette + cercle de lancer franc */}
        <rect x="122" y="8" width="76" height="72" />
        <ellipse cx="160" cy="80" rx="38" ry="21" />
        {/* arc à trois points, ouvert vers le bas */}
        <path d="M44 8 L44 46 A116 74 0 0 0 276 46 L276 8" />
        {/* panneau et cercle */}
        <line x1="136" y1="14" x2="184" y2="14" strokeWidth="2.4" />
        <ellipse cx="160" cy="22" rx="9" ry="5" />
        {/* ligne médiane, au bas du demi-terrain */}
        <line x1="24" y1="172" x2="296" y2="172" />
      </g>
      {nom ? <Filigrane texte={nom} x={160} y={162} taille={8} /> : null}
    </Cadre>
  );
}

/* ── HOCKEY ────────────────────────────────────────────────────────────────
   Patinoire en hauteur, coins arrondis, but adverse en haut et le sien en bas :
   centre et ailiers devant, défenseurs derrière, gardien au fond. */
function HockeyPitch({ nom }: { nom: string }) {
  const cercle = (cx: number, cy: number) => (
    <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="26" ry="15" {...LIGNE} />
  );
  return (
    <Cadre>
      <g {...LIGNE}>
        <rect x="14" y="6" width="292" height="168" rx="42" ry="30" />
        {/* lignes de but */}
        <line x1="34" y1="24" x2="286" y2="24" />
        <line x1="34" y1="156" x2="286" y2="156" />
        {/* bleues */}
        <line x1="14" y1="62" x2="306" y2="62" strokeWidth="2.6" />
        <line x1="14" y1="118" x2="306" y2="118" strokeWidth="2.6" />
        {/* rouge centrale */}
        <line x1="14" y1="90" x2="306" y2="90" strokeWidth="2.6" strokeDasharray="6 4" />
        <ellipse cx="160" cy="90" rx="26" ry="15" />
        {/* mises en jeu de zone */}
        {[[78, 40], [242, 40], [78, 140], [242, 140]].map(([x, y]) => cercle(x, y))}
        {/* demi-cercles de but */}
        <path d="M142 24 A18 11 0 0 1 178 24" />
        <path d="M142 156 A18 11 0 0 0 178 156" />
      </g>
      {nom ? <Filigrane texte={nom} x={160} y={170} taille={8} /> : null}
    </Cadre>
  );
}

/* ── BASEBALL — À PLAT, et c'est délibéré ──────────────────────────────────
   Seul sport dont la surface n'est pas un rectangle. Sous rotateX(44deg) le
   haut du décor est écrasé vers l'horizon, alors que les plaques, elles, ne
   sont PAS transformées : elles restent à leurs pourcentages. Sur un rectangle
   l'écart ne se voit pas — le terrain occupe toute la largeur à toute
   profondeur. Sur un losange, la surface utile est une chandelle, étroite au
   marbre et large au champ extérieur, et c'est justement le haut, là où sont
   les voltigeurs, que la transformation écrase le plus. Une photo masquait le
   décalage (rien d'assez net pour la contredire) ; un tracé net le montre —
   une plaque « 3E BUT » visiblement à côté du coussin est une faute lisible.
   Preuve que l'alignement se battait déjà : baseball était le SEUL sport à
   porter un recadrage manuel, scale(1.34) translateY(2%).

   À plat, la scène couvre exactement le .stage et le viewBox est en CENTIÈMES :
   x=50 tombe à 50 % de la largeur, y=88 à 88 % de la hauteur. Le dessin partage
   donc le repère des plaques, au lieu de le subir. Les coussins sont posés sous
   les coordonnées existantes de SPORT_CONFIGS, qui n'ont pas bougé. */
function BaseballPitch({ nom }: { nom: string }) {
  // Repères posés SOUS les coordonnées de SPORT_CONFIGS, vérifiés un à un :
  //   marbre (50,90) sous C (50,88) · monticule (50,68) sous P (50,62)
  //   coussins 1B (76,70) et 3B (24,70), les joueurs jouant écartés du sac
  //   à (82,64) et (18,64) — c'est leur position réelle, pas une erreur
  //   coussin 2B (50,44), encadré par SS (30,40) et 2B (70,40)
  // La clôture culmine à y=7 pour que CF (50,16) reste DANS le parc : le premier
  // tracé la posait à y=22 et plaçait le voltigeur de centre par-dessus.
  const MARBRE = { x: 50, y: 90 };
  const bases = [
    { x: 76, y: 70 }, // 1er but
    { x: 50, y: 44 }, // 2e but
    { x: 24, y: 70 }, // 3e but
  ];
  return (
    <svg className="court flat" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden focusable="false">
      <rect width="100" height="100" fill="var(--pitch)" />
      <g {...LIGNE}>
        {/* lignes de faute, du marbre vers les poteaux */}
        <path d={`M${MARBRE.x} ${MARBRE.y} L2 40`} />
        <path d={`M${MARBRE.x} ${MARBRE.y} L98 40`} />
        {/* clôture du champ extérieur — sommet à y=7 */}
        <path d="M2 40 Q50 -26 98 40" />
        {/* losange */}
        <path d={`M${MARBRE.x} ${MARBRE.y} L76 70 L50 44 L24 70 Z`} />
        {/* Limite de l'avant-champ, sommet à y=33. Compromis assumé : les
            coordonnées de SPORT_CONFIGS ne sont pas à l'échelle d'un vrai
            terrain — elles posent SS et 2B à y=40, soit aux deux tiers du
            chemin vers la clôture, une profondeur de voltigeur. Avec cet arc,
            3B et 1B tombent sur la terre battue ; SS et 2B restent 4 unités
            au-delà. Les faire rentrer tous les quatre demandait un sommet à
            y=22, qui avalait le champ extérieur (la clôture culmine à 7) et
            donnait un terrain faux. Corriger proprement voudrait dire déplacer
            les plaques — ce que le ticket interdit, à raison. */}
        <path d="M10 80 Q50 -14 90 80" strokeDasharray="3 3" />
        {/* monticule */}
        <ellipse cx="50" cy="68" rx="5" ry="4" />
      </g>
      <g fill={TRAIT}>
        {bases.map((b) => (
          <rect key={`${b.x}-${b.y}`} x={b.x - 2} y={b.y - 2} width="4" height="4" />
        ))}
        <path d={`M${MARBRE.x - 2.6} ${MARBRE.y - 2.6} h5.2 v2.6 l-2.6 2.6 l-2.6 -2.6 z`} />
      </g>
      {/* Le baseball n'a pas de zone des buts. Le filigrane va donc dans la seule
          bande vraiment vide : le champ centre, entre la plaque CF (qui descend à
          26,5 %) et la limite de l'avant-champ (35 %). Derrière le marbre, il
          serait passé SOUS la plaque du receveur. */}
      {nom ? <Filigrane texte={nom} x={50} y={32} taille={4.6} /> : null}
    </svg>
  );
}
