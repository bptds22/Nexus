// scripts/insert-rseq-rerun.mjs  (UNTRACKED one-shot — Chantier écoles manquantes, re-run pipeline teams)
// ============================================================================
// Insère les équipes RSEQ des NOUVELLES écoles pontées (chantier écoles
// manquantes) dans public.teams sur nexus-prod. Reproduit EXACTEMENT la logique
// Phase 3 (_teams_allsports) :
//   - identité (school_id, sport_id, name, age_group=category, division, gender)
//   - saison = NULL (convention Phase 3)
//   - dédup vs teams existants (même 6-uplet, season IS NULL) + intra-batch
//   - INSERT pur par chunks de 500, AUCUN upsert/update/delete, stop au 1er err.
//
// URL + service role chargés UNIQUEMENT depuis .env.local.prod. Garde-fou URL.
//
// Entrées (scratchpad) : rerun_cand.json (iid,sport_id,name,age,div,gender),
//                        iids83.json (les 83 institution_ids pontées).
// Usage :  node scripts/insert-rseq-rerun.mjs --dry   |   node scripts/insert-rseq-rerun.mjs
// ============================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const SP = "C:/Users/bptds/AppData/Local/Temp/claude/C--Users-bptds/e9f6ab62-1e7b-4fda-875e-9fd93ed77e21/scratchpad/";
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const CHUNK = 500;

function loadEnvProd() {
  const raw = readFileSync(path.join(ROOT, ".env.local.prod"), "utf-8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}
const env = loadEnvProd();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (URL !== EXPECTED_URL) { console.error(`ABORT: URL="${URL}" != "${EXPECTED_URL}"`); process.exit(1); }
if (!KEY) { console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY absent"); process.exit(1); }
console.log(`Cible confirmée: ${URL}  (service role longueur=${KEY.length}, jamais affichée)`);

const cand = JSON.parse(readFileSync(SP + "rerun_cand.json", "utf-8"));
const iids = JSON.parse(readFileSync(SP + "iids83.json", "utf-8"));
console.log(`candidats chargés: ${cand.length} | institutions: ${iids.length}`);

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

/* ── iid -> school_id (résolution via le pont GUID) ── */
const iid2school = new Map();
for (let i = 0; i < iids.length; i += 200) {
  const batch = iids.slice(i, i + 200);
  const { data, error } = await supabase.from("schools").select("id,rseq_institution_id").in("rseq_institution_id", batch);
  if (error) { console.error("ABORT schools fetch:", error.message); process.exit(1); }
  for (const s of data) iid2school.set(s.rseq_institution_id, s.id);
}
console.log(`écoles résolues: ${iid2school.size}/${iids.length}`);
const schoolIds = [...iid2school.values()];

/* ── teams existants sur ces écoles (dédup, season IS NULL) ── */
const existing = new Set();
for (let i = 0; i < schoolIds.length; i += 100) {
  const batch = schoolIds.slice(i, i + 100);
  const { data, error } = await supabase.from("teams")
    .select("school_id,sport_id,name,age_group,division,gender,season").in("school_id", batch);
  if (error) { console.error("ABORT teams fetch:", error.message); process.exit(1); }
  // dédup sur le 6-uplet d'IDENTITÉ (ignore season, comme l'adoption) — une seule
  // ligne par identité, peu importe la saison déjà stockée.
  for (const t of data)
    existing.add([t.school_id, t.sport_id, t.name, t.age_group || "", t.division || "", t.gender || ""].join("||"));
}
console.log(`teams existants (identité, toutes saisons) sur ces écoles: ${existing.size}`);

/* ── construit le payload, dédup vs existant ── */
const payload = [];
let skip_present = 0, skip_noschool = 0;
for (const c of cand) {
  const school_id = iid2school.get(c.iid);
  if (!school_id) { skip_noschool++; continue; }
  const key = [school_id, c.sport_id, c.name, c.age || "", c.div || "", c.gender || ""].join("||");
  if (existing.has(key)) { skip_present++; continue; }
  payload.push({ school_id, sport_id: c.sport_id, name: c.name,
    division: c.div || null, age_group: c.age || null, gender: c.gender || null,
    season: c.season || null, is_active: true });
}
console.log(`\n=== PLAN ===`);
console.log(`à insérer:            ${payload.length}`);
console.log(`skip — déjà présent:  ${skip_present}`);
console.log(`skip — école absente: ${skip_noschool}`);
console.log(`chunks prévus:        ${Math.ceil(payload.length / CHUNK)} (taille ${CHUNK})`);
const bySport = {};
for (const p of payload) bySport[p.sport_id] = (bySport[p.sport_id] || 0) + 1;
console.log(`sports distincts:     ${Object.keys(bySport).length}`);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = payload.filter((p) => !uuid.test(p.school_id) || !uuid.test(p.sport_id) || !p.name);
if (bad.length) { console.error(`ABORT: ${bad.length} rows invalides`); process.exit(1); }

if (DRY) { console.log(`\n[--dry] validation OK. Rien inséré. sample:`, JSON.stringify(payload[0])); process.exit(0); }

let total = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const n = Math.floor(i / CHUNK) + 1;
  const { data, error } = await supabase.from("teams").insert(chunk).select("id");
  if (error) { console.error(`CHUNK ${n}: envoyées=${chunk.length} insérées=0 ERREUR="${error.message}" — STOP`); process.exit(1); }
  total += data.length;
  console.log(`CHUNK ${n}: envoyées=${chunk.length} insérées=${data.length} total=${total}`);
}
console.log(`\nDONE — ${total} teams insérées.`);
