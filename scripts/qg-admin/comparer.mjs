// QG admin — compare, clé par clé, la réponse de l'API (JSON) et le contrôle
// à la main (sortie « clé|valeur » de controle-main.sql).
//   node comparer.mjs <reponse.json> <controle.txt>
// Code de sortie 1 au moindre écart ou à la moindre clé manquante.
import { readFileSync } from "node:fs";

const [, , fJson, fSql] = process.argv;
const api = JSON.parse(readFileSync(fJson, "utf8"));
const sql = new Map(
  readFileSync(fSql, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.includes("|"))
    .map((l) => { const i = l.indexOf("|"); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

// Aplatir la réponse : booléens → 1/0, fenêtres ISO → millisecondes, libellés ignorés.
const plat = new Map();
(function aplatir(v, cle) {
  if (v === null || typeof v !== "object") {
    if (/(^|\.)libelle$/.test(cle) || cle === "calcule_le" || cle === "periode") return;
    let x = v;
    if (typeof v === "boolean") x = v ? 1 : 0;
    if (cle.startsWith("fenetres.")) x = new Date(v).getTime();
    plat.set(cle, String(x ?? "null"));
    return;
  }
  for (const [k, e] of Object.entries(v)) aplatir(e, cle ? `${cle}.${k}` : k);
})(api, "");

let ecarts = 0;
const cles = new Set([...plat.keys(), ...sql.keys()]);
for (const k of [...cles].sort()) {
  const a = plat.get(k);
  const s = sql.get(k);
  // Un rôle absent d'un côté vaut 0 de l'autre (par_role n'a que les rôles présents).
  if (/\.par_role\.[A-Z_]+$/.test(k) && (a ?? "0") === (s ?? "0")) continue;
  if (a !== s) { ecarts++; console.log(`ÉCART  ${k} : API=${a ?? "(absente)"}  SQL=${s ?? "(absente)"}`); }
}
console.log(`${fJson} : ${plat.size} chiffres dans la réponse, ${sql.size} recalculés en SQL, ${ecarts} écart(s).`);
process.exit(ecarts ? 1 : 0);
