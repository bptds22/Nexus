// scripts/match-cegep-seed.mjs  (READ-ONLY — Bloc 2 étape 3a, matching à blanc)
// ============================================================================
// Apparie les établissements des 2 JSON de seed (cegep_programs.json +
// cegep_programs_prives_verifie.json) aux public.schools type='CEGEP'.
// AUCUNE écriture. Rapporte MATCHÉS / AMBIGUS / SANS_CIBLE.
//
// Normalisation = technique bridge RSEQ : on retire le bruit campus/formation-
// continue/à-distance, on tokenise hors stopwords, jaccard. MATCHÉ si meilleur
// score ≥ 0.6 et nettement au-dessus du 2e ; AMBIGU si 2 candidats proches ;
// SANS_CIBLE sinon.
//
// URL + service role depuis .env.local.prod uniquement. Garde-fou URL.
// ============================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMP = path.join(ROOT, "data/import");
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";

function loadEnvProd() {
  const raw = readFileSync(path.join(ROOT, ".env.local.prod"), "utf-8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return env;
}
const env = loadEnvProd();
if (env.NEXT_PUBLIC_SUPABASE_URL !== EXPECTED_URL) { console.error("ABORT URL"); process.exit(1); }
const supabase = createClient(EXPECTED_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const STOP = new Set("cegep college collegial collegiale cegeps de du des la le les a au aux et campus centre centres etudes collegiales formation continue service services entreprises extra distance regional regionale institut international inc".split(" "));
function toks(n) {
  n = String(n || "").replace(/\(.*?\)/g, " ").replace(/\s*-\s*EXTRA.*$/i, "")
    .replace(/formation continue.*|formation aux entreprises.*|service aux entreprises.*/i, "");
  const s = n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return new Set(s.split(" ").filter((t) => t.length >= 2 && !STOP.has(t)));
}
function jac(a, b) { const i = [...a].filter((x) => b.has(x)).length; return i / (a.size + b.size - i || 1); }

const pub = JSON.parse(readFileSync(path.join(IMP, "cegep_programs.json"), "utf-8"));
const priv = JSON.parse(readFileSync(path.join(IMP, "cegep_programs_prives_verifie.json"), "utf-8")).colleges.filter((c) => c.programs.length);
const estabs = [
  ...pub.map((e) => ({ name: e.institution, src: "public" })),
  ...priv.map((e) => ({ name: e.institution, src: "prive" })),
];

const { data: schools, error } = await supabase.from("schools").select("id,name,region").eq("type", "CEGEP");
if (error) { console.error("ABORT schools:", error.message); process.exit(1); }
const st = schools.map((s) => ({ ...s, t: toks(s.name) }));

const matched = [], ambigu = [], sansCible = [];
for (const e of estabs) {
  const et = toks(e.name);
  const ranked = st.map((s) => ({ s, j: jac(et, s.t) })).sort((a, b) => b.j - a.j);
  const [b1, b2] = ranked;
  if (b1.j >= 0.6 && (!b2 || b1.j - b2.j >= 0.15)) matched.push({ ...e, school: b1.s.name, school_id: b1.s.id, j: +b1.j.toFixed(2) });
  else if (b1.j >= 0.5 && b2 && b1.j - b2.j < 0.15) ambigu.push({ ...e, c1: b1.s.name, c2: b2.s.name, j1: +b1.j.toFixed(2), j2: +b2.j.toFixed(2) });
  else sansCible.push({ ...e, best: b1 ? b1.s.name : "—", j: b1 ? +b1.j.toFixed(2) : 0 });
}

console.log(`établissements seed: ${estabs.length} (public ${pub.length} + privé ${priv.length}) | schools CEGEP: ${st.length}`);
console.log(`\n=== MATCHÉS: ${matched.length} ===`);
for (const m of matched) console.log(`  [${m.src[0]}] ${m.name.slice(0, 40).padEnd(40)} -> ${m.school.slice(0, 38)} (${m.j})`);
console.log(`\n=== AMBIGUS: ${ambigu.length} ===`);
for (const a of ambigu) console.log(`  [${a.src[0]}] ${a.name.slice(0, 38)} -> ${a.c1} (${a.j1}) VS ${a.c2} (${a.j2})`);
console.log(`\n=== SANS_CIBLE: ${sansCible.length} ===`);
for (const s of sansCible) console.log(`  [${s.src[0]}] ${s.name.slice(0, 50)} (meilleur ${s.best.slice(0, 30)} ${s.j})`);
console.log(`\nGrasset ?`, matched.find((m) => /Grasset/.test(m.name)) || ambigu.find((m) => /Grasset/.test(m.name)) || sansCible.find((m) => /Grasset/.test(m.name)));
