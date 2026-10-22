// QG admin — balayage des réponses de l'API : @, UUID, courriels, noms.
//   node balayage.mjs <liste-de-noms.txt> <reponse.json>...
// Les noms sont cherchés comme MOTS ENTIERS dans les VALEURS seulement (pas
// dans les clés JSON), puis aussi dans le texte entier pour signaler les faux
// positifs. La liste de noms n'est jamais écrite dans le dépôt.
import { readFileSync } from "node:fs";

const [, , fNoms, ...fichiers] = process.argv;
const noms = readFileSync(fNoms, "utf8").replace(/^﻿/, "").split(/\r?\n/).map((n) => n.trim()).filter((n) => n.length >= 3);
const valeurs = (v, out = []) => {
  if (v === null || typeof v !== "object") { out.push(String(v)); return out; }
  for (const e of Object.values(v)) valeurs(e, out);
  return out;
};
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mot = (n) => new RegExp(`(^|[^\\p{L}])${echapper(n)}($|[^\\p{L}])`, "iu");

for (const f of fichiers) {
  const texte = readFileSync(f, "utf8");
  const v = valeurs(JSON.parse(texte)).join("\n");
  const arobase = (texte.match(/@/g) ?? []).length;
  const uuid = (texte.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []).length;
  const courriel = (texte.match(/[^\s"@]+@[^\s"@]+\.[a-z]{2,}/gi) ?? []).length;
  const dansValeurs = noms.filter((n) => mot(n).test(v));
  const dansTexte = noms.filter((n) => mot(n).test(texte));
  console.log(`${f} : @=${arobase} UUID=${uuid} courriels=${courriel} noms dans les valeurs=${dansValeurs.length}` +
    ` (${noms.length} noms cherchés) ; avec les clés : ${dansTexte.length}${dansTexte.length ? ` — mots des clés : ${dansTexte.join(", ")}` : ""}`);
}
