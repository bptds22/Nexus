// Génère un fichier prod du lot D0, D1a ou D1a2 cégep à partir de docs/cegep-lot-d/prod/<lot>.gabarit.sql
// → docs/cegep-lot-d/prod/<lot>-<type>-<date>.sql, migration et rollback embarqués tels quels (LF), md5 gardés.
// Le gabarit porte les deux suites : blocs « -- [[REJEU … -- REJEU]] » et « -- [[APPLY … -- APPLY]] ».
// Usage : node scripts/cegep-lot-d/generer.mjs 20261028 [rejeu-blanc|apply] [d0|d1a|d1a2]
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date, type = "rejeu-blanc", lot = "d0"] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
if (!["rejeu-blanc", "apply"].includes(type)) throw new Error("type inconnu : " + type);

const LOTS = {
  d0: ["20261028000000", "cegep_lot_d0_base"],
  d1a: ["20261028010000", "cegep_lot_d1a_universites_masquees"],
  d1a2: ["20261028020000", "cegep_lot_d1a2_definer"],
  d2a: ["20261028030000", "cegep_lot_d2a_recruteur_universitaire"],
  d3a: ["20261028040000", "cegep_lot_d3a_universitaire_cegepiens_seulement"],
  d3c: ["20261028050000", "cegep_lot_d3c_universitaire_voit_tout"],
  d3d: ["20261028060000", "cegep_lot_d3d_nom_ecole_recruteurs"],
  d5a: ["20261028070000", "cegep_lot_d5a_ecriture_universites"],
  t: ["20261028080000", "teams_ecriture_coachs"],
  d5a2: ["20261028090000", "cegep_lot_d5a_programmes_universitaires"],
  e1: ["20261028130000", "cegep_lot_e1_cibles_universitaires"],
  e2: ["20261028140000", "cegep_lot_e2_pages_equipes_universitaires"],
  e3: ["20261028150000", "cegep_lot_e3_cycle_libre"],
  badge: ["20261029150000", "badge_auto_cegep_validation"],
  puv: ["20261029160000", "programme_universitaire_vise"],
};
if (!LOTS[lot]) throw new Error("lot inconnu : " + lot);
const [VERSION, NOM] = LOTS[lot];
const MIG = `supabase/migrations/${VERSION}_${NOM}.sql`;
const RB = `supabase/rollback/${VERSION}_rollback_${NOM}.sql`;
const GAB = `docs/cegep-lot-d/prod/${lot}.gabarit.sql`;
const OUT = `docs/cegep-lot-d/prod/${lot}-${type}-${date}.sql`;

const lf = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const mig = lf(MIG), rb = lf(RB);
for (const [nom, t] of [[MIG, mig], [RB, rb]]) {
  if (t.includes("$nexus_mig$") || t.includes("$nexus_rb$")) throw new Error("délimiteur présent dans " + nom);
}

const apply = type === "apply";
function bloc(t, nom, garde) {
  const ouv = `-- [[${nom}\n`, fer = `-- ${nom}]]\n`;
  const i = t.indexOf(ouv), j = t.indexOf(fer);
  if (i < 0 || j < i) throw new Error("bloc " + nom + " introuvable");
  return t.slice(0, i) + (garde ? t.slice(i + ouv.length, j) : "") + t.slice(j + fer.length);
}

let g = lf(GAB);
g = bloc(bloc(g, apply ? "REJEU" : "APPLY", false), apply ? "APPLY" : "REJEU", true);
const remplacer = {
  "@@MD5_MIGRATION@@": md5(mig),
  "@@MD5_ROLLBACK@@": md5(rb),
  "@@VERSION@@": VERSION,
  "@@MODE@@": type,
  "@@TITRE@@": apply ? "APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc)" : "REJEU À BLANC (finit par ROLLBACK)",
  "@@SUITE@@": apply ? "inscription (schema_migrations + admin_operations) → COMMIT" : `rollback ${lot.toUpperCase()} joué et vérifié → ROLLBACK`,
};
for (const [k, v] of Object.entries(remplacer)) g = g.split(k).join(v);
if (/@@[A-Z_0-9]+@@/.test(g.replace("@@MIGRATION@@", "").replace("@@ROLLBACK@@", ""))) throw new Error("marqueur non remplacé");
g = g.replace("@@MIGRATION@@", () => mig).replace("@@ROLLBACK@@", () => rb);
if (/-- \[\[(REJEU|APPLY)|-- (REJEU|APPLY)\]\]/.test(g)) throw new Error("bloc non retiré");
fs.writeFileSync(OUT, g);
console.log(`migration ${md5(mig)}  rollback ${md5(rb)}  généré ${md5(g)}  ${OUT}`);
