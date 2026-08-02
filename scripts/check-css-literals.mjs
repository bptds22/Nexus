#!/usr/bin/env node
// scripts/check-css-literals.mjs
//
// POURQUOI CE SCRIPT EXISTE
// Nexus écrit 1412 règles CSS dans 15 littéraux de gabarit TypeScript, injectés
// par dangerouslySetInnerHTML. Ce CSS ne passe par AUCUN outil : ni PostCSS, ni
// Tailwind, ni un linter de feuille de style. Pour tsc et eslint, c'est une
// chaîne de caractères ; pour le navigateur, c'est du CSS qu'il répare en
// silence.
//
// Le bug qui a motivé l'outil : un commentaire fermé une ligne trop tôt, du
// texte nu derrière, puis un « */ » orphelin. Le parseur a avalé la règle
// suivante — .tabpane, qui portait la hauteur minimale de la page école. Le
// plancher valait 0px, la rangée d'onglets redevenait flottante, et tsc, eslint
// et le balayage d'encodage étaient TOUS verts. Seule une mesure dans le
// navigateur l'a montré.
//
// Ce que le script contrôle, par littéral :
//   • les commentaires sont équilibrés et aucun ne reste ouvert ;
//   • les accolades sont équilibrées, et jamais fermées en trop ;
// et il échoue en nommant le fichier et la LIGNE RÉELLE dans ce fichier.
//
// Il ne scanne que les fichiers SUIVIS PAR GIT : les doublons de synchronisation
// (« page 2.tsx ») ne sont pas du code du projet et ne doivent pas faire échouer
// la vérification.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const RACINE = path.resolve(import.meta.dirname, "..");

/** Un littéral est traité comme du CSS s'il contient une accolade ET un
 *  deux-points : ça écarte les gabarits de requête SQL et les chaînes de
 *  classes Tailwind, qui n'ont pas les deux. */
const RESSEMBLE_A_DU_CSS = (s) => s.includes("{") && s.includes(":");

const DECLARATION = /(?:export\s+)?const\s+(\w+)\s*=\s*`\n([\s\S]*?)\n`;/g;

function fichiersSuivis() {
  const sortie = execFileSync(
    "git",
    ["ls-files", "-z", "components", "app", "lib", "scripts"],
    { cwd: RACINE, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return sortie.split("\0").filter((f) => /\.(ts|tsx)$/.test(f));
}

/** Analyse un littéral CSS. Renvoie la liste des anomalies, chacune avec le
 *  décalage de ligne À L'INTÉRIEUR du littéral. */
function anomalies(css) {
  const trouve = [];
  let ligne = 1;
  let ouvertureCommentaire = null; // ligne du /* courant
  let dansCommentaire = false;
  const pileAccolades = [];

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "\n") { ligne++; continue; }
    if (dansCommentaire) {
      if (c === "*" && css[i + 1] === "/") { dansCommentaire = false; ouvertureCommentaire = null; i++; }
      continue;
    }
    if (c === "/" && css[i + 1] === "*") { dansCommentaire = true; ouvertureCommentaire = ligne; i++; continue; }
    if (c === "*" && css[i + 1] === "/") {
      trouve.push({ ligne, quoi: "« */ » sans « /* » ouvrant — le parseur avale la règle qui suit" });
      i++;
      continue;
    }
    if (c === "{") { pileAccolades.push(ligne); continue; }
    if (c === "}") {
      if (pileAccolades.length === 0) trouve.push({ ligne, quoi: "« } » en trop" });
      else pileAccolades.pop();
    }
  }
  if (dansCommentaire) {
    trouve.push({ ligne: ouvertureCommentaire, quoi: "commentaire « /* » jamais fermé" });
  }
  for (const l of pileAccolades) {
    trouve.push({ ligne: l, quoi: "« { » jamais fermée" });
  }
  return trouve;
}

let litteraux = 0;
let regles = 0;
const echecs = [];

for (const rel of fichiersSuivis()) {
  const src = readFileSync(path.join(RACINE, rel), "utf8");
  for (const m of src.matchAll(DECLARATION)) {
    const [, nom, css] = m;
    if (!RESSEMBLE_A_DU_CSS(css)) continue;
    litteraux++;
    regles += (css.match(/\{/g) ?? []).length;
    // ligne du « ` » ouvrant, +1 : le contenu commence à la ligne suivante
    const ligneBase = src.slice(0, m.index).split("\n").length + 1;
    for (const a of anomalies(css)) {
      echecs.push(`${rel}:${ligneBase + a.ligne - 1}  [${nom}] ${a.quoi}`);
    }
  }
}

if (echecs.length > 0) {
  console.error("CSS en littéral — anomalies détectées :\n");
  for (const e of echecs) console.error("  " + e);
  console.error(
    `\n${echecs.length} anomalie(s). Ce CSS ne passe par aucun linter : ` +
    "une accolade ou un commentaire déséquilibré fait disparaître des règles " +
    "sans aucune erreur au build.",
  );
  process.exit(1);
}

console.log(`CSS en littéral : ${litteraux} littéraux, ${regles} règles — équilibrés.`);
