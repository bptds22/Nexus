// scripts/load-rseq-games.mjs  (UNTRACKED — Phase 4A : premier load des matchs RSEQ)
// ============================================================================
// Charge rseq_calendar_all.json + rseq_calendar_collegial.json dans public.games.
//   - INSERT pur : ON CONFLICT (rseq_game_id) DO NOTHING (ignoreDuplicates).
//     (le mode DO UPDATE des scores = re-run de septembre, PAS ce load.)
//   - home/visitor_team_id résolus via teams.rseq_team_id ; NULL + noms bruts
//     conservés sinon. Toutes les colonnes du schéma games approuvé.
//   - dédup intra-batch sur rseq_game_id (garde la 1re occurrence) + rapport.
//
// URL + service role depuis .env.local.prod. Garde-fou URL. chunks 500, stop-on-error.
// Usage :  node scripts/load-rseq-games.mjs --dry  |  node scripts/load-rseq-games.mjs
// ============================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const IMP = path.join(ROOT, "data/import");
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const CHUNK = 500;

function loadEnvProd() {
  const raw = readFileSync(path.join(ROOT, ".env.local.prod"), "utf-8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  return env;
}
const env = loadEnvProd();
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (URL !== EXPECTED_URL) { console.error(`ABORT: URL="${URL}" != "${EXPECTED_URL}"`); process.exit(1); }
if (!KEY) { console.error("ABORT: service role absent"); process.exit(1); }
console.log(`Cible confirmée: ${URL}  (service role longueur=${KEY.length})`);
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

/* rseq_team_id -> teams.id (7172 pontées) */
const team = new Map();
{ let from = 0; for (;;) {
  const { data, error } = await supabase.from("teams").select("id,rseq_team_id").not("rseq_team_id","is",null).range(from, from+999);
  if (error) { console.error("ABORT teams:", error.message); process.exit(1); }
  for (const t of data) team.set(t.rseq_team_id, t.id);
  if (data.length < 1000) break; from += 1000;
} }
console.log(`teams pontées chargées: ${team.size}`);

/* charge + normalise les 2 calendriers, dédup intra-batch sur rseq_game_id */
const SENTINEL = -999;
const byGame = new Map();
let dup = 0, srcTotal = 0;
const bySeason = {}, bySector = {};
let r2 = 0, r1 = 0, r0 = 0;
for (const f of ["rseq_calendar_all.json", "rseq_calendar_collegial.json"]) {
  const cal = JSON.parse(readFileSync(path.join(IMP, f), "utf-8"));
  for (const g of cal) {
    srcTotal++;
    if (byGame.has(g.game_id)) { dup++; continue; }
    const sc = (g.score && typeof g.score === "object") ? g.score : null;
    const hs = sc && sc.home !== SENTINEL ? sc.home : null;
    const vs = sc && sc.visitor !== SENTINEL ? sc.visitor : null;
    const hid = g.home_team_id ? (team.get(g.home_team_id) ?? null) : null;
    const vid = g.visitor_team_id ? (team.get(g.visitor_team_id) ?? null) : null;
    const nres = (hid ? 1 : 0) + (vid ? 1 : 0);
    if (nres === 2) r2++; else if (nres === 1) r1++; else r0++;
    bySeason[g.season] = (bySeason[g.season]||0)+1;
    bySector[g.sector||"?"] = (bySector[g.sector||"?"]||0)+1;
    byGame.set(g.game_id, {
      rseq_game_id: g.game_id, game_no: g.game_no ?? null, season: g.season, sector: g.sector ?? null,
      phase: g.phase, game_date: g.date || null, game_time: g.time ?? null,
      home_team_id: hid, visitor_team_id: vid,
      home_rseq_team_id: g.home_team_id ?? null, visitor_rseq_team_id: g.visitor_team_id ?? null,
      home_name_raw: g.home_team ?? null, visitor_name_raw: g.visitor_team ?? null,
      home_code: g.home_code ?? null, visitor_code: g.visitor_code ?? null,
      home_score: hs, visitor_score: vs, result_formatted: sc ? (sc.result_formatted ?? null) : null,
      home_forfeit: sc ? !!sc.home_forfeit : false, visitor_forfeit: sc ? !!sc.visitor_forfeit : false,
      is_played: !!(sc && (hs !== null || vs !== null)),
      venue: g.venue ?? null, venue_lat: g.venue_lat ?? null, venue_lon: g.venue_lon ?? null,
      field_number: g.field_number ?? null, is_released: g.is_released ?? null,
      rseq_league_id: g.league_id ?? null, league_name: g.league_name ?? null, sport: g.sport ?? null,
      region: g.region ?? null, division: g.division ?? null, category: g.category ?? null, sex_type: g.sex_type ?? null,
    });
  }
}
const rows = [...byGame.values()];
console.log(`\n=== PLAN ===`);
console.log(`matchs sources:            ${srcTotal}`);
console.log(`doublons rseq_game_id:     ${dup}  (intra-batch, gardé 1re occurrence)`);
console.log(`matchs uniques à insérer:  ${rows.length}`);
console.log(`par saison:`, JSON.stringify(bySeason));
console.log(`par secteur:`, JSON.stringify(bySector));
console.log(`résolution équipes: 2 teams=${r2} (${(100*r2/rows.length).toFixed(1)}%) | 1 team=${r1} (${(100*r1/rows.length).toFixed(1)}%) | 0 team=${r0} (${(100*r0/rows.length).toFixed(1)}%)`);
console.log(`chunks prévus: ${Math.ceil(rows.length/CHUNK)} (taille ${CHUNK})`);

if (DRY) { console.log(`\n[--dry] rien inséré. sample:`, JSON.stringify(rows.find(r=>r.home_team_id))); process.exit(0); }

let total = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error, count } = await supabase.from("games").upsert(chunk, { onConflict: "rseq_game_id", ignoreDuplicates: true, count: "exact" });
  if (error) { console.error(`CHUNK ${Math.floor(i/CHUNK)+1}: ERREUR="${error.message}" — STOP`); process.exit(1); }
  total += chunk.length;
  console.log(`CHUNK ${Math.floor(i/CHUNK)+1}: envoyées=${chunk.length} total_envoyées=${total}`);
}
console.log(`\nDONE — ${total} matchs envoyés (ON CONFLICT DO NOTHING).`);
