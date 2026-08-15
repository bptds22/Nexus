// scripts/civil-football-probe2.mjs
// ============================================================================
// Ligues civiles FOOTBALL — SONDAGE 2 (read-only)
//
// Reste à trancher, côté LeagueSuite, COMMENT énumérer les équipes d'une
// division : la page /division/{id}/teams ne les rend PAS côté serveur (grille
// montée en JS), et /api/v1/search-team exige un terme de recherche.
// On teste donc :
//   A. /league/{key}/division/{id}/standings   (rendu serveur ? ids d'équipe ?)
//   B. balayage a..z de /api/v1/search-team    (couverture complète ?)
//   C. QMJFL : seasons + divisions (tenant35, key quebec-major-junior-football-league)
//
// AUCUNE écriture DB. Zéro dépendance. UA Nexus, délai 800 ms.
// Run:  node scripts/civil-football-probe2.mjs
// ============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const DELAY_MS = 800;
const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "import",
  "_recon_football",
  "probe",
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;

async function req(url, method = "GET") {
  if (!first) await sleep(DELAY_MS);
  first = false;
  const res = await fetch(url, {
    method,
    headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" },
  });
  return { status: res.status, ct: res.headers.get("content-type"), body: await res.text(), url };
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // --- A. standings rendu serveur ? -------------------------------------
  const st = await req("https://qmfl.ca/league/qmfl/division/10/standings");
  await writeFile(path.join(OUT_DIR, "qmfl_division10_standings.html"), st.body, "utf8");
  console.log(`[A] standings ${st.status} bytes=${st.body.length}`);
  for (const re of [
    /"setup_team_id"\s*:\s*\d+/g,
    /href="division\/10\/teams\/\d+"/g,
    /standingsData|var standings|teamsData/g,
  ]) {
    console.log(`    ${re.source} -> ${(st.body.match(re) || []).length} hits`);
  }

  // --- B. balayage a..z de search-team -----------------------------------
  const byId = new Map();
  for (const site of [
    { key: "qmfl", origin: "https://qmfl.ca" },
    { key: "qbfl", origin: "https://qbflzone.com" },
  ]) {
    const found = new Map();
    for (const L of LETTERS) {
      const r = await req(
        `${site.origin}/api/v1/search-team?team_name=${L}&setup_competition_id=10&limit=100`,
      );
      let rows = [];
      try {
        rows = JSON.parse(r.body);
      } catch {
        console.log(`    ${site.key} '${L}' -> non-JSON (${r.status})`);
        continue;
      }
      for (const t of rows) found.set(t.team_id, t);
      process.stdout.write(`${L}:${rows.length} `);
    }
    console.log(`\n[B] ${site.key} -> ${found.size} équipes distinctes`);
    for (const t of found.values()) {
      const pl = (t.placements || [])
        .map((p) => `${p.category_name} / ${p.division_name} (setup_team_id=${p.setup_team_id}, setup_division_id=${p.setup_division_id})`)
        .join(" | ");
      console.log(`    #${t.team_id} part=${t.team_participation_id} ${t.name} [${t.abbrev}] ${t.season_name} :: ${pl}`);
    }
    byId.set(site.key, [...found.values()]);
  }
  await writeFile(
    path.join(OUT_DIR, "leaguesuite_search_sweep.json"),
    JSON.stringify(Object.fromEntries(byId), null, 2),
    "utf8",
  );

  // --- C. QMJFL --------------------------------------------------------
  const KEY = "quebec-major-junior-football-league";
  const cal = await req(`https://qmjfl.leaguesuite.com/league/${KEY}/calendar`);
  await writeFile(path.join(OUT_DIR, "qmjfl_calendar.html"), cal.body, "utf8");
  console.log(`\n[C] qmjfl calendar ${cal.status} bytes=${cal.body.length}`);
  for (const re of [
    /window\.LEAGUE_ID\s*=\s*(\d+)/,
    /window\.SEASON_ID\s*=\s*"([^"]+)"/,
    /window\.SETUP_COMPETITION_ID\s*=\s*"([^"]+)"/,
    /window\.TENANT_ID\s*=\s*"([^"]+)"/,
  ]) {
    console.log(`    ${re.source} -> ${cal.body.match(re)?.[1] ?? "?"}`);
  }
  const opts = [...cal.body.matchAll(/<option value="([A-Z0-9]+)"[^>]*>([^<]+)<\/option>/g)].map(
    (m) => `${m[1]}=${m[2].trim()}`,
  );
  console.log(`    saisons: ${[...new Set(opts)].join(", ")}`);
  const dm = cal.body.match(/var divisionMenu\s*=\s*(\{[\s\S]*?\});/);
  console.log(`    divisionMenu: ${dm ? dm[1].slice(0, 1200) : "ABSENT"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
