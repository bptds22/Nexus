/* ═══════════════════════════════════════════════════════════════
   gen-badge-ambassadeur.mjs — badge-nexus-x.svg → badge-ambassadeur.svg

   DÉRIVATION, PAS REDESSIN. Le badge Ambassadeur reprend la géométrie de
   nexus-x au trait près : même viewBox, mêmes chemins, mêmes masques, mêmes
   décalages de biseau. Seule la LIVRÉE change — rouge → or #F59E0B.

   ── POURQUOI UN SCRIPT ET PAS UN CHERCHER-REMPLACER ─────────────
   Les rouges du fichier ne sont pas une couleur, ce sont DOUZE, et chacune
   a un rôle : huit arrêts du dégradé métal (la face), un aplat d'ombre
   portée (#701019), un aplat de rehaut (#FFA3AA), un biseau clair
   (#FFD3D7), un biseau sombre (#8A1622). Les remplacer toutes par le même
   or écraserait le relief et donnerait une pastille plate.

   On transpose donc en HSL, avec UNE SEULE transformation appliquée
   uniformément — celle qui envoie le rouge de corps #DC3641 exactement sur
   #F59E0B :

       ΔH  = +41,68°      (356,02° → 37,70°)
       ×S  = 1,3096       (0,7034 → 0,9212)
       ΔL  = −0,0353      (0,5373 → 0,5020)

   Chaque autre rouge subit la MÊME translation. Les écarts relatifs entre
   les douze — donc le modelé — sont conservés par construction. La
   saturation est bornée à 1 : les rehauts très pâles y touchent, ce qui est
   le comportement voulu (ils virent au crème doré, pas au blanc rosé).

   ── CE QUI N'EST PAS TOUCHÉ ─────────────────────────────────────
   #FFFFFF et #000000 sont des POCHOIRS de masque et des arrêts de gloss :
   les convertir casserait les biseaux sans rien changer à l'écran. Le
   script les laisse tels quels, explicitement.

   Les identifiants sont renommés (`_rouge_nexus_x` → `_or_ambassadeur`) :
   /ma-story dessine plusieurs badges dans le même document, deux `id`
   identiques y feraient peindre le mauvais dégradé.

   Lancer :  node scripts/gen-badge-ambassadeur.mjs
   Puis   :  node scripts/gen-story-badges.mjs   (variante story)
═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";

const SRC = "public/badges/badge-nexus-x.svg";
const DST = "public/badges/badge-ambassadeur.svg";

/* ── HSL ─────────────────────────────────────────────────────── */
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3);
  }
  const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${c(r)}${c(g)}${c(b)}`;
}

/* ── La transformation, calée sur #DC3641 → #F59E0B ──────────── */
const [hA, sA, lA] = rgbToHsl(hexToRgb("#DC3641"));   // rouge de corps
const [hB, sB, lB] = rgbToHsl(hexToRgb("#F59E0B"));   // or Nexus
const dH = hB - hA, fS = sB / sA, dL = lB - lA;

const versOr = (hex) => {
  const [h, s, l] = rgbToHsl(hexToRgb(hex));
  return hslToHex(h + dH, Math.min(1, s * fS), Math.min(1, Math.max(0, l + dL)));
};

/* Les douze rouges, dans leur rôle. #FFFFFF / #000000 ABSENTS : pochoirs. */
const ROUGES = [
  "#FF97A0", "#DC3641", "#FF8A93", "#FFC0C6",   // dégradé métal, arrêts 0 → 0.5
  "#F0505B", "#C22834", "#FF6B76", "#D0303B",   // dégradé métal, arrêts 0.6 → 1
  "#701019",                                     // ombre portée
  "#FFA3AA",                                     // rehaut
  "#FFD3D7",                                     // biseau clair
  "#8A1622",                                     // biseau sombre
];

let svg = readFileSync(SRC, "utf8");

const table = [];
for (const r of ROUGES) {
  const or = versOr(r);
  table.push([r, or]);
  const re = new RegExp(r.replace("#", "#"), "gi");
  const avant = (svg.match(re) || []).length;
  if (avant === 0) throw new Error(`NEXUS: ${r} introuvable dans ${SRC} — le source a change.`);
  svg = svg.replace(re, or);
}

/* Identifiants : uniques par document (ma-story en peint plusieurs). */
svg = svg.replace(/_rouge_nexus_x/g, "_or_ambassadeur");
svg = svg.replace('aria-label="Custom"', 'aria-label="Ambassadeur"');

/* Garde-fou : plus un seul rouge ne doit subsister, et les pochoirs restent. */
const restants = [...svg.matchAll(/#[0-9A-F]{6}/gi)]
  .map((m) => m[0].toUpperCase())
  .filter((c) => ROUGES.includes(c));
if (restants.length) throw new Error(`NEXUS: rouges residuels : ${restants.join(", ")}`);
if (!svg.includes("#FFFFFF") || !svg.includes("#000000")) {
  throw new Error("NEXUS: les pochoirs de masque ont ete alteres.");
}

writeFileSync(DST, svg);

console.log(`${SRC} -> ${DST}`);
console.log(`transformation : dH=${dH.toFixed(2)}deg  xS=${fS.toFixed(4)}  dL=${dL.toFixed(4)}`);
console.log("\nrouge    ->  or       role");
const ROLES = ["metal 0", "metal 0.2 (ancre)", "metal 0.38", "metal 0.5", "metal 0.6",
  "metal 0.78", "metal 0.9", "metal 1", "ombre portee", "rehaut", "biseau clair", "biseau sombre"];
table.forEach(([r, o], i) => console.log(`${r}  ->  ${o}   ${ROLES[i]}`));
