// scripts/advance-cegep-season-2026.mjs
// ============================================================================
// Fait passer à season='2026-2027' les équipes de CÉGEP restées en 2025-2026
// et NON pontées (rseq_team_id IS NULL) — 78 au 31 juillet 2026.
//
// POURQUOI : leur homologue RSEQ n'existe qu'en 2026-2027. La saison faisant
// partie de la clé d'appariement du pont (school, sport, name, category,
// division, sex, season), la clé ne pouvait jamais correspondre. Avancer la
// saison rend le pont naturel — le script backfill-rseq-team-id.mjs n'a PAS
// besoin d'être modifié.
//
// Vérifié avant écriture (lecture seule, 2026-07-31) :
//   · 0 collision sur teams_identity_unique — aucune jumelle 2026-2027
//   · 0 clé RSEQ ambiguë dans le millésime 2026-2027
//   · aucune FK ne référence `season` : les 14 lignes filles suivent l'id
//   · aucun `.eq("season", …)` applicatif sur `teams`
//
// C'est de la DONNÉE, pas du schéma : aucune migration. Sauvegarde JSON écrite
// hors dépôt AVANT toute écriture, retour arrière trivial (voir --revert).
//
// Usage :
//   node scripts/advance-cegep-season-2026.mjs --dry        (par défaut sûr)
//   node scripts/advance-cegep-season-2026.mjs --apply
//   node scripts/advance-cegep-season-2026.mjs --revert <fichier-sauvegarde>
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.indexOf("--revert");
const EXPECTED_URL = "https://nrloizyemulbhujrqhgx.supabase.co";
const CIBLE = "2026-2027";
const DEPUIS = "2025-2026";

// Sauvegarde HORS DÉPÔT (scratchpad de session) — jamais dans git, jamais
// dans OneDrive : ces lignes décrivent 78 collèges réels.
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
  if (!file) { console.error("ABORT: --revert exige un chemin de sauvegarde"); process.exit(1); }
  const snap = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`Restauration de ${snap.teams.length} équipes depuis ${file}`);
  let n = 0;
  for (const t of snap.teams) {
    const { error } = await supabase.from("teams").update({ season: t.season }).eq("id", t.id);
    if (error) { console.error(`  ÉCHEC ${t.id}: ${error.message}`); continue; }
    n++;
  }
  console.log(`restaurées : ${n}/${snap.teams.length}`);
  process.exit(0);
}

/* ── SÉLECTION ──────────────────────────────────────────────────────────── */
const { data: cegeps, error: eSch } = await supabase
  .from("schools").select("id").eq("type", "CEGEP");
if (eSch) { console.error("ABORT schools:", eSch.message); process.exit(1); }
const cegepIds = new Set(cegeps.map((s) => s.id));

const { data: all, error: eTeams } = await supabase
  .from("teams")
  .select("id, season, rseq_team_id, school_id, sport_id, name, age_group, division, gender")
  .is("rseq_team_id", null).eq("season", DEPUIS);
if (eTeams) { console.error("ABORT teams:", eTeams.message); process.exit(1); }

const cibles = all.filter((t) => cegepIds.has(t.school_id));
console.log(`\néquipes CÉGEP non pontées en ${DEPUIS} : ${cibles.length}`);
if (cibles.length === 0) { console.log("rien à faire."); process.exit(0); }

/* ── GARDE-FOU : aucune jumelle 2026-2027 (teams_identity_unique) ───────── */
const { data: dejaCible, error: eDup } = await supabase
  .from("teams")
  .select("school_id, sport_id, name, age_group, division, gender")
  .eq("season", CIBLE);
if (eDup) { console.error("ABORT dup-check:", eDup.message); process.exit(1); }
const kid = (t) => [t.school_id, t.sport_id, t.name, t.age_group ?? "", t.division ?? "", t.gender ?? ""].join("||");
const occupes = new Set(dejaCible.map(kid));
const conflits = cibles.filter((t) => occupes.has(kid(t)));
if (conflits.length) {
  console.error(`\nABORT : ${conflits.length} équipe(s) auraient une jumelle en ${CIBLE} :`);
  for (const c of conflits.slice(0, 10)) console.error(`  ${c.name} ${c.division ?? ""} ${c.gender ?? ""}`);
  process.exit(1);
}
console.log(`garde-fou identité : 0 conflit sur teams_identity_unique ✓`);

/* ── SAUVEGARDE (toujours, même en --dry) ───────────────────────────────── */
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(BACKUP_DIR, { recursive: true });
const backupFile = path.join(BACKUP_DIR, `teams-season-${stamp}.json`);

const ids = cibles.map((t) => t.id);
const { data: games, error: eGames } = await supabase
  .from("games")
  .select("id, home_team_id, visitor_team_id, home_rseq_team_id, visitor_rseq_team_id, season, sport")
  .or(`home_team_id.in.(${ids.join(",")}),visitor_team_id.in.(${ids.join(",")})`);
if (eGames) console.warn("avertissement games:", eGames.message);

writeFileSync(backupFile, JSON.stringify({
  genere_le: new Date().toISOString(),
  operation: `teams.season ${DEPUIS} -> ${CIBLE} (CÉGEP non pontées)`,
  teams: cibles,
  games_rattaches_avant: games ?? [],
}, null, 2), "utf-8");
console.log(`\nSAUVEGARDE : ${backupFile}`);
console.log(`  équipes sauvegardées : ${cibles.length}`);
console.log(`  matchs déjà rattachés : ${(games ?? []).length}`);

/* ── ÉCRITURE ───────────────────────────────────────────────────────────── */
if (!APPLY) {
  console.log(`\n--dry : aucune écriture. Relancer avec --apply.`);
  process.exit(0);
}

let ok = 0, ko = 0;
for (const t of cibles) {
  const { error } = await supabase.from("teams").update({ season: CIBLE }).eq("id", t.id);
  if (error) { console.error(`  ÉCHEC ${t.id} (${t.name}): ${error.message}`); ko++; continue; }
  ok++;
}
console.log(`\n=== RÉSULTAT ===`);
console.log(`mises à jour : ${ok}`);
console.log(`échecs       : ${ko}`);
console.log(`\nSauvegarde conservée : ${backupFile}`);
console.log(`Retour arrière : node scripts/advance-cegep-season-2026.mjs --revert "${backupFile}"`);
