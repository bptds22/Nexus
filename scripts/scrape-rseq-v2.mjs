// scripts/scrape-rseq-v2.mjs
// ============================================================================
// RSEQ Standings Scraper v2 — full-coverage edition
//
// Same GetLeagueDiffusion pipeline and SAME output record shape as
// scripts/scrape-rseq.mjs, but the league universe now comes from
// data/import/rseq_leagues_all.json (produced by rseq-discover.mjs — the full
// Année × Région × Discipline sweep of diffusion.s1.rseq.ca) INSTEAD of the
// rseq-stats.ca homepage, which only exposed the provincial slice.
//
// This lets a single record shape carry both provincial and regional leagues.
//
//   1. read rseq_leagues_all.json            -> [{ league_id, ... }]
//   2. GetLeagueDiffusion API per league_id  -> league meta + Teams[] + venue GPS
//
// Output: data/import/rseq_standings_all_v2.json  (JSON only — NO DB writes).
//   The curated data/import/rseq_standings_all.json (80 leagues) is NEVER
//   touched — different default output path, and the original scrape-rseq.mjs
//   still owns it.
//
// Zero dependencies: global fetch (Node 18+). Polite 0.8s delay. If the run
// yields ZERO leagues the output file is NOT written and the process exits
// non-zero — a failed run never clobbers good data with [].
//
// Run (from anywhere):  node scripts/scrape-rseq-v2.mjs
//   flags:
//     --in <path>    league catalogue to read (default: data/import/rseq_leagues_all.json)
//     --out <path>   override output (default: data/import/rseq_standings_all_v2.json)
//     --limit <n>    scrape only the first n leagues (polite testing)
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = "https://diffusion.s1.rseq.ca/api/LeagueApi/GetLeagueDiffusion/?leagueId=";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const DELAY_MS = 800;
const TIMEOUT_MS = 30_000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_IN = path.join(ROOT, "data/import/rseq_leagues_all.json");
const DEFAULT_OUT = path.join(ROOT, "data/import/rseq_standings_all_v2.json");

/* ── CLI flags ─────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = { inPath: DEFAULT_IN, outPath: DEFAULT_OUT, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in" && argv[i + 1]) out.inPath = path.resolve(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (argv[i] === "--limit" && argv[i + 1]) out.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Polite fetch — delay, then GET with a timeout; throw on HTTP error. */
async function get(url) {
  await sleep(DELAY_MS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * teamId -> { home_lat, home_lon, home_venue } from the first home game
 * carrying GPS coords — the only per-school location signal in the API.
 * (Identical to scrape-rseq.mjs.)
 */
function homeVenueGps(data) {
  const out = {};
  const games = [...(data.RegularSeasonGames ?? []), ...(data.PostSeasonGames ?? [])];
  for (const g of games) {
    const tid = g.HomeTeamId;
    if (!tid || tid in out) continue;
    const lat = g.SportsFacilityGPSLatitude;
    const lon = g.SportsFacilityGPSLongitude;
    if (lat && lon) {
      out[tid] = {
        home_lat: lat,
        home_lon: lon,
        home_venue: g.SportFacilityDescription ?? "",
      };
    }
  }
  return out;
}

/** Call the league API, return the trimmed record we keep (same shape as v1). */
async function scrapeLeague(leagueId) {
  const data = await get(API + leagueId).then((r) => r.json());
  const venues = homeVenueGps(data);
  const teams = (data.Teams ?? []).map((t) => {
    const v = venues[t.TeamId] ?? {};
    return {
      team_name: t.TeamName ?? null,
      team_code: t.TeamCode ?? null,
      institution_id: t.InstitutionId ?? null,
      player_count: t.PlayerCount ?? null,
      home_lat: v.home_lat ?? null,
      home_lon: v.home_lon ?? null,
      home_venue: v.home_venue ?? null,
    };
  });
  return {
    league_id: leagueId,
    league_name: data.LeagueName ?? null,
    sport: data.SportName ?? null,
    sector: data.SectorName ?? null,
    region: data.RegionName ?? null,
    division: data.DivisionName ?? null,
    category: data.CategoryName ?? null,
    sex: data.SexTypeName ?? null,
    conference: data.Conference ?? null,
    section: data.Section ?? null,
    season: data.SchoolYearYears ?? null,
    teams,
  };
}

async function loadCatalogue(inPath) {
  let raw;
  try {
    raw = await readFile(inPath, "utf-8");
  } catch (e) {
    console.error(`Cannot read league catalogue ${inPath}: ${e.message}`);
    console.error("Run rseq-discover.mjs first.");
    process.exit(1);
  }
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr) || arr.length === 0) {
    console.error(`League catalogue ${inPath} is empty — aborting.`);
    process.exit(1);
  }
  return arr;
}

async function main() {
  if (typeof fetch !== "function") {
    console.error("This script needs a Node with global fetch (Node 18+).");
    process.exit(1);
  }
  const { inPath, outPath, limit } = parseArgs(process.argv.slice(2));

  console.log(`Reading league catalogue from ${inPath} ...`);
  let catalogue = await loadCatalogue(inPath);
  const ids = catalogue.map((r) => r.league_id).filter(Boolean);
  let leagueIds = [...new Set(ids)];
  if (Number.isFinite(limit)) leagueIds = leagueIds.slice(0, limit);
  console.log(`  ${leagueIds.length} distinct league ids to scrape\n`);

  const results = [];
  for (let i = 0; i < leagueIds.length; i++) {
    const leagueId = leagueIds[i];
    const tag = `[${i + 1}/${leagueIds.length}]`;
    let rec;
    try {
      rec = await scrapeLeague(leagueId);
    } catch (e) {
      console.error(`${tag} ${leagueId} -> API FAILED: ${e.message}`);
      continue;
    }
    console.log(`${tag} ${rec.sport}: ${rec.league_name}  (${rec.teams.length} teams)`);
    results.push(rec);
  }

  // Never clobber good data with [].
  if (results.length === 0) {
    console.error("\nNo leagues scraped — output NOT written.");
    process.exit(1);
  }

  await writeFile(outPath, JSON.stringify(results, null, 2) + "\n", "utf-8");

  /* ── summary ── */
  const allTeams = results.flatMap((r) => r.teams);
  const withInst = allTeams.filter((t) => t.institution_id).length;
  const withGps = allTeams.filter((t) => t.home_lat && t.home_lon).length;
  const distinctInst = new Set(allTeams.filter((t) => t.institution_id).map((t) => t.institution_id)).size;

  const bySport = {};
  for (const r of results) bySport[r.sport] = (bySport[r.sport] ?? 0) + 1;

  console.log(`\n=== ${outPath} written ===`);
  console.log(`leagues scraped:         ${results.length} / ${leagueIds.length}`);
  console.log(`total team entries:      ${allTeams.length}`);
  console.log(`teams w/ institution_id: ${withInst} / ${allTeams.length}`);
  console.log(`teams w/ home-venue GPS: ${withGps} / ${allTeams.length}`);
  console.log(`distinct institutions:   ${distinctInst}`);
  console.log("\nleagues by sport:");
  for (const sport of Object.keys(bySport).sort()) {
    console.log(`  ${String(sport).padEnd(16)} ${bySport[sport]}`);
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
