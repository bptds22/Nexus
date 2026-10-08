// Ajoute au CSV de revue la colonne « remarque » (lecture humaine, 2026-10-07) :
// ce qui semble juste, douteux ou introuvable, au regard de l'équipe qui y joue.
//   node scripts/carte-matchs-lot-b/annoter-revue.mjs [revue.csv]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ICI = path.dirname(fileURLToPath(import.meta.url));
const F = process.argv[2] ?? path.join(ICI, "terrains-civils-revue.csv");
const R = {
  "centre claude robillard 1": "INTROUVABLE — Complexe sportif Claude-Robillard, Montréal (Ahuntsic) : coordonnées à poser à la main",
  "d arcy mcgee": "DOUTEUX — équipe de Gatineau (Vikings) : probablement l'école D'Arcy McGee de Gatineau, pas le parc du Sud-Ouest de Montréal",
  "glenn f mchugh field": "INTROUVABLE — North Shore Mustangs (QMFL) : à poser à la main",
  "gil o julien park": "Ontario (Ottawa) — cohérent avec North Gloucester Giants",
  "nepean sportsplex": "Ontario (Ottawa) — cohérent avec Bel Air Norsemen",
  "parc ducharme": "DOUTEUX — trouvé à Sherbrooke ; Wildcats (LFMM, région de Montréal) : vérifier",
  "parc pierre laporte elie saab 1": "DOUTEUX — trouvé à Québec (Loretteville) ; Grizzlis (LFMM) : vérifier",
  "parc des benevoles": "À VÉRIFIER — Pierrefonds-Roxboro ; Cougars (LFMM)",
  "parc gerry datillio": "INTROUVABLE — Laval Bulldogs : à poser à la main (même lieu que la ligne suivante)",
  "parc gerry dattillio": "INTROUVABLE — même lieu que la ligne précédente (orthographe différente à la source)",
  "stade hebert": "FAUX — trouvé « Stade Robert-Lessard » à Saint-Wenceslas ; Stade Hébert est à Saint-Léonard (Montréal), St. Leonard Cougars",
  "terrain martin charpentier": "INTROUVABLE — Vandoos (LFMM) : à poser à la main",
  "ecole secondaire polybel polybel": "Même lieu que « École secondaire Polybel » (libellé source différent)",
  "parc st laurent": "Même lieu que « Parc Saint-Laurent » (libellé source différent)",
};
let txt = fs.readFileSync(F, "utf8").replace(/^﻿/, "");
const lignes = txt.trimEnd().split(/\r?\n/);
const sortie = lignes.map((l, i) => {
  if (i === 0) return l.includes(",remarque") ? l : `${l},remarque`;
  const cle = JSON.parse(l.slice(0, l.indexOf('",') + 1));
  return `${l},"${(R[cle] ?? "Semble juste").replace(/"/g, '""')}"`;
});
fs.writeFileSync(F, "﻿" + sortie.join("\r\n") + "\r\n", "utf8");
console.log(`${sortie.length - 1} lignes annotées`);
