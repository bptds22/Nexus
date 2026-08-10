// scripts/scrape-rseq-calendar.mjs
// ============================================================================
// RSEQ Calendar Scraper — every match of every league
//
// One match record per game (date, time, home, visitor, venue, score-if-played,
// game id, league meta), for every league in data/import/rseq_leagues_all.json.
//
// SOURCE NOTE (see ÉTAPE 1 discovery):
//   The site's dedicated calendar endpoint —
//     api/GameApi/GetGameList/?region=&sport=&fromDate=&toDate=&IncludeExhibitionGames=true
//   (the one that fills the "Calendrier des matchs" table) — returns [] for
//   public users on every region/sport/date combination tested, in-season
//   included. It only surfaces live-broadcast / game-reporter games. The only
//   COMPLETE per-league schedule available publicly is GetLeagueDiffusion's
//   RegularSeasonGames[] + PostSeasonGames[], so that is what we read here.
//
//   1. read rseq_leagues_all.json            -> [{ league_id, ... }]
//   2. GetLeagueDiffusion API per league_id  -> Regular/PostSeason games
//   3. flatten every game -> one calendar record
//
// Output: data/import/rseq_calendar_all.json  (JSON only — NO DB writes).
//
// Zero dependencies: global fetch (Node 18+). Polite 0.8s delay. If the run
// yields ZERO games the output file is NOT written and the process exits
// non-zero.
//
// Run (from anywhere):  node scripts/scrape-rseq-calendar.mjs
//   flags:
//     --in <path>    league catalogue to read (default: data/import/rseq_leagues_all.json)
//     --out <path>   override output (default: data/import/rseq_calendar_all.json)
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
const DEFAULT_OUT = path.join(ROOT, "data/import/rseq_calendar_all.json");

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

// RSEQ stores game time as MINUTES-since-midnight (960 -> 16:00, 730 -> 12:10).
// That integer is the canonical source (the sibling GameTimeFormatted string is
// unpadded, e.g. "9:30", and renders unset games as "0:00"). We rebuild a
// zero-padded "HH:MM"; 0 / null (no time set — never a real midnight game) -> null.
const SCORE_SENTINEL = -999; // API's "no result yet" placeholder

function formatTime(g) {
  const n = Number(g.GameTime);
  if (!Number.isFinite(n) || n <= 0 || n > 23 * 60 + 59) return null;
  const hh = Math.floor(n / 60);
  const mm = n % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** A game is "played" once a real (non-sentinel) home score is present. */
function scoreOf(g) {
  const raw = g.HomeTeamScore;
  const played = raw != null && raw !== "" && raw !== SCORE_SENTINEL;
  if (!played) return null;
  return {
    home: g.HomeTeamScore ?? null,
    visitor: g.VisitingTeamScore ?? null,
    result_formatted: (g.GameResultFormatted ?? "").trim() || null,
    home_forfeit: g.IsHomeTeamForfeit ?? false,
    visitor_forfeit: g.IsVisitingTeamForfeit ?? false,
  };
}

/** One raw diffusion game -> one calendar record, tagged with league meta. */
function toRecord(g, phase, meta) {
  return {
    game_id: g.GameId ?? null,
    game_no: g.No ?? null,
    date: g.GameDateText ?? null,
    time: formatTime(g),
    phase, // "regular" | "post"
    home_team: g.HomeTeamName ?? null,
    home_code: g.HomeTeamCode ?? null,
    home_team_id: g.HomeTeamId ?? null,
    visitor_team: g.VisitingTeamName ?? null,
    visitor_code: g.VisitingTeamCode ?? null,
    visitor_team_id: g.VisitingTeamId ?? null,
    venue: g.SportFacilityDescription ?? null,
    venue_lat: g.SportsFacilityGPSLatitude ?? null,
    venue_lon: g.SportsFacilityGPSLongitude ?? null,
    field_number: g.FieldNumber ?? null,
    is_released: g.IsReleased ?? null,
    score: scoreOf(g),
    // league meta (carried straight from the catalogue row)
    league_id: meta.league_id ?? null,
    league_name: meta.league_name ?? null,
    sport: meta.sport ?? null,
    sector: meta.sector ?? null,
    region: meta.region ?? null,
    division: meta.division ?? null,
    category: meta.category ?? null,
    sex_type: meta.sex_type ?? null,
    season: meta.season ?? null,
  };
}

/** Fetch one league's diffusion payload, return all its game records. */
async function scrapeLeagueGames(meta) {
  const data = await get(API + meta.league_id).then((r) => r.json());
  const out = [];
  for (const g of data.RegularSeasonGames ?? []) out.push(toRecord(g, "regular", meta));
  for (const g of data.PostSeasonGames ?? []) out.push(toRecord(g, "post", meta));
  return out;
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
  // dedupe by league_id, keep first meta row for each
  const byId = new Map();
  for (const r of catalogue) {
    if (r.league_id && !byId.has(r.league_id)) byId.set(r.league_id, r);
  }
  let leagues = [...byId.values()];
  if (Number.isFinite(limit)) leagues = leagues.slice(0, limit);
  console.log(`  ${leagues.length} distinct leagues to scrape\n`);

  const games = [];
  for (let i = 0; i < leagues.length; i++) {
    const meta = leagues[i];
    const tag = `[${i + 1}/${leagues.length}]`;
    let recs;
    try {
      recs = await scrapeLeagueGames(meta);
    } catch (e) {
      console.error(`${tag} ${meta.league_id} -> API FAILED: ${e.message}`);
      continue;
    }
    console.log(`${tag} ${meta.sport}: ${meta.league_name}  (${recs.length} games)`);
    games.push(...recs);
  }

  if (games.length === 0) {
    console.error("\nNo games scraped — output NOT written.");
    process.exit(1);
  }

  await writeFile(outPath, JSON.stringify(games, null, 2) + "\n", "utf-8");

  /* ── summary ── */
  const played = games.filter((g) => g.score).length;
  const withGps = games.filter((g) => g.venue_lat && g.venue_lon).length;
  const bySport = {};
  const byPhase = {};
  for (const g of games) {
    bySport[g.sport] = (bySport[g.sport] ?? 0) + 1;
    byPhase[g.phase] = (byPhase[g.phase] ?? 0) + 1;
  }
  console.log(`\n=== ${outPath} written ===`);
  console.log(`leagues scraped:    ${leagues.length}`);
  console.log(`total games:        ${games.length}`);
  console.log(`played (w/ score):  ${played} / ${games.length}`);
  console.log(`games w/ venue GPS: ${withGps} / ${games.length}`);
  console.log(`by phase:           regular ${byPhase.regular ?? 0}, post ${byPhase.post ?? 0}`);
  console.log("\ngames by sport:");
  for (const sport of Object.keys(bySport).sort()) {
    console.log(`  ${String(sport).padEnd(16)} ${bySport[sport]}`);
  }
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
