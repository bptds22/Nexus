// scripts/insert-rseq-teams.mjs  (UNTRACKED one-shot — Bridge RSEQ Phase 3)
// ============================================================================
// Insère les équipes RSEQ scolaire+collégial validées au dry-run dans
// public.teams sur nexus-prod. INSERT pur par chunks de 500 :
//   - AUCUN upsert, AUCUN update, AUCUN delete.
//   - Arrêt IMMÉDIAT au premier chunk en erreur (pas de continue silencieux).
//   - Log par chunk : rows envoyées / rows insérées / total.
//
// URL + service role chargés UNIQUEMENT depuis .env.local.prod (jamais en dur).
// Garde-fou : si l'URL != nexus-prod attendu -> ABORT avant toute connexion.
//
// Usage :
//   node scripts/insert-rseq-teams.mjs --dry   # valide tout, N'INSÈRE PAS
//   node scripts/insert-rseq-teams.mjs         # insère pour de vrai
//   (chemin du JSON overridable en 1er arg positionnel)
// ============================================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const argPath = process.argv.slice(2).find((a) => !a.startsWith("--"));
const INSERT_JSON =
  argPath ||
  "C:/Users/bptds/AppData/Local/Temp/claude/C--Users-bptds/e9f6ab62-1e7b-4fda-875e-9fd93ed77e21/scratchpad/insert_rows.json";

const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const CHUNK = 500;

/* ── charge .env.local.prod SEULEMENT (pas .env.local = docker local) ── */
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

/* ── garde-fou cible ── */
if (URL !== EXPECTED_URL) {
  console.error(`ABORT: NEXT_PUBLIC_SUPABASE_URL="${URL}" != "${EXPECTED_URL}"`);
  process.exit(1);
}
if (!KEY) {
  console.error("ABORT: SUPABASE_SERVICE_ROLE_KEY absent de .env.local.prod");
  process.exit(1);
}
console.log(`Cible confirmée: ${URL}  (service role longueur=${KEY.length}, valeur jamais affichée)`);

/* ── charge le set validé ── */
const rows = JSON.parse(readFileSync(INSERT_JSON, "utf-8"));
const payload = rows.map((r) => ({
  school_id: r.school,
  sport_id: r.sport,
  name: r.name,
  age_group: r.age,
  gender: r.gender,
  division: r.division, // peut être null
  season: r.season,
  is_active: true,
}));
console.log(`Chargé ${payload.length} rows depuis ${INSERT_JSON}`);

/* ── intégrité minimale avant tout write ── */
const bad = payload.filter((p) => !p.school_id || !p.sport_id || !p.name);
if (bad.length) {
  console.error(`ABORT: ${bad.length} rows sans school_id/sport_id/name`);
  process.exit(1);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badId = payload.filter((p) => !uuid.test(p.school_id) || !uuid.test(p.sport_id));
if (badId.length) {
  console.error(`ABORT: ${badId.length} rows avec uuid invalide`);
  process.exit(1);
}

if (DRY) {
  const bySeason = {};
  for (const p of payload) bySeason[p.season] = (bySeason[p.season] || 0) + 1;
  console.log("[--dry] validation OK. Rien inséré.");
  console.log("[--dry] par saison:", JSON.stringify(bySeason));
  console.log("[--dry] chunks prévus:", Math.ceil(payload.length / CHUNK), `(taille ${CHUNK})`);
  console.log("[--dry] sample row:", JSON.stringify(payload[0]));
  process.exit(0);
}

/* ── INSERT réel par chunks ── */
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
let total = 0;
for (let i = 0; i < payload.length; i += CHUNK) {
  const chunk = payload.slice(i, i + CHUNK);
  const n = Math.floor(i / CHUNK) + 1;
  const { data, error } = await supabase.from("teams").insert(chunk).select("id"); // INSERT pur (pas upsert)
  if (error) {
    console.error(`CHUNK ${n}: envoyées=${chunk.length} insérées=0 ERREUR="${error.message}"`);
    console.error("STOP immédiat — aucun continue silencieux.");
    process.exit(1);
  }
  total += data.length;
  console.log(`CHUNK ${n}: envoyées=${chunk.length} insérées=${data.length} total=${total}`);
}
console.log(`DONE — ${total} teams insérées.`);
