// scripts/scrape-rseq.mjs
// ============================================================================
// RSEQ Standings Scraper — ALL sports (Node ESM port)
//
// Faithful port of data/import/scrape_rseq_standings_all.py. Same source, same
// GetLeagueDiffusion JSON API, same InstitutionId + home-venue GPS capture,
// SAME output record shape — so the two are interchangeable and downstream
// tooling that reads rseq_standings_all.json is unaffected.
//
// Pipeline:
//   1. rseq-stats.ca homepage        -> collect EVERY league page URL (all sports).
//   2. League page -> diffusion.rseq.ca iframe -> LeagueId GUID.
//   3. GetLeagueDiffusion API per GUID -> league metadata + Teams[] + venue GPS.
//
// Output: data/import/rseq_standings_all.json  (JSON only — NO DB writes).
//
// EXCLUDES hockey — scolaire hockey lives on a separate domain
// (scolaire.rseqhockey.com); collégial/universitaire hockey is a separate
// follow-up.
//
// Zero dependencies: global fetch + URL/URLSearchParams (Node 18+). HTML
// attribute extraction is done with regexes (only <a href>, <option value>,
// <iframe src> are needed — no DOM tree required), replacing BeautifulSoup.
//
// One intentional deviation from the Python: if the run yields ZERO leagues
// (e.g. total network failure), the output file is NOT overwritten and the
// process exits non-zero — so a failed run never clobbers curated data with [].
//
// Run (from anywhere):  node scripts/scrape-rseq.mjs
//   flags:
//     --out <path>   override the output file (default: data/import/rseq_standings_all.json)
//     --limit <n>    scrape only the first n league pages (polite testing)
// ============================================================================

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HOME = "https://www.rseq-stats.ca/";
const API = "https://s1.rseq.ca/api/LeagueApi/GetLeagueDiffusion/?leagueId=";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const DELAY_MS = 800;
const TIMEOUT_MS = 30_000;
const SECTORS = ["/scolaire/", "/collegial/", "/universitaire/"];

// Repo root = one level up from scripts/ — so paths resolve regardless of cwd.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "data/import/rseq_standings_all.json");

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

/** All `values` matched by an attribute regex over raw HTML. */
function matchAll(html, re) {
  const out = [];
  for (const m of html.matchAll(re)) out.push(m[1]);
  return out;
}

/** Every league page on rseq-stats.ca, all sports — hockey excluded. */
async function collectAllLeagueUrls() {
  const html = await get(HOME).then((r) => r.text());
  const candidates = [
    ...matchAll(html, /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi),
    ...matchAll(html, /<option\b[^>]*\bvalue\s*=\s*["']([^"']*)["']/gi),
  ];
  const urls = new Set();
  for (const href of candidates) {
    if (!href || !href.includes("rseq-stats.ca")) continue;
    if (!SECTORS.some((seg) => href.includes(seg))) continue;
    if (href.toLowerCase().includes("hockey")) continue; // separate domain
    urls.add(new URL(href, HOME).href);
  }
  return [...urls].sort();
}

/** Read a league page, return the diffusion iframe's LeagueId GUID (or null). */
async function extractLeagueId(leagueUrl) {
  const html = await get(leagueUrl).then((r) => r.text());
  for (const src of matchAll(html, /<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!src.toLowerCase().includes("diffusion.rseq.ca")) continue;
    const qs = new URL(src, leagueUrl).searchParams;
    for (const [key, val] of qs) {
      if (key.toLowerCase() === "leagueid" && val) return val;
    }
  }
  return null;
}

/**
 * teamId -> { home_lat, home_lon, home_venue } from the first home game
 * carrying GPS coords. The league API has no per-school location (RegionName is
 * uniformly "Provincial"); the only per-school signal is the home-game venue,
 * which pins down same-named schools in different cities.
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

/** Call the league API, return the trimmed record we keep. */
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

async function main() {
  if (typeof fetch !== "function") {
    console.error("This script needs a Node with global fetch (Node 18+).");
    process.exit(1);
  }
  const { outPath, limit } = parseArgs(process.argv.slice(2));

  console.log("Collecting all-sport league pages from rseq-stats.ca ...");
  let leagueUrls = await collectAllLeagueUrls();
  if (Number.isFinite(limit)) leagueUrls = leagueUrls.slice(0, limit);
  console.log(`  found ${leagueUrls.length} league pages (hockey excluded)\n`);

  const results = [];
  for (let i = 0; i < leagueUrls.length; i++) {
    const url = leagueUrls[i];
    const tag = `[${i + 1}/${leagueUrls.length}]`;

    let leagueId;
    try {
      leagueId = await extractLeagueId(url);
    } catch (e) {
      console.error(`${tag} ${url} -> page fetch FAILED: ${e.message}`);
      continue;
    }
    if (!leagueId) {
      console.error(`${tag} ${url} -> no LeagueId iframe, skipped`);
      continue;
    }

    let rec;
    try {
      rec = await scrapeLeague(leagueId);
    } catch (e) {
      console.error(`${tag} ${url} -> API FAILED: ${e.message}`);
      continue;
    }
    // Defensive: drop hockey even if a URL slipped the filter.
    if ((rec.sport ?? "").toLowerCase().includes("hockey")) {
      console.error(`${tag} ${url} -> hockey, skipped`);
      continue;
    }
    console.log(`${tag} ${rec.sport}: ${rec.league_name}  (${rec.teams.length} teams)`);
    results.push(rec);
  }

  // Intentional deviation from the Python: never clobber curated data with [].
  if (results.length === 0) {
    console.error("\nNo leagues scraped — output NOT written (kept existing file).");
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
  console.log(`leagues scraped:         ${results.length} / ${leagueUrls.length}`);
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
