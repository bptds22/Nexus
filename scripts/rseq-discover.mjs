// scripts/rseq-discover.mjs
// ============================================================================
// RSEQ League DISCOVERY — full coverage via diffusion.s1.rseq.ca
//
// rseq-stats.ca only lists PROVINCIAL leagues; the regional leagues are missing.
// The master source is https://diffusion.s1.rseq.ca/, whose three dependent
// dropdowns (Année scolaire -> Région -> Discipline) are backed by a public JSON
// API (user "diffusionPilot", IsPublicView, no auth).
//
// This script enumerates every Année × Région × Discipline combination and
// collects every league, so downstream standings/calendar scrapers have the
// COMPLETE league universe — not just the provincial slice.
//
// Endpoints (discovered by inspecting the SPA's network calls — see ÉTAPE 1):
//   1. api/SchoolYearApi/GetSchoolYearList
//        -> [{ SchoolYearId, SchoolYear:"2025 - 2026", ... }]  (fills Année)
//   2. api/HomeApi/GetRegionSports/?schoolYearId={guid}&region={0-14}
//        -> { ..., Sports:{ "1":"Basketball", ... } }          (fills Discipline)
//      Regions are a STATIC 0..14 list (14 = "Provincial"); 0..13 are the
//      regional leagues rseq-stats.ca never exposed.
//   3. api/LeagueApi/GetLeagueList/?schoolYearId={guid}&region={n}&sport={n}
//        -> [{ LeagueId, LeagueName, Sport, Sector, Region, Division,
//              Category, SexType, TeamCount, IsMasterLeague, ... }]
//
// Output: data/import/rseq_leagues_all.json  (JSON only — NO DB writes).
//
// Zero dependencies: global fetch + URLSearchParams (Node 18+). Polite 0.8s
// delay before every request. If the run yields ZERO leagues the output file is
// NOT written and the process exits non-zero — a failed run never clobbers a
// good catalogue with [].
//
// Run (from anywhere):  node scripts/rseq-discover.mjs
//   flags:
//     --out <path>   override the output file (default: data/import/rseq_leagues_all.json)
//     --limit <n>    stop once n leagues have been collected (polite validation;
//                    scanning continues across combinations until n are found)
// ============================================================================

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://diffusion.s1.rseq.ca/";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const DELAY_MS = 800;
const TIMEOUT_MS = 30_000;

// School-year LABELS we want (resolved to GUIDs from GetSchoolYearList at run
// time — the API is the source of truth for the ids). Normalised on compare.
const TARGET_YEARS = ["2026 - 2027", "2025 - 2026"];

// Régions: STATIC in the site (code -> name), captured from the #regionSelect
// options. 14 = "Provincial" (what rseq-stats.ca covered); 0..13 = regionals.
const REGIONS = [
  [0, "Abitibi-Témiscamingue"],
  [1, "Cantons-de-l'Est"],
  [2, "Côte-Nord"],
  [3, "Est-du-Québec"],
  [4, "GMAA"],
  [5, "Lac-Saint-Louis"],
  [6, "Laurentides-Lanaudière"],
  [7, "Laval"],
  [8, "Mauricie"],
  [9, "Montérégie"],
  [10, "Montréal"],
  [11, "Outaouais"],
  [12, "Québec-Chaudière-Appalaches"],
  [13, "Saguenay-Lac-Saint-Jean"],
  [14, "Provincial"],
];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "data/import/rseq_leagues_all.json");

/* ── CLI flags ─────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = { outPath: DEFAULT_OUT, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (argv[i] === "--limit" && argv[i + 1]) out.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch -> JSON: delay, GET with a timeout, throw on HTTP error. */
async function getJson(url) {
  await sleep(DELAY_MS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const api = (route, params) => BASE + route + "?" + new URLSearchParams(params).toString();
const norm = (s) => String(s ?? "").replace(/\s+/g, "").toLowerCase(); // "2025 - 2026" -> "2025-2026"
const seasonLabel = (s) => String(s ?? "").replace(/\s+/g, ""); // display form "2025-2026"

/** Resolve TARGET_YEARS -> [{ id, label }] via GetSchoolYearList. */
async function resolveYears() {
  const list = await getJson(BASE + "api/SchoolYearApi/GetSchoolYearList");
  const wanted = new Set(TARGET_YEARS.map(norm));
  const years = (Array.isArray(list) ? list : [])
    .filter((y) => wanted.has(norm(y.SchoolYear)))
    .map((y) => ({ id: y.SchoolYearId, label: seasonLabel(y.SchoolYear) }));
  return years;
}

/** Sports available for a (year, region): { code -> name } (or {}). */
async function regionSports(schoolYearId, region) {
  try {
    const data = await getJson(api("api/HomeApi/GetRegionSports/", { schoolYearId, region }));
    return data && typeof data.Sports === "object" && data.Sports ? data.Sports : {};
  } catch {
    return {};
  }
}

/** Leagues for a (year, region, sport). */
async function leagueList(schoolYearId, region, sport) {
  const data = await getJson(api("api/LeagueApi/GetLeagueList/", { schoolYearId, region, sport }));
  return Array.isArray(data) ? data : [];
}

/** Trim a GetLeagueList record into the catalogue row we keep. */
function toRow(L, { regionName, seasonLbl, schoolYearId, sportName, sportCode }) {
  return {
    league_id: L.LeagueId ?? null,
    league_name: L.LeagueName ?? null,
    sport: L.SportName ?? sportName ?? null, // GetLeagueList carries the code only
    sport_code: L.Sport ?? sportCode ?? null,
    sector: L.Sector ?? null, // niveau: "Secondaire" / "Collégial" / ...
    region: L.Region != null ? regionName : regionName,
    region_code: L.Region ?? null,
    division: L.Division ?? null,
    category: L.Category ?? null,
    sex_type: L.SexType ?? null,
    team_count: L.TeamCount ?? null,
    is_master_league: L.IsMasterLeague ?? null,
    season: seasonLbl,
    school_year_id: L.SchoolYearId ?? schoolYearId,
  };
}

async function main() {
  if (typeof fetch !== "function") {
    console.error("This script needs a Node with global fetch (Node 18+).");
    process.exit(1);
  }
  const { outPath, limit } = parseArgs(process.argv.slice(2));

  console.log("Resolving target school years ...");
  const years = await resolveYears();
  if (years.length === 0) {
    console.error("No target school year resolved (GetSchoolYearList changed?) — aborting.");
    process.exit(1);
  }
  console.log(`  years: ${years.map((y) => y.label).join(", ")}\n`);

  const rows = [];
  const seen = new Set(); // dedupe league_id across regions (master leagues repeat)
  let reachedLimit = false;

  outer: for (const year of years) {
    for (const [regionCode, regionName] of REGIONS) {
      const sports = await regionSports(year.id, regionCode);
      const sportEntries = Object.entries(sports);
      if (sportEntries.length === 0) continue;

      let regionCount = 0;
      for (const [sportCode, sportName] of sportEntries) {
        let leagues;
        try {
          leagues = await leagueList(year.id, regionCode, sportCode);
        } catch (e) {
          console.error(`  ${year.label} / ${regionName} / ${sportName} -> GetLeagueList FAILED: ${e.message}`);
          continue;
        }
        for (const L of leagues) {
          if (!L.LeagueId || seen.has(L.LeagueId)) continue;
          seen.add(L.LeagueId);
          rows.push(toRow(L, { regionName, seasonLbl: year.label, schoolYearId: year.id, sportName, sportCode }));
          regionCount++;
          if (rows.length >= limit) {
            reachedLimit = true;
            console.log(`  ${year.label} / ${regionName}: +${regionCount} (limit ${limit} reached)`);
            break outer;
          }
        }
      }
      if (regionCount) console.log(`  ${year.label} / ${regionName}: +${regionCount} leagues`);
    }
  }

  if (rows.length === 0) {
    console.error("\nNo leagues discovered — output NOT written.");
    process.exit(1);
  }

  await writeFile(outPath, JSON.stringify(rows, null, 2) + "\n", "utf-8");

  /* ── summary ── */
  const bySeason = {};
  const byRegion = {};
  const bySport = {};
  const bySector = {};
  for (const r of rows) {
    bySeason[r.season] = (bySeason[r.season] ?? 0) + 1;
    byRegion[r.region] = (byRegion[r.region] ?? 0) + 1;
    bySport[r.sport] = (bySport[r.sport] ?? 0) + 1;
    bySector[r.sector] = (bySector[r.sector] ?? 0) + 1;
  }
  console.log(`\n=== ${outPath} written ===`);
  console.log(`leagues discovered:  ${rows.length}${reachedLimit ? " (limit)" : ""}`);
  console.log(`\nby season:`);
  for (const k of Object.keys(bySeason).sort()) console.log(`  ${String(k).padEnd(14)} ${bySeason[k]}`);
  console.log(`\nby sector (niveau):`);
  for (const k of Object.keys(bySector).sort()) console.log(`  ${String(k).padEnd(14)} ${bySector[k]}`);
  console.log(`\nby region:`);
  for (const k of Object.keys(byRegion).sort()) console.log(`  ${String(k).padEnd(28)} ${byRegion[k]}`);
  console.log(`\nby sport:`);
  for (const k of Object.keys(bySport).sort()) console.log(`  ${String(k).padEnd(16)} ${bySport[k]}`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
