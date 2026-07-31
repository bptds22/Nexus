// scripts/backfill-rseq-team-id.mjs  (UNTRACKED — Phase 4A : backfill teams.rseq_team_id)
// ============================================================================
// Associe chaque public.teams -> son RSEQ TeamId via l'identité + saison :
//   key = (school_id, sport_id, name, category, division, sex, season)
// où school_id vient du pont schools.rseq_institution_id et sport_id du nom.
//
// La saison EST dans la clé : une identité d'équipe existe sur plusieurs saisons
// = plusieurs TeamId ; la season stockée (la plus récente) désambiguïse.
//
//   - 1 TeamId pour la clé  -> assignable
//   - >1 TeamId (même clé)  -> COLLISION (rapportée, JAMAIS écrite)
//   - 0 TeamId              -> non couverte (rapportée)
//   - écriture : UPDATE ... WHERE rseq_team_id IS NULL  (zéro écrasement)
//
// URL + service role depuis .env.local.prod uniquement. Garde-fou URL.
// Usage :  node scripts/backfill-rseq-team-id.mjs --dry   |   node scripts/backfill-rseq-team-id.mjs
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

const SPORTS = {"Athlétisme":"4dbf9b44-9228-4ba5-bcc9-da05a40e8fbf","Autre":"013623d1-eebf-47f9-88dc-1568ca024d66","Badminton":"aff40e75-09e4-4e5c-8dd5-99736cf9bea3","Baseball":"0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b","Basketball":"5dd6a7c8-2aa4-4b0e-a150-4ac77255f492","Cheerleading":"9f4564a1-15f8-484c-b40b-6dd11cc32b20","Cross-country":"daa04d57-4895-462e-9f1e-93c05d3634ad","Flag football":"f1c283ba-7ef2-44a5-acff-d16017562d67","Football":"4b859bf1-5832-4258-897c-e094062926af","Futsal":"19c2d1e6-978a-402e-9c22-c967274121bc","Golf":"a3d903d1-b00f-46f1-9242-3e5328b4ffdf","Handball":"42614cc5-f67f-40ff-b23a-a224a86b5f48","Hockey":"119362e8-7b98-47fb-84da-c9ce10fbda2a","Judo":"33297f02-2440-480d-951e-1496a00c12dd","Natation":"2551bd72-e2bb-452a-a8c9-9abc11dc505a","Rugby":"8480c09c-1d30-46eb-a819-67ded94c8390","Ski alpin":"91eb884f-9d3e-471a-b680-effc2f8593de","Ski de fond":"361c860a-379d-4207-9eb4-0694c411f802","Soccer":"aa2d1f97-989d-4491-b733-9236129ba154","Soccer intérieur":"a9224864-c006-4ad1-9e02-db4cdffbae4a","Tennis":"a86daa27-09eb-41b5-99f6-9740fabf696d","Ultimate frisbee":"0f3d4984-605a-4af1-86a9-432499ab8fd9","Volleyball":"063752bb-e786-4009-ac46-bb3c4eccfdee","Water-polo":"c3d3ba46-cbad-49e8-926a-f3236abda5db"};
const ALIAS = {"Ultimate":"Ultimate frisbee","Ultimate Frisbee":"Ultimate frisbee","Water Polo":"Water-polo"};
const resolveSport = (n) => SPORTS[ALIAS[(n||"").trim()] ?? (n||"").trim()];
const K = (s,sp,nm,ag,dv,gn,se) => [s,sp,nm,ag||"",dv||"",gn||"",se||""].join("||");

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

/* ── pont institution_id -> school_id (toutes écoles pontées) ── */
const bridge = new Map();
{ let from = 0; for (;;) {
  const { data, error } = await supabase.from("schools").select("id,rseq_institution_id").not("rseq_institution_id","is",null).range(from, from+999);
  if (error) { console.error("ABORT schools:", error.message); process.exit(1); }
  for (const s of data) bridge.set(s.rseq_institution_id, s.id);
  if (data.length < 1000) break; from += 1000;
} }
console.log(`écoles pontées: ${bridge.size}`);

/* ── idmap: key(identité+season) -> Set(team_id) ── */
const tid = JSON.parse(readFileSync(path.join(IMP, "rseq_teamids.json"), "utf-8"));
const idmap = new Map();
let src_unbridged = 0, src_unsport = 0;
for (const t of tid) {
  const school = bridge.get(t.institution_id); if (!school) { src_unbridged++; continue; }
  const sport = resolveSport(t.sport); if (!sport) { src_unsport++; continue; }
  const key = K(school, sport, t.team_name, t.category, t.division, t.sex, (t.season||"").trim());
  if (!idmap.has(key)) idmap.set(key, new Set());
  idmap.get(key).add(t.team_id);
}
console.log(`clés RSEQ (identité+season): ${idmap.size}  | src skip: unbridged=${src_unbridged} unsport=${src_unsport}`);

/* ── parcourt tous les teams, matche ── */
const assign = [];             // {id, team_id}
let uncovered = 0, collision = 0, already = 0, total = 0;
const collSamples = [], uncovSportCount = {};
{ let from = 0; for (;;) {
  const { data, error } = await supabase.from("teams").select("id,school_id,sport_id,name,age_group,division,gender,season,rseq_team_id").range(from, from+999);
  if (error) { console.error("ABORT teams:", error.message); process.exit(1); }
  for (const t of data) {
    total++;
    if (t.rseq_team_id) { already++; continue; }
    const set = idmap.get(K(t.school_id, t.sport_id, t.name, t.age_group, t.division, t.gender, (t.season||"").trim()));
    if (!set) { uncovered++; uncovSportCount[t.sport_id] = (uncovSportCount[t.sport_id]||0)+1; continue; }
    if (set.size > 1) { collision++; if (collSamples.length < 12) collSamples.push({name:t.name, season:t.season, n:set.size}); continue; }
    assign.push({ id: t.id, team_id: [...set][0] });
  }
  if (data.length < 1000) break; from += 1000;
} }

console.log(`\n=== RAPPORT DE COUVERTURE ===`);
console.log(`teams total:              ${total}`);
console.log(`déjà pontées (skip):      ${already}`);
console.log(`ASSIGNABLES (1 TeamId):   ${assign.length}`);
console.log(`collisions (>1 TeamId):   ${collision}   -> NON écrites, rapportées`);
console.log(`non couvertes (0 TeamId): ${uncovered}`);
console.log(`couverture:               ${(100*assign.length/total).toFixed(1)}%`);
if (collSamples.length) { console.log(`\néchantillon collisions:`); for (const c of collSamples) console.log(`  ${c.name} [${c.season}] -> ${c.n} TeamId`); }

/* team_id doivent être distincts parmi les assignables (index UNIQUE partiel) */
const seenTid = new Map();
for (const a of assign) seenTid.set(a.team_id, (seenTid.get(a.team_id)||0)+1);
const dupTid = [...seenTid.entries()].filter(([,n]) => n>1);
console.log(`\nteam_id dupliqués parmi assignables: ${dupTid.length}  (doit être 0 pour l'index UNIQUE)`);
if (dupTid.length) { console.log("  ex:", dupTid.slice(0,5)); }

if (DRY) { console.log(`\n[--dry] rien écrit. sample assign:`, JSON.stringify(assign[0])); process.exit(0); }
if (dupTid.length) { console.error("ABORT: team_id dupliqués -> violerait l'index UNIQUE. Aucun write."); process.exit(1); }

// UPDATE réel via RPC _backfill_rseq_team_id(pairs jsonb) — vrai UPDATE avec
// garde `rseq_team_id IS NULL` côté SQL (zéro écrasement).
//
// 2026-07-31 : ce RPC était un helper TEMPORAIRE de la Phase 4A ; il n'existe
// plus en base (vérifié : 0 ligne dans pg_proc). Le recréer serait du DDL.
// On ajoute donc un REPLI côté client qui refait exactement le même UPDATE,
// garde comprise (.is("rseq_team_id", null)), ligne par ligne. La logique
// d'APPARIEMENT au-dessus n'est PAS touchée. L'index UNIQUE partiel
// teams_rseq_team_id_uidx reste le garde-fou ultime contre un doublon.
let done = 0, updated = 0;
const { error: probe } = await supabase.rpc("_backfill_rseq_team_id", { pairs: [] });
const rpcDispo = !probe;
if (!rpcDispo) console.log(`  repli : RPC absent — écriture client, même garde IS NULL`);

if (rpcDispo) {
  for (let i = 0; i < assign.length; i += CHUNK) {
    const chunk = assign.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc("_backfill_rseq_team_id", { pairs: chunk });
    if (error) { console.error(`CHUNK ${Math.floor(i/CHUNK)+1}: ERREUR="${error.message}" — STOP`); process.exit(1); }
    done += chunk.length; updated += (data ?? 0);
    console.log(`CHUNK ${Math.floor(i/CHUNK)+1}: envoyées=${done}/${assign.length} maj=${updated}`);
  }
} else {
  for (const a of assign) {
    const { data, error } = await supabase
      .from("teams")
      .update({ rseq_team_id: a.team_id })
      .eq("id", a.id)
      .is("rseq_team_id", null)
      .select("id");
    done++;
    if (error) { console.error(`  ÉCHEC ${a.id}: ${error.message} — STOP`); process.exit(1); }
    updated += (data ?? []).length;
    if (done % 25 === 0 || done === assign.length) console.log(`  envoyées=${done}/${assign.length} maj=${updated}`);
  }
}
console.log(`\nDONE — ${updated} teams pontées à leur RSEQ TeamId (sur ${assign.length} assignables).`);
