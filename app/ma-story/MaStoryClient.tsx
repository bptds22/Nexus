"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ma-story.module.css";

/* ═══════════════════════════════════════════════════════════════
   /ma-story — 8 gabarits de story Instagram, composés au canvas.

   Port 1:1 de la référence validée ma-story.html
   (sha256 01506397aa66855fd8d2bf823c02f63e41883c7c770ddd2e230e5f85d97062cd).
   Coordonnées, couleurs, dégradés, grain, seeds pseudo-aléatoires :
   identiques. Ce qui suit ne liste QUE les écarts, chacun demandé.

   ── ÉCART 1 — les fontes viennent du site ─────────────────────
   La référence charge Anton par <link> Google Fonts et Outfit par
   quatre .ttf locaux. Ici, next/font : Outfit (400→800) par la route
   (page.tsx, var --font-story), Anton par le layout racine
   (--font-anton). next/font produit des noms de famille hachés
   (__Outfit_a1b2c3…) : on les lit à l'exécution via getComputedStyle,
   puis on attend document.fonts.load() GRAISSE PAR GRAISSE avant de
   peindre. Sans cette attente, le premier rendu tombe en Impact et
   toutes les largeurs mesurées sont fausses.

   ── ÉCART 2 — aucune photo de démonstration ───────────────────
   La référence embarque trois JPG de 47 Mio et en charge un au
   démarrage puis à chaque changement d'onglet. Ils ne sont pas portés.
   Sans photo, `pp()` remplit la zone en #1A1D24 — le gabarit se lit,
   la zone photo est visiblement vide, et le téléchargement est éteint.

   ── ÉCART 3 — un champ vide ne peint rien ─────────────────────
   La référence peignait « TON NOM », « — » et « MON ÉQUIPE » quand le
   champ était vide. Sur un PNG exporté, ces replis deviennent le texte
   que l'athlète publie. Ils sont retirés : chaque bloc concerné est
   sous condition. Seule exception assumée, la ligue de la jaquette
   (voir T.jaquette).

   ── ÉCART 4 — aucune étoile, aucune cote ──────────────────────
   La référence portait un champ « Ton nombre d'étoiles » et peignait
   cinq étoiles dorées sous le nom du gabarit « Vois mon profil » —
   celui qui affiche « MON PROFIL EST SUR NEXUS ». Une story montrant
   quatre étoiles dorées à côté du wordmark, c'est une évaluation Nexus
   fabriquée par l'athlète lui-même. Le champ, le rendu et le helper
   star() sont supprimés. Aucune note, cote, étoile ou score ne doit
   apparaître sur un gabarit, jamais.

   ── ÉCART 5 — la jaquette existe pour de vrai ─────────────────
   Le gabarit T.jaquette était écrit et fonctionnel dans la référence,
   mais absent de TPL_META et de FILE_NAMES : invisible dans le
   sélecteur, et le téléchargement aurait produit
   « nexus-story-undefined.png ». Rétabli dans les deux tables.

   ── ÉCART 6 — la boîte de position revient ────────────────────
   Voir T.jaquette.

   ── CE QUI NE CHANGE PAS ──────────────────────────────────────
   100 % client. La photo est lue par URL.createObjectURL, composée au
   canvas, exportée par toBlob. Aucun fetch, aucun stockage, aucune
   dépendance. Les seules requêtes réseau sont les GET same-origin des
   quatre actifs /brand/.
═══════════════════════════════════════════════════════════════ */

type Tpl =
  | "match"
  | "resultat"
  | "stats"
  | "equipe"
  | "post"
  | "profil"
  | "merci"
  | "jaquette";

type Vals = Record<string, string>;

/* ═══ DUOTONE — DOSAGE ═══════════════════════════════════════════════════
   Le duotone d'origine REMPLAÇAIT la couleur du pixel par la rampe d'accent.
   Sur un accent sature (bleu marine, ou une couleur prelevee a la pipette),
   la peau passait entierement dans la teinte : le sujet devenait monochrome
   et le visage se perdait.

   La reference de rendu est l'affiche de programme NCAA : la couleur habite
   les OMBRES et les HAUTES LUMIERES, la carnation reste lisible.

   Deux leviers, exposes ici pour iterer sans relire le pipeline :
     DUO_MIX   — part de duotone dans le melange final (le reste vient de la
                 photo d'origine, desaturee).
     DUO_DESAT — saturation conservee sur cette photo d'origine. 0 = grise,
                 1 = couleurs intactes. Basse volontairement : elle sert a
                 rendre la CARNATION, pas a ramener toute la scene.

   Un TROISIEME levier agit par pixel, et c'est lui qui sauve les visages :
   la ponderation par luminance (voir gradeData). Les tons moyens — la peau
   y vit — recoivent environ moitie moins de duotone que les ombres et les
   hautes lumieres. La courbe est une sinusoide sur la bande [0,30 ; 0,75] :
   aucun seuil dur, donc aucune cassure visible sur un degrade de joue. */
/** Dosage par DEFAUT du duotone. L'athlete le pilote a l'execution avec le
 *  curseur « Intensite de l'effet » ; cette constante n'est plus que le point
 *  de depart du curseur — et le repere auquel la desaturation
 *  d'accompagnement atteint sa pleine valeur (voir gradeData). */
const DUO_MIX = 0.65;
const DUO_DESAT = 0.4;
/** Duotone conserve dans les tons moyens (0,5 = moitie moins qu'aux bords). */
const DUO_MID_RELIEF = 0.5;
/** Bornes de la bande protegee, en luminance normalisee. */
const DUO_SHADOW_END = 0.3;
const DUO_HIGHLIGHT_START = 0.75;

const W = 1080;
const H = 1920;
const BG = "#111317";
const SURF = "#1A1D24";
const MUT = "#9CA3AF";

/* ÉCART 5 — `jaquette` ajoutée en fin de liste (après Merci) dans les
   DEUX tables. La référence l'avait dans DEMO mais pas ici : c'est un
   oubli, pas une décision — le gabarit était complet et correct. */
const TPL_META: [Tpl, string][] = [
  ["match", "Jour de match"],
  ["resultat", "Résultat"],
  ["stats", "Mes stats"],
  ["equipe", "Mon équipe"],
  ["post", "Nouveau post"],
  ["profil", "Vois mon profil"],
  ["merci", "Merci"],
  ["jaquette", "Jaquette de jeu"],
];

const FILE_NAMES: Record<Tpl, string> = {
  match: "jour-de-match",
  resultat: "resultat",
  stats: "mes-stats",
  equipe: "mon-equipe",
  post: "nouveau-post",
  profil: "vois-mon-profil",
  merci: "merci",
  jaquette: "jaquette",
};

const SWATCHES: [string, string][] = [
  ["Rouge Nexus", "#E63946"],
  ["Bleu marine", "#1D3557"],
  ["Vert forêt", "#1F5F3F"],
  ["Or", "#F59E0B"],
  ["Bourgogne", "#7A1F2B"],
  ["Orange", "#E36414"],
  ["Mauve", "#7C5CBF"],
  ["Noir", "#111317"],
];

/* `ABRÉGÉ|LIBELLÉ` — l'abrégé alimente la boîte de position de la
   jaquette, le libellé la sous-ligne. Première option VIDE : sans elle,
   le premier sport de la liste serait sélectionné d'office et la boîte
   peindrait une position que l'athlète n'a jamais choisie. */
const POSITIONS: [string, string][] = [
  ["WR|RECEVEUR", "WR — Receveur"],
  ["QB|QUART-ARRIÈRE", "QB — Quart-arrière"],
  ["RB|PORTEUR", "RB — Porteur de ballon"],
  ["LB|SECONDEUR", "LB — Secondeur"],
  ["DB|DEMI DÉFENSIF", "DB — Demi défensif"],
  ["OL|LIGNE OFFENSIVE", "OL — Ligne offensive"],
  ["G|GARDIEN", "G — Gardien"],
  ["D|DÉFENSEUR", "D — Défenseur"],
  ["C|CENTRE", "C — Centre"],
  ["AD|AILIER DROIT", "AD — Ailier droit"],
  ["AG|AILIER GAUCHE", "AG — Ailier gauche"],
  ["PG|MENEUR", "PG — Meneur"],
  ["SG|ARRIÈRE", "SG — Arrière"],
  ["PF|AILIER FORT", "PF — Ailier fort"],
  ["ATT|ATTAQUANT", "ATT — Attaquant"],
  ["MIL|MILIEU", "MIL — Milieu"],
  ["PAS|PASSEUR", "PAS — Passeur"],
  ["CTR|CENTRAL", "CTR — Central"],
  ["LIB|LIBÉRO", "LIB — Libéro"],
];

const BRAND = {
  wordmark: "/brand/logo-white.png",
  icon: "/brand/icon-white.png",
  iconRed: "/brand/icon-red.png",
  iconBlack: "/brand/icon-black.png",
};

/* ─────────────────────────────────────────────────────────────────
   OUTILS PURS
   ───────────────────────────────────────────────────────────────── */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const up = (s: string) => s.toUpperCase();

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/** PRNG déterministe — le grain et les rayures doivent être identiques
 *  d'un rendu à l'autre, sinon l'aperçu et le PNG exporté diffèrent. */
function mulberry(seed: number) {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(h: string): number[] {
  let s = h.replace("#", "");
  if (s.length === 3) {
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

const mixC = (a: number[], b: number[], t: number) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

type GradeOpts = {
  sat?: number;
  con?: number;
  stops?: number[][];
  cool?: boolean;
  lift?: boolean;
  raw?: boolean;
  /** Dosage du duotone, 0..1. Absent = DUO_MIX. */
  duoMix?: number;
};

function gradeData(d: Uint8ClampedArray, o: GradeOpts) {
  const sat = o.sat ?? 1;
  const con = o.con ?? 1;
  const stops = o.stops;
  const cool = o.cool;
  const lift = o.lift !== false;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (sat !== 1) {
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      b = l + (b - l) * sat;
    }
    if (con !== 1) {
      r = (r - 128) * con + 128;
      g = (g - 128) * con + 128;
      b = (b - 128) * con + 128;
    }
    if (stops) {
      const t = clamp((0.299 * r + 0.587 * g + 0.114 * b) / 255, 0, 1);
      let k = 0;
      while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const A = stops[k];
      const B = stops[k + 1];
      const u = clamp((t - A[0]) / (B[0] - A[0]), 0, 1);
      // la teinte pure, telle que l'ancien pipeline la posait
      const dr = A[1] + (B[1] - A[1]) * u;
      const dg = A[2] + (B[2] - A[2]) * u;
      const db = A[3] + (B[3] - A[3]) * u;

      /* DOSAGE — pilote par le curseur « Intensite de l'effet ».
         `DUO_MIX` n'est plus qu'un defaut ; la valeur vient de l'etat. */
      const mixMax = clamp(o.duoMix ?? DUO_MIX, 0, 1);

      /* La photo d'origine, desaturee — c'est elle qui porte la carnation.
         On repart de la luminance DEJA calculee (t), pas d'un second calcul.

         POURQUOI LA DESATURATION SUIT LE CURSEUR EN DESSOUS DU DEFAUT.
         DUO_DESAT est fixe, mais l'appliquer TOUJOURS rendrait le curseur a
         0 % une photo grisee a 40 % — pas la photo d'origine. Or 0 % doit
         vouloir dire « aucun effet couleur ». La desaturation se retire donc
         progressivement sous le dosage par defaut, et l'atteint pleine a
         partir de lui : a 65 % la sortie est identique au bit pres a celle
         d'avant le curseur, a 0 % la photo est intacte, et au-dessus de 65 %
         seule la part de teinte continue de monter. */
      const accompagnement = clamp(mixMax / DUO_MIX, 0, 1);
      const desatEff = 1 - accompagnement * (1 - DUO_DESAT);
      const lum255 = t * 255;
      const orr = lum255 + (r - lum255) * desatEff;
      const org = lum255 + (g - lum255) * desatEff;
      const orb = lum255 + (b - lum255) * desatEff;

      /* PROTECTION DES TONS MOYENS.
         Pleine teinte dans les ombres et les hautes lumieres ; environ
         moitie moins entre les deux. sin(pi * x) vaut 0 aux deux bornes et
         1 au centre — la ponderation rejoint donc 1 exactement en sortie de
         bande, sans marche. Un seuil dur produirait une arete visible en
         travers d'un front ou d'une joue. */
      let w = 1;
      if (t > DUO_SHADOW_END && t < DUO_HIGHLIGHT_START) {
        const x = (t - DUO_SHADOW_END) / (DUO_HIGHLIGHT_START - DUO_SHADOW_END);
        w = 1 - (1 - DUO_MID_RELIEF) * Math.sin(Math.PI * x);
      }

      const m = mixMax * w;
      r = dr * m + orr * (1 - m);
      g = dg * m + org * (1 - m);
      b = db * m + orb * (1 - m);
    } else {
      if (cool) {
        b += 7;
        r -= 4;
      }
      // noirs ramenés sur #111317 plutôt que sur du noir pur
      if (lift) {
        r = 17 + r * 0.933;
        g = 19 + g * 0.925;
        b = 23 + b * 0.91;
      }
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}

/* Grain procédural, calculé une fois. Volontairement hors du rendu :
   360×640 étiré sur 1080×1920, sans lissage. */
let grainCanvas: HTMLCanvasElement | null = null;
function getGrain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 640;
  const x = c.getContext("2d");
  if (x) {
    const id = x.createImageData(360, 640);
    const d = id.data;
    const rnd = mulberry(42);
    for (let i = 0; i < d.length; i += 4) {
      const v = 95 + rnd() * 115;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
  }
  grainCanvas = c;
  return c;
}

/* ─────────────────────────────────────────────────────────────────
   RENDU
   ───────────────────────────────────────────────────────────────── */

type DrawOpts = {
  tpl: Tpl;
  v: (k: string) => string;
  photo: HTMLImageElement | null;
  wm: HTMLImageElement | null;
  icon: HTMLImageElement | null;
  iconRed: HTMLImageElement | null;
  iconBlack: HTMLImageElement | null;
  fx: number;
  fy: number;
  zoom: number;
  accent: string;
  /** Dosage du duotone, 0..1 — curseur « Intensite de l'effet ». */
  duoMix: number;
  lowRes: boolean;
  antonStack: string;
  outfitStack: string;
  /** Mode pipette : photo brute, sans étalonnage ni habillage. */
  pipette?: boolean;
};

function drawStory(ctx: CanvasRenderingContext2D, o: DrawOpts) {
  const val = o.v;
  const RED = o.accent;

  /* ---- fontes ---- */
  const anton = (px: number) => {
    ctx.font = px + "px " + o.antonStack;
  };
  const outfit = (wt: number, px: number) => {
    ctx.font = wt + " " + px + "px " + o.outfitStack;
  };

  /* ---- couleur d'accent ---- */
  function accInk(): string {
    const c = hexRgb(RED);
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    if (L >= 90) return RED;
    const t = clamp((95 - L) / 140, 0.2, 0.45);
    const m = mixC(c, [255, 255, 255], t);
    return "rgb(" + m.map(Math.round).join(",") + ")";
  }
  const INK = accInk();

  function accDuo(): number[][] {
    const c = hexRgb(RED);
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    const main =
      L > 190
        ? mixC(c, [17, 19, 23], 0.58)
        : L > 150
          ? mixC(c, [17, 19, 23], 0.45)
          : L > 120
            ? mixC(c, [17, 19, 23], 0.25)
            : c;
    const mid = mixC(main, [17, 19, 23], 0.55);
    const hi = mixC(c, [255, 255, 255], 0.82);
    return [
      [0, 17, 19, 23],
      [0.42, ...mid],
      [0.78, ...main],
      [1, ...hi],
    ];
  }

  /* ---- texte ---- */
  function fit(
    text: string,
    build: (px: number) => void,
    maxW: number,
    start: number,
    min?: number,
  ) {
    let s = start;
    build(s);
    while (ctx.measureText(text).width > maxW && s > (min || 24)) {
      s -= 2;
      build(s);
    }
    return s;
  }

  /** Lettre à lettre pour un interlettrage réel — `letterSpacing` du
   *  canvas n'est pas supporté partout. Retourne la largeur totale. */
  function trk(text: string, x: number, y: number, ls: number, align?: string) {
    const cs = [...text];
    const ws = cs.map((c) => ctx.measureText(c).width);
    const tot = ws.reduce((a, b) => a + b, 0) + ls * (cs.length - 1);
    let cx = align === "center" ? x - tot / 2 : align === "right" ? x - tot : x;
    cs.forEach((c, i) => {
      ctx.fillText(c, cx, y);
      cx += ws[i] + ls;
    });
    return tot;
  }

  /** Le point final en couleur d'accent — signature typographique de
   *  la marque, reprise sur six gabarits. */
  function redDot(text: string, x: number, y: number, align?: string) {
    const base = text.endsWith(".") ? text.slice(0, -1) : text;
    const wAll = ctx.measureText(text).width;
    const wBase = ctx.measureText(base).width;
    const x0 = align === "center" ? x - wAll / 2 : x;
    const keep = ctx.fillStyle;
    ctx.fillText(base, x0, y);
    if (base !== text) {
      ctx.fillStyle = INK;
      ctx.fillText(".", x0 + wBase, y);
      ctx.fillStyle = keep;
    }
    return wAll;
  }

  /* ---- photo ---- */
  function pp(w: number, h: number, g: GradeOpts): HTMLCanvasElement {
    const q = o.lowRes ? 0.42 : 1;
    const cw = Math.max(2, Math.round(w * q));
    const ch = Math.max(2, Math.round(h * q));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const x = c.getContext("2d", { willReadFrequently: true });
    if (!x) return c;
    // ÉCART 2 : sans photo, la zone se remplit en surface — le gabarit
    // reste lisible et le vide se voit.
    if (!o.photo) {
      x.fillStyle = SURF;
      x.fillRect(0, 0, cw, ch);
      return c;
    }
    const iw = o.photo.naturalWidth;
    const ih = o.photo.naturalHeight;
    const s = Math.max(cw / iw, ch / ih) * o.zoom;
    const sw = cw / s;
    const sh = ch / s;
    const sx = clamp(clamp(o.fx, 0, 1) * iw - sw / 2, 0, Math.max(0, iw - sw));
    const sy = clamp(clamp(o.fy, 0, 1) * ih - sh / 2, 0, Math.max(0, ih - sh));
    x.imageSmoothingQuality = "high";
    x.drawImage(o.photo, sx, sy, sw, sh, 0, 0, cw, ch);
    if (!g.raw) {
      const id = x.getImageData(0, 0, cw, ch);
      /* Le dosage est injecte ICI, au point de passage unique : les 8
         gabarits gardent leurs options d'etalonnage telles quelles. */
      gradeData(id.data, { ...g, duoMix: o.duoMix });
      x.putImageData(id, 0, 0);
    }
    return c;
  }

  /* ---- traitements ---- */
  function grain(a: number) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "overlay";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(getGrain(), 0, 0, W, H);
    ctx.restore();
  }
  function vignette(a: number) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    g.addColorStop(0, "rgba(17,19,23,0)");
    g.addColorStop(1, "rgba(17,19,23," + a + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function protect(y0: number, peak: number) {
    const g = ctx.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, "rgba(17,19,23,0)");
    g.addColorStop(0.75, "rgba(17,19,23," + peak * 0.85 + ")");
    g.addColorStop(1, "rgba(17,19,23," + peak + ")");
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, H - y0);
  }
  function scratches(seed: number, n: number, a: number) {
    const r = mulberry(seed);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#fff";
    for (let i = 0; i < n; i++) {
      ctx.lineWidth = 0.6 + r() * 1.4;
      ctx.beginPath();
      const x0 = r() * W;
      const y0 = r() * H;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (r() - 0.3) * 500, y0 + (r() - 0.5) * 900);
      ctx.stroke();
    }
    ctx.restore();
  }
  function tornPath(
    x0: number,
    y0: number,
    w: number,
    h: number,
    seed: number,
    amp: number,
    step: number,
  ) {
    const r = mulberry(seed);
    const p: number[][] = [];
    for (let x = x0; x <= x0 + w; x += step) p.push([x, y0 + (r() - 0.5) * amp]);
    for (let y = y0; y <= y0 + h; y += step) p.push([x0 + w + (r() - 0.5) * amp, y]);
    for (let x = x0 + w; x >= x0; x -= step) p.push([x, y0 + h + (r() - 0.5) * amp]);
    for (let y = y0 + h; y >= y0; y -= step) p.push([x0 + (r() - 0.5) * amp, y]);
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    p.forEach((q) => ctx.lineTo(q[0], q[1]));
    ctx.closePath();
  }
  function dots(
    x0: number,
    y0: number,
    w: number,
    h: number,
    gap: number,
    color: string,
    a: number,
  ) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (let y = y0; y < y0 + h; y += gap) {
      for (let x = x0; x < x0 + w; x += gap) {
        const f = 1 - (x - x0) / w;
        const r = gap * 0.32 * f;
        if (r > 0.4) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 7);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  function rr(x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wordmark(x: number, y: number, w: number, align?: string) {
    if (!o.wm) return;
    const h = (w * o.wm.naturalHeight) / o.wm.naturalWidth;
    const x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.drawImage(o.wm, x0, y, w, h);
    return h;
  }

  /* ─────────────────────────────────────────────────────────────
     MODE PIPETTE — photo brute, on prélève une couleur réelle
     ───────────────────────────────────────────────────────────── */
  if (o.pipette) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(pp(W, H, { raw: true }), 0, 0, W, H);
    rr(W / 2 - 340, 84, 680, 92, 12);
    ctx.fillStyle = "rgba(17,19,23,.78)";
    ctx.fill();
    outfit(600, 34);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("Touche la couleur à prélever", W / 2, 144);
    ctx.textAlign = "left";
    return;
  }

  /* ─────────────────────────────────────────────────────────────
     LES 8 GABARITS
     ───────────────────────────────────────────────────────────── */

  const T: Record<Tpl, () => void> = {
    /* 1 — JOUR DE MATCH : split vertical, duotone accent */
    match() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(pp(660, H, { con: 1.16, stops: accDuo() }), 0, 0, 660, H);
      let g = ctx.createLinearGradient(400, 0, 660, 0);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(1, "rgba(17,19,23,.92)");
      ctx.fillStyle = g;
      ctx.fillRect(400, 0, 260, H);
      g = ctx.createLinearGradient(0, 1350, 0, H);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(1, "rgba(17,19,23,.85)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 1350, 660, H - 1350);

      // nom vertical sur la tranche de la photo — ÉCART 3
      const nom = up(val("f_nom"));
      if (nom) {
        ctx.save();
        ctx.translate(88, 1580);
        ctx.rotate(-Math.PI / 2);
        outfit(700, 34);
        ctx.fillStyle = "#fff";
        trk(nom, 0, 0, 10, "left");
        ctx.restore();
      }

      const X = 430;
      outfit(600, 30);
      ctx.fillStyle = MUT;
      trk("C'EST AUJOURD'HUI", X, 360, 9, "left");
      const size = fit("MATCH.", anton, W - X - 50, 220, 120);
      const lh = size * 0.96;
      let y = 390 + size;
      ctx.fillStyle = "#fff";
      anton(size);
      ctx.fillText("JOUR", X, y);
      ctx.fillText("DE", X, y + lh);
      redDot("MATCH.", X, y + 2 * lh);
      y += 2 * lh;
      ctx.fillStyle = INK;
      ctx.fillRect(X, y + 56, 110, 10);

      // VS + adversaire — ÉCART 3 : un « VS » seul n'a pas de sens,
      // le bloc entier disparaît si l'adversaire n'est pas saisi.
      const yy = y + 150;
      const adv = up(val("f_adv"));
      if (adv) {
        outfit(800, 42);
        ctx.fillStyle = INK;
        ctx.fillText("VS", X, yy);
        const vsw = ctx.measureText("VS ").width;
        ctx.fillStyle = "#fff";
        fit(adv, (s) => outfit(800, s), W - X - 60 - vsw, 58, 30);
        ctx.fillText(adv, X + vsw + 8, yy);
      }
      outfit(600, 40);
      ctx.fillStyle = "#fff";
      ctx.fillText(up(val("f_date")), X, yy + 76);
      outfit(400, 34);
      ctx.fillStyle = MUT;
      ctx.fillText(up(val("f_lieu")), X, yy + 134);

      dots(X, 1330, 270, 150, 18, "#fff", 0.16);
      wordmark(W - 60, 1556, 200, "right");
      grain(0.09);
    },

    /* 2 — RÉSULTAT : plein cadre N&B, verdict incliné, tableau de score */
    resultat() {
      ctx.drawImage(
        pp(W, H, {
          con: 1.24,
          stops: [
            [0, 17, 19, 23],
            [0.55, 96, 101, 112],
            [1, 252, 252, 255],
          ],
        }),
        0,
        0,
        W,
        H,
      );
      ctx.fillStyle = "rgba(17,19,23,.30)";
      ctx.fillRect(0, 0, W, H);
      protect(880, 0.94);
      vignette(0.45);

      const sn = parseInt(val("f_sn") || "0", 10);
      const se = parseInt(val("f_se") || "0", 10);
      const v = sn > se ? "VICTOIRE." : sn < se ? "ON SE REPREND." : "ÉGALITÉ.";

      outfit(600, 30);
      ctx.fillStyle = MUT;
      trk("SCORE FINAL", W / 2, 366, 10, "center");

      // ÉCART 3 : « VS — » retiré ; sans adversaire, la ligne ne s'écrit pas.
      const adv = up(val("f_adv"));
      if (adv) {
        const advTxt = "VS " + adv;
        fit(advTxt, (s) => outfit(800, s), 900, 54, 28);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(advTxt, W / 2, 446);
        ctx.textAlign = "left";
      }

      const lines = v === "ON SE REPREND." ? ["ON SE", "REPREND."] : [v];
      const size = Math.min(...lines.map((L) => fit(L, anton, 940, 300, 110)));
      anton(size);
      const lh = size * 0.94;
      ctx.save();
      ctx.translate(W / 2, 870);
      ctx.rotate((-3.2 * Math.PI) / 180);
      ctx.fillStyle = "#fff";
      lines.forEach((L, i) => {
        const y = lines.length === 2 ? (i - 0.5) * lh + size * 0.32 : size * 0.36;
        redDot(L, 0, y, "center");
      });
      const by = (lines.length === 2 ? 0.5 * lh + size * 0.32 : size * 0.36) + 52;
      ctx.fillStyle = INK;
      ctx.fillRect(-150, by, 300, 12);
      ctx.restore();

      const ys = 1400;
      anton(230);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(sn), 470, ys);
      ctx.textAlign = "left";
      ctx.fillStyle = MUT;
      ctx.fillText(String(se), 610, ys);
      ctx.save();
      ctx.translate(540, ys - 80);
      ctx.rotate(0.3);
      ctx.fillStyle = INK;
      ctx.fillRect(-7, -105, 14, 210);
      ctx.restore();
      outfit(600, 28);
      ctx.fillStyle = MUT;
      trk("NOUS", 380, ys + 64, 8, "center");
      trk("EUX", 700, ys + 64, 8, "center");

      scratches(7, 5, 0.06);
      grain(0.13);
      wordmark(W / 2, 1556, 190, "center");
    },

    /* 3 — MES STATS : colonne de stats, photo montée inclinée */
    stats() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      const nom = up(val("f_nom"));

      // ÉCART 3 : le nom géant en contour ET le titre disparaissent
      // ensemble — ils sont le même contenu, à deux échelles.
      let ns = 0;
      if (nom) {
        ctx.save();
        ctx.translate(1042, 1780);
        ctx.rotate(-Math.PI / 2);
        anton(220);
        ctx.strokeStyle = "rgba(255,255,255,.09)";
        ctx.lineWidth = 3;
        ctx.strokeText(nom, 0, 0);
        ctx.restore();
      }
      outfit(600, 30);
      ctx.fillStyle = MUT;
      trk("MES STATS", 70, 346, 10, "left");
      if (nom) {
        ns = fit(nom, anton, 930, 150, 70);
        anton(ns);
        ctx.fillStyle = "#fff";
        ctx.fillText(nom, 66, 366 + ns);
      }
      outfit(600, 36);
      ctx.fillStyle = MUT;
      const sp = [up(val("f_sport")), up(val("f_pos"))].filter(Boolean).join("  ·  ");
      trk(sp, 70, 430 + ns, 4, "left");

      const cx = 755;
      const cy = 1030;
      const cw = 510;
      const chh = 840;
      dots(430, 1290, 250, 210, 18, "#fff", 0.14);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((2.2 * Math.PI) / 180);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.strokeRect(-cw / 2 + 24, -chh / 2 + 28, cw, chh);
      tornPath(-cw / 2 - 14, -chh / 2 - 14, cw + 28, chh + 28, 5, 20, 30);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.save();
      tornPath(-cw / 2, -chh / 2, cw, chh, 9, 14, 26);
      ctx.clip();
      ctx.drawImage(
        pp(cw, chh, {
          con: 1.26,
          stops: [
            [0, 17, 19, 23],
            [0.55, 104, 109, 120],
            [1, 250, 250, 253],
          ],
        }),
        -cw / 2,
        -chh / 2,
        cw,
        chh,
      );
      ctx.restore();
      ctx.restore();

      const rows = (
        [
          ["f_s1v", "f_s1l"],
          ["f_s2v", "f_s2l"],
          ["f_s3v", "f_s3l"],
        ] as [string, string][]
      )
        .map(([a, b]) => [val(a), val(b)])
        .filter((r) => r[0] && r[1])
        .slice(0, 3);
      let y = 880;
      rows.forEach((r, i) => {
        const vs = fit(r[0], anton, 380, 150, 60);
        anton(vs);
        ctx.fillStyle = i === 0 ? INK : "#fff";
        ctx.fillText(r[0], 66, y);
        outfit(600, 29);
        ctx.fillStyle = MUT;
        trk(up(r[1]), 70, y + 48, 6, "left");
        y += 238;
      });

      wordmark(70, 1556, 200, "left");
      grain(0.08);
    },

    /* 5 — MON ÉQUIPE : polaroid centré, composition symétrique */
    equipe() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      if (o.icon) {
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.drawImage(
          o.icon,
          W / 2 - 430,
          520,
          860,
          (860 * o.icon.naturalHeight) / o.icon.naturalWidth,
        );
        ctx.restore();
      }
      wordmark(W / 2, 286, 180, "center");
      outfit(600, 28);
      ctx.fillStyle = MUT;
      trk("MON ÉQUIPE", W / 2, 398, 10, "center");

      const pw = 704;
      const ph = 780;
      const pad = 26;
      const bot = 130;
      const cw = pw + pad * 2;
      const chh = pad + ph + bot;
      ctx.save();
      ctx.translate(W / 2, 430 + chh / 2);
      ctx.rotate((-2.4 * Math.PI) / 180);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-cw / 2, -chh / 2, cw, chh);
      ctx.drawImage(
        pp(pw, ph, { sat: 0.55, con: 1.08, cool: true }),
        -cw / 2 + pad,
        -chh / 2 + pad,
        pw,
        ph,
      );
      outfit(700, 52);
      ctx.fillStyle = "#16181d";
      ctx.textAlign = "center";
      ctx.fillText(up(val("f_prenom")), 0, -chh / 2 + pad + ph + 84);
      ctx.textAlign = "left";
      ctx.restore();

      // ÉCART 3 : « MON ÉQUIPE. » n'est plus peint par défaut.
      let eq = up(val("f_eqnom"));
      if (eq) {
        if (!eq.endsWith(".")) eq += ".";
        const ts = fit(eq, anton, 880, 160, 80);
        anton(ts);
        ctx.fillStyle = "#fff";
        redDot(eq, W / 2, 1520, "center");
      }
      const sub = [up(val("f_sport")), up(val("f_saison"))].filter(Boolean).join("  ·  ");
      outfit(600, 34);
      ctx.fillStyle = MUT;
      trk(sub, W / 2, 1584, 10, "center");
      grain(0.06);
    },

    /* 4 — NOUVEAU POST : mur typographique en écho sur photo sombre */
    post() {
      ctx.drawImage(
        pp(W, H, {
          con: 1.18,
          stops: [
            [0, 10, 11, 14],
            [0.6, 64, 68, 78],
            [1, 208, 212, 220],
          ],
        }),
        0,
        0,
        W,
        H,
      );
      ctx.fillStyle = "rgba(17,19,23,.28)";
      ctx.fillRect(0, 0, W, H);
      vignette(0.62);

      // ÉCART 3 : le nom et son filet forment un seul bloc — un filet
      // rouge suspendu au-dessus du vide serait un défaut visible.
      const nom = up(val("f_nom"));
      if (nom) {
        outfit(600, 32);
        ctx.fillStyle = "#fff";
        trk(nom, 70, 356, 9, "left");
        ctx.fillStyle = INK;
        ctx.fillRect(70, 384, 64, 7);
      }

      const size = fit("NOUVEAU POST.", anton, 940, 180, 100);
      const lh = size * 1.02;
      let y = 470 + size;
      const alphas = [0.3, 0.6, 1, 0.6, 0.35];
      for (let i = 0; i < 5; i++) {
        anton(size);
        if (i === 2) {
          ctx.fillStyle = INK;
          ctx.fillText("NOUVEAU POST.", 68, y);
        } else {
          ctx.strokeStyle = "rgba(255,255,255," + alphas[i] + ")";
          ctx.lineWidth = 2.5;
          ctx.strokeText("NOUVEAU POST.", 68, y);
        }
        y += lh;
      }

      const obj = up(val("f_ligne"));
      if (obj) {
        outfit(800, 46);
        const words = obj.split(/\s+/);
        const linesArr: string[] = [];
        let cur = "";
        words.forEach((w) => {
          const t = cur ? cur + " " + w : w;
          if (ctx.measureText(t).width > 720 && cur) {
            linesArr.push(cur);
            cur = w;
          } else cur = t;
        });
        if (cur) linesArr.push(cur);
        ctx.save();
        ctx.translate(W / 2, Math.min(y + 56, 1480));
        ctx.rotate((-2 * Math.PI) / 180);
        let maxW2 = 0;
        linesArr.slice(0, 2).forEach((L, i) => {
          const w = ctx.measureText(L).width;
          maxW2 = Math.max(maxW2, w);
          ctx.fillStyle = "#fff";
          ctx.fillRect(-w / 2 - 30, i * 86 - 52, w + 60, 74);
          ctx.fillStyle = BG;
          ctx.fillText(L, -w / 2, i * 86);
        });
        const ax = Math.min(maxW2 / 2 + 76, 470);
        ctx.strokeStyle = "rgba(255,255,255,.75)";
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ax, 4);
        ctx.lineTo(ax, -48);
        ctx.moveTo(ax - 14, -32);
        ctx.lineTo(ax, -48);
        ctx.lineTo(ax + 14, -32);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
      }

      scratches(12, 4, 0.05);
      grain(0.17);
      wordmark(70, 1560, 190, "left");
    },

    /* 6 — VOIS MON PROFIL : photo haute duotone, le nom en héros.
       ÉCART 4 — les cinq étoiles dorées qui vivaient sous la sous-ligne
       sont supprimées, avec leur champ. Rien ne les remplace : la
       sous-ligne sport · position · école suffit à situer l'athlète. */
    profil() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      const ph3 = 1010;
      ctx.drawImage(pp(W, ph3, { con: 1.16, stops: accDuo() }), 0, 0, W, ph3);
      const gp = ctx.createLinearGradient(0, ph3 - 340, 0, ph3);
      gp.addColorStop(0, "rgba(17,19,23,0)");
      gp.addColorStop(1, "#111317");
      ctx.fillStyle = gp;
      ctx.fillRect(0, ph3 - 340, W, 340);

      outfit(600, 34);
      ctx.fillStyle = "#fff";
      trk("MON PROFIL EST SUR NEXUS", 70, 1046, 9, "left");
      ctx.fillStyle = INK;
      ctx.fillRect(70, 1074, 84, 8);

      const nomP = up(val("f_nom"));
      if (nomP) {
        const parts = nomP.split(/\s+/);
        const lines =
          parts.length > 1 ? [parts[0], parts.slice(1).join(" ") + "."] : [nomP + "."];
        let s = Math.min(...lines.map((Lz) => fit(Lz, anton, 940, 230, 90)));
        if (lines.length === 2) s = Math.min(s, 150);
        anton(s);
        const lhp = s * 0.96;
        const b = lines.length === 2 ? 1420 - lhp : 1420;
        ctx.fillStyle = "#fff";
        lines.forEach((Lz, i) => {
          const yv = b + i * lhp;
          if (i === lines.length - 1) redDot(Lz, 66, yv);
          else ctx.fillText(Lz, 66, yv);
        });
      }

      const sub = [up(val("f_sport")), up(val("f_pos")), up(val("f_ecole"))]
        .filter(Boolean)
        .join("  ·  ");
      let sz = 30;
      outfit(600, sz);
      while (ctx.measureText(sub).width + sub.length * 5 > 940 && sz > 18) {
        sz -= 2;
        outfit(600, sz);
      }
      ctx.fillStyle = MUT;
      trk(sub, 70, 1482, 5, "left");

      wordmark(70, 1592, 180, "left");
      outfit(600, 30);
      ctx.fillStyle = "#fff";
      trk("NEXUSSPORTS.CA", 1010, 1634, 7, "right");
      grain(0.08);
    },

    /* 8 — MERCI : moment calme, duotone doux, texte au tiers inférieur */
    merci() {
      ctx.drawImage(pp(W, H, { con: 1.04, stops: accDuo() }), 0, 0, W, H);
      ctx.fillStyle = "rgba(17,19,23,.15)";
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 860, 0, 1560);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(0.8, "rgba(17,19,23,.9)");
      g.addColorStop(1, "rgba(17,19,23,.96)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 860, W, H - 860);
      vignette(0.22);

      const nomM = up(val("f_nom"));
      if (nomM) {
        outfit(600, 30);
        ctx.fillStyle = "#fff";
        trk(nomM, W / 2, 366, 9, "center");
        ctx.fillStyle = INK;
        ctx.fillRect(W / 2 - 32, 392, 64, 6);
      }

      const s = Math.min(fit("MERCI.", anton, 900, 300, 120), 280);
      anton(s);
      ctx.fillStyle = "#fff";
      redDot("MERCI.", W / 2, 1252, "center");

      const aq = up(val("f_aqui"));
      if (aq) {
        const s2 = fit(aq, anton, 800, 96, 40);
        anton(s2);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(aq, W / 2, 1356);
        ctx.textAlign = "left";
      }

      const msg = up(val("f_msg")).slice(0, 60);
      if (msg) {
        let mz = 30;
        outfit(500, mz);
        while (ctx.measureText(msg).width + msg.length * 6 > 900 && mz > 18) {
          mz -= 2;
          outfit(500, mz);
        }
        ctx.fillStyle = MUT;
        trk(msg, W / 2, 1436, 6, "center");
      }

      wordmark(W / 2, 1556, 180, "center");
      grain(0.06);
    },

    /* 7 — JAQUETTE DE JEU : boîtier plastique, NEXUS · X · année.
       Aucune marque tierce : la ligue est du TEXTE saisi, le X est nu. */
    jaquette() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      const yy = String(new Date().getFullYear() % 100);
      const X0 = 80;
      const Y0 = 260;
      const CW = 920;
      const CH = 1300;
      const SP = 64;
      const BH = 96;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.6)";
      ctx.shadowBlur = 70;
      ctx.shadowOffsetY = 30;
      rr(X0, Y0, CW, CH, 18);
      ctx.fillStyle = "#1A1D24";
      ctx.fill();
      ctx.restore();

      ctx.save();
      rr(X0, Y0, CW, CH, 18);
      ctx.clip();

      // bande plateforme : X noir nu, rien d'autre
      ctx.fillStyle = "#fff";
      ctx.fillRect(X0, Y0, CW, BH);
      if (o.iconBlack) {
        const ib = (44 * o.iconBlack.naturalWidth) / o.iconBlack.naturalHeight;
        ctx.drawImage(o.iconBlack, X0 + 40, Y0 + BH / 2 - 22, ib, 44);
      }

      // tranche gauche : X nu, nom vertical, numéro dessous
      ctx.fillStyle = "#14161B";
      ctx.fillRect(X0, Y0 + BH, SP, CH - BH);
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X0 + SP, Y0 + BH);
      ctx.lineTo(X0 + SP, Y0 + CH);
      ctx.stroke();
      if (o.iconRed) {
        const ib2 = (34 * o.iconRed.naturalHeight) / o.iconRed.naturalWidth;
        ctx.drawImage(o.iconRed, X0 + SP / 2 - 17, Y0 + BH + 26, 34, ib2);
      }
      const numSp = val("f_num");
      const nomSp = up(val("f_nom"));
      if (numSp || nomSp) {
        ctx.save();
        ctx.translate(X0 + SP / 2 + 10, Y0 + CH - 40);
        ctx.rotate(-Math.PI / 2);
        outfit(700, 26);
        ctx.fillStyle = "rgba(255,255,255,.75)";
        let sx2 = 0;
        if (numSp) sx2 = trk(numSp, 0, 0, 7, "left") + 34;
        if (nomSp) {
          ctx.fillStyle = "#fff";
          trk(nomSp, sx2, 0, 7, "left");
        }
        ctx.restore();
      }

      // couverture
      const cx0 = X0 + SP;
      const cy0 = Y0 + BH;
      const cw2 = CW - SP;
      const ch2 = CH - BH;
      ctx.drawImage(pp(cw2, ch2, { con: 1.16, stops: accDuo() }), cx0, cy0, cw2, ch2);
      let g = ctx.createLinearGradient(0, cy0 + ch2 - 420, 0, cy0 + ch2);
      g.addColorStop(0, "rgba(17,19,23,0)");
      g.addColorStop(1, "rgba(17,19,23,.88)");
      ctx.fillStyle = g;
      ctx.fillRect(cx0, cy0 + ch2 - 420, cw2, 420);

      /* Lockup {LIGUE} · X nu · année.
         Le repli « RSEQ » est le SEUL conservé de la référence, et c'est
         délibéré : le lockup est un triptyque centré. Vider la ligue ne
         laisse pas un blanc, elle décentre le X et l'année autour d'un
         trou — un défaut de composition, pas une absence propre. La
         ligue reste d'ailleurs le seul champ prérempli du formulaire. */
      const lig = up(val("f_ligue") || "RSEQ").slice(0, 12);
      let s = 132;
      let wL = 0;
      let wY = 0;
      let capH = 0;
      let iw3 = 0;
      let tot = 0;
      const gap2 = 38;
      do {
        anton(s);
        wL = ctx.measureText(lig).width;
        wY = ctx.measureText(yy).width;
        capH = s * 0.72;
        iw3 = o.icon ? (capH * o.icon.naturalWidth) / o.icon.naturalHeight : capH;
        tot = wL + gap2 + iw3 + gap2 + wY;
        if (tot > cw2 - 90) s -= 4;
      } while (tot > cw2 - 90 && s > 56);
      const lx = cx0 + cw2 / 2 - tot / 2;
      const lyB = cy0 + 430;
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(17,19,23,.45)";
      ctx.strokeText(lig, lx, lyB);
      ctx.fillStyle = "#fff";
      ctx.fillText(lig, lx, lyB);
      if (o.icon) ctx.drawImage(o.icon, lx + wL + gap2, lyB - capH, iw3, capH);
      ctx.strokeText(yy, lx + wL + gap2 + iw3 + gap2, lyB);
      ctx.fillStyle = "#fff";
      ctx.fillText(yy, lx + wL + gap2 + iw3 + gap2, lyB);

      const posV = val("f_posj").split("|");
      const posAb = posV[0] || "";
      const posLb = posV[1] || "";
      const sub = [up(val("f_sport")), posLb, up(val("f_eqnom"))]
        .filter(Boolean)
        .join("  ·  ");
      let sz = 28;
      outfit(600, sz);
      while (ctx.measureText(sub).width + sub.length * 5 > cw2 - 80 && sz > 16) {
        sz -= 2;
        outfit(600, sz);
      }
      ctx.fillStyle = "rgba(255,255,255,.85)";
      trk(sub, cx0 + cw2 / 2, lyB + 66, 5, "center");

      /* ÉCART 6 — LA BOÎTE DE POSITION.

         La référence portait ici « (pas de boîte classification —
         retirée à la demande) ». Le retrait demandé visait la
         CLASSIFICATION type ESRB (le « RP » d'un boîtier de jeu), pas la
         boîte elle-même : c'est un carré de position, il porte
         l'abréviation du poste de l'athlète, WR ou QB ou PG.

         Angle bas gauche de la couverture, marge 46 px, ligne de base du
         libellé alignée sur le nom du badge bas droite (Y0+CH-56) : les
         deux ancrages inférieurs se répondent d'un bord à l'autre.

         Rien n'est peint si aucune position n'est choisie — l'option
         vide du sélecteur est celle par défaut (même règle que tous les
         autres champs). */
      if (posAb) {
        const BOX = 128;
        const boxL = cx0 + 46;
        const labelBase = Y0 + CH - 56;
        const boxB = labelBase - 34;
        const boxT = boxB - BOX;

        ctx.save();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxL, boxT, BOX, BOX);

        const as = fit(posAb, anton, BOX - 24, 76, 26);
        anton(as);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        // centrage optique : la hauteur de capitale d'Anton vaut ~0.72 em
        ctx.fillText(posAb, boxL + BOX / 2, boxT + BOX / 2 + as * 0.36);
        ctx.textAlign = "left";

        if (posLb) {
          let ls = 20;
          outfit(600, ls);
          while (ctx.measureText(posLb).width + posLb.length * 4 > BOX + 96 && ls > 12) {
            ls -= 1;
            outfit(600, ls);
          }
          ctx.fillStyle = "rgba(255,255,255,.85)";
          trk(posLb, boxL + BOX / 2, labelBase, 4, "center");
        }
        ctx.restore();
      }

      // badge bas droite : wordmark + nom
      wordmark(X0 + CW - 46, Y0 + CH - 150, 180, "right");
      const nomB = up(val("f_nom"));
      if (nomB) {
        outfit(600, 28);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.fillText(nomB, X0 + CW - 46, Y0 + CH - 56);
        ctx.textAlign = "left";
      }

      // reflet plastique en diagonale
      ctx.save();
      ctx.translate(X0 + CW * 0.38, Y0 + CH * 0.5);
      ctx.rotate(-0.52);
      g = ctx.createLinearGradient(-130, 0, 150, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,.09)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-160, -CH, 320, CH * 2);
      g = ctx.createLinearGradient(210, 0, 300, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,.05)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(200, -CH, 110, CH * 2);
      ctx.restore();

      ctx.restore();

      rr(X0, Y0, CW, CH, 18);
      ctx.strokeStyle = "rgba(255,255,255,.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
      grain(0.08);
    },
  };

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  T[o.tpl]();
}

/* ─────────────────────────────────────────────────────────────────
   COMPOSANT
   ───────────────────────────────────────────────────────────────── */

/** Première famille de la pile, pour document.fonts.load() qui matche
 *  mal une liste. next/font produit un nom haché entre guillemets. */
function firstFamily(stack: string) {
  return stack.split(",")[0].trim().replace(/^["']|["']$/g, "");
}

export default function MaStoryClient({
  fontVariableClass,
}: {
  fontVariableClass: string;
}) {
  const [tpl, setTpl] = useState<Tpl>("match");
  // R5 — seul champ prérempli. Tout le reste est en placeholder.
  const [vals, setVals] = useState<Vals>({ f_ligue: "RSEQ" });
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [focal, setFocal] = useState({ x: 0.5, y: 0.4 });
  const [accent, setAccent] = useState("#E63946");
  /** Curseur « Intensite de l'effet », en POURCENT. Vit a cote de
   *  zoom/fx/fy ; rien n'est persiste. */
  const [intensite, setIntensite] = useState(Math.round(DUO_MIX * 100));
  const [hexIn, setHexIn] = useState("#E63946");
  const [pipette, setPipette] = useState(false);
  const [safeShown, setSafeShown] = useState(false);
  const [ready, setReady] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLCanvasElement>(null);
  const assetsRef = useRef<{
    wm: HTMLImageElement | null;
    icon: HTMLImageElement | null;
    iconRed: HTMLImageElement | null;
    iconBlack: HTMLImageElement | null;
  }>({ wm: null, icon: null, iconRed: null, iconBlack: null });
  const stacksRef = useRef({ anton: "Anton, Impact, sans-serif", outfit: "Outfit, system-ui, sans-serif" });
  const lowResRef = useRef(false);
  const photoUrlRef = useRef<string | null>(null);

  const v = useCallback((k: string) => (vals[k] ?? "").trim(), [vals]);
  const set = (k: string) => (value: string) => setVals((p) => ({ ...p, [k]: value }));

  /* ---- boot : actifs de marque + fontes ---- */
  useEffect(() => {
    let alive = true;
    const root = rootRef.current;
    if (root) {
      const cs = getComputedStyle(root);
      const outfitVar = cs.getPropertyValue("--font-story").trim();
      const antonVar = cs.getPropertyValue("--font-anton").trim();
      if (outfitVar) stacksRef.current.outfit = `${outfitVar}, system-ui, sans-serif`;
      if (antonVar) stacksRef.current.anton = `${antonVar}, Impact, sans-serif`;
    }
    const outfitFam = firstFamily(stacksRef.current.outfit);
    const antonFam = firstFamily(stacksRef.current.anton);

    Promise.all([
      loadImg(BRAND.wordmark),
      loadImg(BRAND.icon),
      loadImg(BRAND.iconRed),
      loadImg(BRAND.iconBlack),
      // ÉCART 1 — graisse par graisse : une famille « chargée » ne dit
      // rien de la graisse 800, et un fallback fausse toutes les mesures.
      document.fonts.load(`400 10px "${outfitFam}"`),
      document.fonts.load(`500 10px "${outfitFam}"`),
      document.fonts.load(`600 10px "${outfitFam}"`),
      document.fonts.load(`700 10px "${outfitFam}"`),
      document.fonts.load(`800 10px "${outfitFam}"`),
      document.fonts.load(`100px "${antonFam}"`),
    ]).then(([wm, icon, iconRed, iconBlack]) => {
      if (!alive) return;
      assetsRef.current = { wm, icon, iconRed, iconBlack };
      document.fonts.ready.then(() => {
        if (alive) setReady(true);
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- rendu ---- */
  const render = useCallback(() => {
    const cv = cvRef.current;
    if (!cv || !ready) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const a = assetsRef.current;
    drawStory(ctx, {
      tpl,
      v,
      photo,
      wm: a.wm,
      icon: a.icon,
      iconRed: a.iconRed,
      iconBlack: a.iconBlack,
      fx: focal.x,
      fy: focal.y,
      zoom,
      accent,
      duoMix: intensite / 100,
      lowRes: lowResRef.current,
      antonStack: stacksRef.current.anton,
      outfitStack: stacksRef.current.outfit,
      pipette,
    });
  }, [ready, tpl, v, photo, focal, zoom, accent, intensite, pipette]);

  useEffect(() => {
    render();
  }, [render]);

  /* ---- vignette de cadrage ---- */
  const drawThumb = useCallback(() => {
    const th = thumbRef.current;
    if (!th) return;
    const tctx = th.getContext("2d");
    if (!tctx) return;
    const w2 = th.clientWidth || 336;
    if (th.width !== w2) {
      th.width = w2;
      th.height = Math.round(w2 * 0.62);
    }
    const wpx = th.width;
    const hpx = th.height;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.fillStyle = "#111317";
    tctx.fillRect(0, 0, wpx, hpx);
    if (!photo) return;
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const s = Math.min(wpx / iw, hpx / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (wpx - dw) / 2;
    const dy = (hpx - dh) / 2;
    tctx.drawImage(photo, dx, dy, dw, dh);
    tctx.strokeStyle = "rgba(255,255,255,.3)";
    tctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      tctx.beginPath();
      tctx.moveTo(dx + (dw * i) / 3, dy);
      tctx.lineTo(dx + (dw * i) / 3, dy + dh);
      tctx.stroke();
      tctx.beginPath();
      tctx.moveTo(dx, dy + (dh * i) / 3);
      tctx.lineTo(dx + dw, dy + (dh * i) / 3);
      tctx.stroke();
    }
    tctx.strokeStyle = "rgba(255,255,255,.5)";
    tctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
    const fxp = dx + clamp(focal.x, 0, 1) * dw;
    const fyp = dy + clamp(focal.y, 0, 1) * dh;
    tctx.beginPath();
    tctx.arc(fxp, fyp, 9, 0, 7);
    tctx.fillStyle = "#E63946";
    tctx.fill();
    tctx.lineWidth = 3;
    tctx.strokeStyle = "#fff";
    tctx.stroke();
  }, [photo, focal]);

  useEffect(() => {
    drawThumb();
    const onResize = () => drawThumb();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawThumb]);

  /* ---- photo ---- */
  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    const url = URL.createObjectURL(f);
    photoUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setPhoto(img);
      setFocal({ x: 0.5, y: 0.4 });
      setZoom(1);
    };
    img.src = url;
  };

  useEffect(
    () => () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    },
    [],
  );

  /* ---- cadrage au doigt ---- */
  const dragRef = useRef(false);
  const thPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const th = thumbRef.current;
    if (!th || !photo) return;
    const r = th.getBoundingClientRect();
    const wpx = th.width;
    const hpx = th.height;
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const s = Math.min(wpx / iw, hpx / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = (wpx - dw) / 2;
    const dy = (hpx - dh) / 2;
    const x = (e.clientX - r.left) * (wpx / r.width);
    const y = (e.clientY - r.top) * (hpx / r.height);
    setFocal({ x: clamp((x - dx) / dw, 0, 1), y: clamp((y - dy) / dh, 0, 1) });
  };

  /* ---- pipette ---- */
  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pipette) return;
    e.preventDefault();
    const cv = cvRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const r = cv.getBoundingClientRect();
    const x = Math.floor(clamp((e.clientX - r.left) * (W / r.width), 0, W - 1));
    const y = Math.floor(clamp((e.clientY - r.top) * (H / r.height), 0, H - 1));
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex =
      "#" + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("");
    setPipette(false);
    setAccent(hex.toUpperCase());
    setHexIn(hex.toUpperCase());
  };

  /* ---- téléchargement ----
     R9 : le PNG est fabriqué dans le navigateur et l'URL objet est
     révoquée après le clic. Rien ne transite, rien ne reste. */
  const download = () => {
    const cv = cvRef.current;
    if (!cv) return;
    lowResRef.current = false;
    render();
    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "nexus-story-" + FILE_NAMES[tpl] + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  };

  /* ---- formulaire ---- */
  const show = (...list: Tpl[]) => (list.includes(tpl) ? undefined : { display: "none" });

  const txt = (id: string, ph: string, maxLength?: number) => (
    <input
      type="text"
      id={id}
      value={vals[id] ?? ""}
      placeholder={ph}
      maxLength={maxLength}
      onChange={(e) => set(id)(e.target.value)}
    />
  );

  return (
    <div ref={rootRef} className={`${fontVariableClass} ${styles.page}`}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND.wordmark} alt="Nexus" />
        <div className={styles.headerT}>
          <b>Ma story</b> · Génère ta story Instagram 1080 × 1920
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.panel}>
          <div className={`${styles.card} ${styles.cTabs}`}>
            <div className={styles.eyebrow}>Gabarit</div>
            <div className={styles.tabs}>
              {TPL_META.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={tpl === k ? styles.on : undefined}
                  onClick={() => setTpl(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={`${styles.card} ${styles.cColor}`}>
            <div className={styles.eyebrow}>Couleur d&apos;équipe</div>
            <div className={styles.sw}>
              {SWATCHES.map(([label, hex]) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  aria-label={label}
                  className={accent === hex ? styles.on : undefined}
                  style={{ background: hex }}
                  onClick={() => {
                    setAccent(hex);
                    setHexIn(hex);
                  }}
                />
              ))}
            </div>
            <div className={styles.hexrow}>
              <span className={styles.hexLabel}>Hex libre</span>
              <input
                type="text"
                value={hexIn}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => {
                  const val2 = e.target.value.trim();
                  setHexIn(val2);
                  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val2)) setAccent(val2.toUpperCase());
                }}
              />
            </div>
            <button
              type="button"
              className={`${styles.btn2} ${pipette ? styles.on : ""}`}
              style={{ marginTop: 12 }}
              onClick={() => setPipette((p) => !p)}
            >
              {pipette ? "Pipette active — touche ta photo" : "Pipette — touche ta photo"}
            </button>

            {/* Meme mecanique que le cadrage : basse resolution pendant le
                glissement, pleine resolution au relachement. Sans cela, un
                glissement continu recalcule 1080x1920 pixels a chaque pas et
                le curseur devient poisseux sur telephone. */}
            <label className={styles.f} style={{ marginTop: 14, marginBottom: 0 }}>
              <span>Intensité de l&apos;effet · {intensite}&#8239;%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={intensite}
                onChange={(e) => setIntensite(+e.target.value)}
                onPointerDown={() => {
                  lowResRef.current = true;
                }}
                onPointerUp={() => {
                  lowResRef.current = false;
                  render();
                }}
                onPointerCancel={() => {
                  lowResRef.current = false;
                  render();
                }}
              />
            </label>
          </div>

          <div className={`${styles.card} ${styles.cPhoto}`}>
            <div className={styles.eyebrow}>Ta photo</div>
            <label className={styles.photoBtn}>
              {photo ? "Changer la photo" : "Choisir une photo"}
              <input type="file" accept="image/*" hidden onChange={onPhoto} />
            </label>
            <div className={styles.eyebrow} style={{ marginTop: 16 }}>
              Cadrage — glisse le point sur le sujet, ajuste le zoom
            </div>
            <canvas
              ref={thumbRef}
              className={styles.thumb}
              width={336}
              height={210}
              onPointerDown={(e) => {
                if (!photo) return;
                e.preventDefault();
                dragRef.current = true;
                lowResRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                thPoint(e);
              }}
              onPointerMove={(e) => {
                if (dragRef.current) thPoint(e);
              }}
              onPointerUp={() => {
                if (!dragRef.current) return;
                dragRef.current = false;
                lowResRef.current = false;
                render();
              }}
              onPointerCancel={() => {
                if (!dragRef.current) return;
                dragRef.current = false;
                lowResRef.current = false;
                render();
              }}
            />
            <label className={styles.f} style={{ marginTop: 12 }}>
              <span>Zoom · {Math.round(zoom * 100)}&#8239;%</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.btn2}
              onClick={() => {
                setFocal({ x: 0.5, y: 0.4 });
                setZoom(1);
              }}
            >
              Recentrer
            </button>
            <div className={styles.hint}>
              Ta photo reste sur ton appareil&#8239;: rien n&apos;est téléversé.
            </div>
          </div>

          <div className={`${styles.card} ${styles.cFields}`}>
            <div className={styles.eyebrow}>Contenu</div>

            <label className={styles.f} style={show("match", "stats", "post", "profil", "merci", "jaquette")}>
              <span>Ton nom</span>
              {txt("f_nom", "Ex. : Alex Tremblay")}
            </label>

            <label className={styles.f} style={show("merci")}>
              <span>À qui</span>
              {txt("f_aqui", "Ex. : Coach Tremblay")}
            </label>

            <label className={styles.f} style={show("merci")}>
              <span>Message (optionnel, 60 caract. max)</span>
              {txt("f_msg", "Ex. : Pour chaque pratique à 6 h", 60)}
            </label>

            <label className={styles.f} style={show("equipe")}>
              <span>Prénom de l&apos;athlète</span>
              {txt("f_prenom", "Ex. : Léa")}
            </label>

            <label className={styles.f} style={show("equipe", "jaquette")}>
              <span>Nom de l&apos;équipe</span>
              {txt("f_eqnom", "Ex. : Les Centaures")}
            </label>

            <label className={styles.f} style={show("match", "resultat")}>
              <span>Adversaire</span>
              {txt("f_adv", "Ex. : Les Patriotes")}
            </label>

            <label className={styles.f} style={show("match")}>
              <span>Date et heure</span>
              {txt("f_date", "Ex. : VEN 12 SEPT · 19 H 30")}
            </label>

            <label className={styles.f} style={show("match")}>
              <span>Lieu</span>
              {txt("f_lieu", "Ex. : Stade de Repentigny")}
            </label>

            <div className={styles.row2} style={show("resultat")}>
              <label className={styles.f}>
                <span>Notre score</span>
                <input
                  type="number"
                  id="f_sn"
                  min={0}
                  value={vals.f_sn ?? ""}
                  placeholder="0"
                  onChange={(e) => set("f_sn")(e.target.value)}
                />
              </label>
              <label className={styles.f}>
                <span>Leur score</span>
                <input
                  type="number"
                  id="f_se"
                  min={0}
                  value={vals.f_se ?? ""}
                  placeholder="0"
                  onChange={(e) => set("f_se")(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.row2} style={show("stats", "equipe", "profil", "jaquette")}>
              <label className={styles.f}>
                <span>Sport</span>
                {txt("f_sport", "Ex. : Football")}
              </label>
              <label className={styles.f} style={show("stats", "profil")}>
                <span>Position</span>
                {txt("f_pos", "Ex. : Receveur")}
              </label>
              <label className={styles.f} style={show("equipe")}>
                <span>Saison</span>
                {txt("f_saison", "Ex. : 2026-2027")}
              </label>
            </div>

            <label className={styles.f} style={show("jaquette")}>
              <span>Ton numéro</span>
              {txt("f_num", "Ex. : 9")}
            </label>

            <label className={styles.f} style={show("jaquette")}>
              <span>Position</span>
              <select
                id="f_posj"
                value={vals.f_posj ?? ""}
                onChange={(e) => set("f_posj")(e.target.value)}
              >
                <option value="">Ta position</option>
                {POSITIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.f} style={show("jaquette")}>
              <span>Ligue (texte seulement, 12 caract. max)</span>
              {txt("f_ligue", "RSEQ", 12)}
            </label>

            <label className={styles.f} style={show("profil")}>
              <span>École ou équipe</span>
              {txt("f_ecole", "Ex. : École de l'Horizon")}
            </label>

            <div style={show("stats")}>
              <div className={styles.eyebrow} style={{ marginTop: 4 }}>
                Stats (1 à 3)
              </div>
              <div className={styles.statrow}>
                {txt("f_s1v", "112")}
                {txt("f_s1l", "Verges")}
              </div>
              <div className={styles.statrow}>
                {txt("f_s2v", "2")}
                {txt("f_s2l", "Touchés")}
              </div>
              <div className={styles.statrow}>
                {txt("f_s3v", "6")}
                {txt("f_s3l", "Captations")}
              </div>
            </div>

            <label className={styles.f} style={show("post")}>
              <span>Ta ligne (ex. : Highlights du match)</span>
              {txt("f_ligne", "Ex. : Highlights du match")}
            </label>
          </div>

          <div className={`${styles.card} ${styles.dlcard}`}>
            <button type="button" className={styles.dl} disabled={!photo} onClick={download}>
              {photo
                ? "Télécharger le PNG · 1080 × 1920"
                : "Ajoute une photo pour télécharger"}
            </button>
            <label className={styles.chk}>
              <input
                type="checkbox"
                checked={safeShown}
                onChange={(e) => setSafeShown(e.target.checked)}
              />{" "}
              Afficher les zones de sécurité story
            </label>
          </div>
        </div>

        <div className={styles.stage}>
          <div className={styles.stagewrap}>
            <canvas
              ref={cvRef}
              className={`${styles.cv} ${pipette ? styles.pip : ""}`}
              width={W}
              height={H}
              onPointerDown={onCanvasPointer}
            />
            <div
              className={`${styles.safe} ${styles.safeT} ${safeShown ? styles.show : ""}`}
            >
              <span>ZONE RÉSERVÉE INSTAGRAM · 250 PX</span>
            </div>
            <div
              className={`${styles.safe} ${styles.safeB} ${safeShown ? styles.show : ""}`}
            >
              <span>ZONE RÉSERVÉE INSTAGRAM · 250 PX</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
