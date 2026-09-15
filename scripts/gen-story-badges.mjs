/* ═══════════════════════════════════════════════════════════════
   gen-story-badges.mjs — public/badges/ → public/story-badges/

   Génère les 22 badges de /ma-story. La fiche de l'application continue
   de lire public/badges/, INTACT : ce script n'y écrit jamais.

   ── CE QU'IL CORRIGE ────────────────────────────────────────────
   Les 22 badges ne peignent AUCUN noir. Les 813 occurrences de
   `#000000` sont des pochoirs, toutes à l'intérieur d'un <mask> —
   les remplacer casserait les biseaux sans rien changer à l'écran.

   Le seul sombre RÉELLEMENT peint est `#131519` : les CONTRE-FORMES
   du glyphe — l'intérieur des anneaux d'une cible, le trou de serrure
   d'un cadenas, le champ d'un panneau STOP — posées par-dessus le
   remplissage de leur calque. Sur la fiche, à fond charbon, elles se
   confondent avec la page. Sur une photo de story, elles deviennent
   un aplat noir. Ce script les PERCE.

   ── POURQUOI UN MASQUE ET PAS UNE SUPPRESSION SÈCHE ─────────────
   Les contre-formes sont CONCENTRIQUES et strictement décroissantes.
   `dans-la-mire` est une pile disque → trou → disque → trou → disque,
   où chaque chemin recouvre tous les suivants. Retirer les
   contre-formes sans masque laisserait le disque extérieur recouvrir
   le reste : la cible deviendrait une pastille pleine.

   Le masque rejoue donc l'ORDRE DE PEINTURE du calque — blanc pour les
   formes, noir pour les contre-formes — ce qui reproduit exactement
   l'occlusion d'origine, en transparence au lieu du sombre.

   ── POURQUOI TROIS MASQUES ET PAS UN ────────────────────────────
   Un badge est fait de trois copies du même glyphe à trois décalages :
   l'ombre portée (+3, +6,2), le liseré clair (−1,4, −2,4), le métal.
   Ne percer que le calque métal montrerait le liseré puis l'ombre à
   travers le trou : un trou opaque rose. Chaque calque est donc percé
   à SON décalage. Dans le trou restent alors un croissant d'ombre
   `#701019` en haut à gauche et un croissant clair `#FFA3AA` en bas à
   droite — l'éclairage d'un creux, inverse de celui du relief. C'est
   le liseré voulu, et il vient du dessin, pas d'un contour ajouté.

   ── CE À QUOI IL NE TOUCHE PAS ──────────────────────────────────
   Les trois masques d'origine (`mask_*`, `bevHL_*`, `bevSH_*`)
   encodent DÉJÀ les contre-formes en noir : le biseau et la lumière
   rasante ne peignent pas dans les trous. Il n'y a rien à y corriger.

   La rampe métal reste la rampe Nexus. Un badge est une marque, pas un
   élément de composition : il garde sa livrée quelle que soit la
   couleur d'équipe choisie dans la story — comme le wordmark reste
   blanc. C'est aussi ce que la fiche affiche, et la cohérence entre
   les deux prime.

   ── RELANCER ────────────────────────────────────────────────────
   node scripts/gen-story-badges.mjs
   À relancer si public/badges/ change. La sortie est déterministe :
   un second passage sans changement amont réécrit des fichiers
   identiques.
═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(RACINE, "public", "badges");
const DST = join(RACINE, "public", "story-badges");

/** La seule couleur SOMBRE réellement peinte des 22 fichiers. */
const CONTRE_FORME = "#131519";

/** badge-dans-la-mire.svg → dans_la_mire. Nomme les masques ajoutés. */
const cle = (nom) => nom.slice("badge-".length, -".svg".length).replace(/-/g, "_");

const entete = (nom, n) =>
  `<!-- GÉNÉRÉ par scripts/gen-story-badges.mjs depuis public/badges/${nom} — ` +
  `NE PAS ÉDITER À LA MAIN. ${n} contre-forme(s) percée(s) : sur une photo de ` +
  `story elles laissent passer le fond au lieu d'afficher un aplat sombre. ` +
  `La fiche de l'application lit l'original, inchangé. -->`;

function convertir(texte, nom) {
  const finDefs = texte.indexOf("</defs>");
  const tete = texte.slice(0, finDefs);
  const apres = texte.slice(finDefs + "</defs>".length);
  const corps = apres.slice(0, apres.lastIndexOf("</svg>"));

  const masques = [];
  let perces = 0;
  let i = 0;

  /* Le corps est une liste PLATE de groupes — vérifié sur les 22, aucun
     imbriqué. Un `<g>…</g>` non gourmand est donc sûr ici, et seulement
     ici : sur un SVG imbriqué il faudrait un vrai analyseur. */
  const corpsPerce = corps.replace(/<g\b([^>]*)>([\s\S]*?)<\/g>/g, (tout, ouvrant, contenu) => {
    if (!contenu.includes(CONTRE_FORME)) return tout;

    const transform = /transform="([^"]+)"/.exec(ouvrant)[1];
    const id = `storycut${i++}_${cle(nom)}`;

    const pochoir = contenu.replace(/<path fill="([^"]*)"/g, (_m, f) =>
      `<path fill="${f === CONTRE_FORME ? "#000000" : "#FFFFFF"}"`,
    );
    masques.push(
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="220" height="220">` +
        `<g transform="${transform}">${pochoir}</g></mask>`,
    );

    /* Les chemins restants gardent leur groupe transformé ET leur fill.
       `url(#metal_…)` est en userSpaceOnUse : sorti de son groupe, le
       dégradé se résoudrait dans un autre espace, donc un autre dessin. */
    const avant = contenu.length;
    const propre = contenu.replace(
      new RegExp(`<path fill="${CONTRE_FORME}" d="[^"]*"/>`, "g"),
      () => (perces++, ""),
    );
    if (propre.length === avant) throw new Error(`NEXUS: ${nom} — contre-forme non retirée`);

    return `<g mask="url(#${id})"><g transform="${transform}">${propre}</g></g>`;
  });

  const sortie =
    perces === 0
      ? texte // badge déjà propre : copie conforme
      : tete + masques.join("") + "</defs>" + corpsPerce + "</svg>";

  return { sortie: sortie.replace("<defs>", entete(nom, perces) + "<defs>"), perces };
}

mkdirSync(DST, { recursive: true });

let total = 0;
let fichiers = 0;
for (const nom of readdirSync(SRC).filter((n) => n.endsWith(".svg")).sort()) {
  const texte = readFileSync(join(SRC, nom), "utf8");
  const { sortie, perces } = convertir(texte, nom);

  /* GARDE-FOU. Hors des <mask>, plus une seule contre-forme peinte — si
     ce filet casse un jour, c'est que public/badges/ a changé de forme et
     que la substitution ci-dessus ne s'applique plus telle quelle. */
  if (sortie.replace(/<mask\b[\s\S]*?<\/mask>/g, "").includes(CONTRE_FORME)) {
    console.error(`NEXUS: ${nom} — contre-forme peinte résiduelle, abandon.`);
    process.exit(1);
  }

  writeFileSync(join(DST, nom), sortie, "utf8");
  const ko = (n) => (n / 1024).toFixed(0).padStart(4);
  console.log(
    `${nom.padEnd(28)} ${String(perces).padStart(3)} percée(s)   ` +
      `${ko(statSync(join(SRC, nom)).size)} Ko → ${ko(Buffer.byteLength(sortie))} Ko`,
  );
  total += perces;
  fichiers++;
}
console.log(`\n${fichiers} fichiers écrits dans public/story-badges/, ${total} contre-formes percées.`);
