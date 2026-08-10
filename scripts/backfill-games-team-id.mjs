// scripts/backfill-games-team-id.mjs
// ============================================================================
// Pose games.home_team_id / visitor_team_id à partir des clés RSEQ déjà
// présentes sur les matchs (home_rseq_team_id / visitor_rseq_team_id) et du
// pont teams.rseq_team_id.
//
// POURQUOI un second script : ponter `teams` ne suffit pas. Les matchs portent
// la clé RSEQ mais pas la clé Nexus, et RIEN ne la résout — ni trigger, ni vue,
// ni recalcul au chargement. C'est cette passe qui débloque réellement le
// calendrier et team_record_hint.
//
// Purement DÉRIVÉ et idempotent : on ne pose que là où c'est NULL, et la
// source est une jointure exacte sur un identifiant. Aucun rapprochement par
// nom, aucune heuristique. À REJOUER après chaque chargement de matchs tant
// qu'aucun trigger ne le fait (dette connue).
//
// Usage :
//   node scripts/backfill-games-team-id.mjs --dry      (par défaut sûr)
//   node scripts/backfill-games-team-id.mjs --apply
//   node scripts/backfill-games-team-id.mjs --revert <fichier-sauvegarde>
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.indexOf("--revert");
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const BACKUP_DIR = process.env.NEXUS_BACKUP_DIR
  || path.join(process.env.TEMP || "/tmp", "nexus-backfill");

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
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (URL !== EXPECTED_URL) { console.error(`ABORT: URL="${URL}" != "${EXPECTED_URL}"`); process.exit(1); }
if (!KEY) { console.error("ABORT: service role absent"); process.exit(1); }
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
console.log(`Cible confirmée : ${URL}`);

/* ── RETOUR ARRIÈRE ─────────────────────────────────────────────────────── */
if (REVERT > -1) {
  const file = process.argv[REVERT + 1];
  if (!file) { console.error("ABORT: --revert exige un chemin"); process.exit(1); }
  const snap = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`Restauration de ${snap.games.length} matchs depuis ${file}`);
  let n = 0;
  for (const g of snap.games) {
    const { error } = await supabase.from("games")
      .update({ home_team_id: g.home_team_id, visitor_team_id: g.visitor_team_id })
      .eq("id", g.id);
    if (error) { console.error(`  ÉCHEC ${g.id}: ${error.message}`); continue; }
    n++;
  }
  console.log(`restaurés : ${n}/${snap.games.length}`);
  process.exit(0);
}

/* ── CARTE rseq_team_id -> teams.id ─────────────────────────────────────── */
const carte = new Map();
{ let from = 0; for (;;) {
  const { data, error } = await supabase.from("teams")
    .select("id, rseq_team_id").not("rseq_team_id", "is", null).range(from, from + 999);
  if (error) { console.error("ABORT teams:", error.message); process.exit(1); }
  for (const t of data) carte.set(t.rseq_team_id, t.id);
  if (data.length < 1000) break; from += 1000;
} }
console.log(`équipes pontées (rseq_team_id -> id) : ${carte.size}`);

/* ── MATCHS à rattacher ─────────────────────────────────────────────────── */
const aPoser = [];   // { id, home_team_id?, visitor_team_id? }
const avant = [];    // sauvegarde
let scannes = 0;
{ let from = 0; for (;;) {
  const { data, error } = await supabase.from("games")
    .select("id, home_team_id, visitor_team_id, home_rseq_team_id, visitor_rseq_team_id")
    .range(from, from + 999);
  if (error) { console.error("ABORT games:", error.message); process.exit(1); }
  for (const g of data) {
    scannes++;
    const patch = {};
    if (!g.home_team_id && g.home_rseq_team_id && carte.has(g.home_rseq_team_id)) {
      patch.home_team_id = carte.get(g.home_rseq_team_id);
    }
    if (!g.visitor_team_id && g.visitor_rseq_team_id && carte.has(g.visitor_rseq_team_id)) {
      patch.visitor_team_id = carte.get(g.visitor_rseq_team_id);
    }
    if (Object.keys(patch).length) {
      aPoser.push({ id: g.id, ...patch });
      avant.push({ id: g.id, home_team_id: g.home_team_id, visitor_team_id: g.visitor_team_id });
    }
  }
  if (data.length < 1000) break; from += 1000;
} }

console.log(`\n=== RAPPORT ===`);
console.log(`matchs scannés        : ${scannes}`);
console.log(`matchs à rattacher    : ${aPoser.length}`);
console.log(`  dont côté domicile  : ${aPoser.filter((p) => p.home_team_id).length}`);
console.log(`  dont côté visiteur  : ${aPoser.filter((p) => p.visitor_team_id).length}`);
if (aPoser.length === 0) { console.log("rien à faire."); process.exit(0); }

/* ── SAUVEGARDE (toujours) ──────────────────────────────────────────────── */
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(BACKUP_DIR, { recursive: true });
const backupFile = path.join(BACKUP_DIR, `games-team-id-${stamp}.json`);
writeFileSync(backupFile, JSON.stringify({
  genere_le: new Date().toISOString(),
  operation: "games.home_team_id / visitor_team_id (dérivé de rseq_team_id)",
  games: avant,
}, null, 2), "utf-8");
console.log(`\nSAUVEGARDE : ${backupFile}  (${avant.length} matchs)`);

if (!APPLY) { console.log(`\n--dry : aucune écriture. Relancer avec --apply.`); process.exit(0); }

/* ── ÉCRITURE ───────────────────────────────────────────────────────────── */
let ok = 0, ko = 0;
for (const p of aPoser) {
  const { id, ...patch } = p;
  const { error } = await supabase.from("games").update(patch).eq("id", id);
  if (error) { console.error(`  ÉCHEC ${id}: ${error.message}`); ko++; continue; }
  ok++;
  if (ok % 50 === 0) console.log(`  ${ok}/${aPoser.length}`);
}
console.log(`\n=== RÉSULTAT ===`);
console.log(`rattachés : ${ok}`);
console.log(`échecs    : ${ko}`);
console.log(`\nRetour arrière : node scripts/backfill-games-team-id.mjs --revert "${backupFile}"`);
