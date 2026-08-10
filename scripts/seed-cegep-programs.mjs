// scripts/seed-cegep-programs.mjs  (UNTRACKED one-shot — Bloc 2 étape 3b, seed programmes)
// ============================================================================
// Insère les programmes des 2 JSON (cegep_programs.json +
// cegep_programs_prives_verifie.json) dans public.school_programs, écoles
// MATCHÉES seulement. is_displayed=true, source='seed'.
//
//   - matching jaccard (idem étape 3a) + 3 overrides manuels (Drummond→ville,
//     St-Félicien ×2→Saint-Félicien) ; skip des 8 (à distance/virtuel + 6 spécialisées).
//   - type NORMALISÉ 'préuniversitaire'→'preuniversitaire' (CHECK DB sans accent).
//   - dédup (school_id, lower(name)) intra-batch (campus fusionnés), garde la
//     version AVEC code si dispo.
//   - INSERT pur par chunks de 500 ; --dry valide + rapporte, n'insère pas.
//
// URL + service role depuis .env.local.prod. Garde-fou URL.
// Usage : node scripts/seed-cegep-programs.mjs --dry | node scripts/seed-cegep-programs.mjs
// ============================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMP = path.join(ROOT, "data/import");
const DRY = process.argv.includes("--dry");
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const CHUNK = 500;

// overrides manuels (faux négatifs récupérés — étape 3a)
const OVERRIDE = [
  { re: /^Cégep de Drummond$/i, school_id: "3cfd174c-95fe-4b82-b96c-61a045e8e5d9" }, // Drummondville
  { re: /St-Félicien/i, school_id: "a6bca573-294c-4959-b5e7-530b58c2ad4f" },          // Saint-Félicien
];
// skip explicites (2 vrais + 6 spécialisées incl. Kiuna)
const SKIP = /à distance|virtuel|École des pêches|École nationale d'aéro|École nationale du meuble|Art et technologie des médias|Institut maritime|Kiuna/i;

function loadEnvProd() {
  const raw = readFileSync(path.join(ROOT, ".env.local.prod"), "utf-8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return env;
}
const env = loadEnvProd();
if (env.NEXT_PUBLIC_SUPABASE_URL !== EXPECTED_URL) { console.error(`ABORT URL="${env.NEXT_PUBLIC_SUPABASE_URL}"`); process.exit(1); }
const supabase = createClient(EXPECTED_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
console.log(`Cible: ${EXPECTED_URL} (service role longueur=${env.SUPABASE_SERVICE_ROLE_KEY.length})`);

const STOP = new Set("cegep college collegial collegiale cegeps de du des la le les a au aux et campus centre centres etudes collegiales formation continue service services entreprises extra distance regional regionale institut international inc".split(" "));
const toks = (n) => {
  n = String(n || "").replace(/\(.*?\)/g, " ").replace(/\s*-\s*EXTRA.*$/i, "").replace(/formation continue.*|formation aux entreprises.*|service aux entreprises.*/i, "");
  const s = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return new Set(s.split(" ").filter((t) => t.length >= 2 && !STOP.has(t)));
};
const jac = (a, b) => { const i = [...a].filter((x) => b.has(x)).length; return i / (a.size + b.size - i || 1); };
const normType = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().startsWith("preuni") ? "preuniversitaire" : "technique";

const pub = JSON.parse(readFileSync(path.join(IMP, "cegep_programs.json"), "utf-8"));
const priv = JSON.parse(readFileSync(path.join(IMP, "cegep_programs_prives_verifie.json"), "utf-8")).colleges.filter((c) => c.programs.length);
const estabs = [...pub.map((e) => ({ name: e.institution, programs: e.programs })), ...priv.map((e) => ({ name: e.institution, programs: e.programs }))];

const { data: schools, error } = await supabase.from("schools").select("id,name").eq("type", "CEGEP");
if (error) { console.error("ABORT schools:", error.message); process.exit(1); }
const st = schools.map((s) => ({ ...s, t: toks(s.name) }));

function resolve(name) {
  for (const o of OVERRIDE) if (o.re.test(name)) return o.school_id;
  if (SKIP.test(name)) return null;
  const et = toks(name);
  const ranked = st.map((s) => ({ s, j: jac(et, s.t) })).sort((a, b) => b.j - a.j);
  const [b1, b2] = ranked;
  return b1 && b1.j >= 0.6 && (!b2 || b1.j - b2.j >= 0.15) ? b1.s.id : null;
}

// dédup (school_id, lower(name)) — garde la version avec code
const byKey = new Map();
let skipped = 0;
for (const e of estabs) {
  const sid = resolve(e.name);
  if (!sid) { skipped++; continue; }
  for (const p of e.programs) {
    const key = sid + "|" + p.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const row = { school_id: sid, name: p.name, code: p.code ?? null, type: normType(p.type), is_displayed: true, source: "seed" };
    const cur = byKey.get(key);
    if (!cur || (!cur.code && row.code)) byKey.set(key, row);
  }
}
const rows = [...byKey.values()].map((r, i) => ({ ...r, position: i }));
const bySchool = {};
for (const r of rows) bySchool[r.school_id] = (bySchool[r.school_id] || 0) + 1;

console.log(`\n=== PLAN ===`);
console.log(`établissements-seed: ${estabs.length} | skippés: ${skipped} | écoles distinctes ciblées: ${Object.keys(bySchool).length}`);
console.log(`lignes à insérer (dédupées): ${rows.length} | avec code: ${rows.filter((r) => r.code).length} | préuni: ${rows.filter((r) => r.type === "preuniversitaire").length} / tech: ${rows.filter((r) => r.type === "technique").length}`);
const grasset = rows.filter((r) => r.school_id === "05841265-fd61-466e-b431-2caa7ec06de9");
console.log(`Grasset (05841265…): ${grasset.length} programmes -> ${grasset.map((r) => r.name).join(" · ")}`);

if (DRY) { console.log(`\n[--dry] rien inséré. sample:`, JSON.stringify(rows[0])); process.exit(0); }

let total = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { data, error: e } = await supabase.from("school_programs").insert(chunk).select("id");
  if (e) { console.error(`CHUNK ${Math.floor(i / CHUNK) + 1}: ERREUR="${e.message}" — STOP`); process.exit(1); }
  total += data.length;
  console.log(`CHUNK ${Math.floor(i / CHUNK) + 1}: +${data.length} total=${total}`);
}
console.log(`\nDONE — ${total} programmes seedés.`);
