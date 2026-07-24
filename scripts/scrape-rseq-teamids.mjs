// scripts/scrape-rseq-teamids.mjs
// ============================================================================
// RSEQ TeamId scraper — the missing link for calendar↔teams.
//
// The calendars (rseq_calendar_all.json + rseq_calendar_collegial.json) carry
// HomeTeamId / VisitingTeamId (RSEQ Team GUIDs), but the standings v2 scrape
// never captured Teams[].TeamId. This re-fetches GetLeagueDiffusion for every
// known league and extracts ONLY the team identity we need to bridge those
// GUIDs to public.teams :
//   (league_id, team_id, institution_id, team_name, team_code,
//    sport, sector, category, sex, division, season)
// where sport/sector/category/sex/division come from the league metadata.
//
// Source leagues = data/import/rseq_leagues_all.json  (secondaire/primaire)
//                + data/import/rseq_leagues_collegial.json  (the 50 collégial)
// deduped by league_id — the exact same league universe the calendars came from.
//
// Output: data/import/rseq_teamids.json  (JSON only — NO DB writes).
//
// Zero dependencies: global fetch (Node 18+). Polite 0.8s delay. Exit 1 if the
// run yields ZERO team rows (output NOT written).
//
// Run (from anywhere):  node scripts/scrape-rseq-teamids.mjs
//   flags:
//     --in <path>    extra league catalogue (repeatable); defaults to the two above
//     --out <path>   override output (default: data/import/rseq_teamids.json)
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
const DEFAULT_INS = [
  path.join(ROOT, "data/import/rseq_leagues_all.json"),
  path.join(ROOT, "data/import/rseq_leagues_collegial.json"),
];
const DEFAULT_OUT = path.join(ROOT, "data/import/rseq_teamids.json");

/* ── CLI flags ─────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const out = { ins: [], outPath: DEFAULT_OUT, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in" && argv[i + 1]) out.ins.push(path.resolve(argv[++i]));
    else if (argv[i] === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
    else if (argv[i] === "--limit" && argv[i + 1]) out.limit = Math.max(0, parseInt(argv[++i], 10) || 0);
  }
  if (out.ins.length === 0) out.ins = DEFAULT_INS;
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

/** Load + union league rows across the input files, deduped by league_id. */
async function loadLeagues(ins) {
  const byId = new Map();
  for (const p of ins) {
    let raw;
    try {
      raw = await readFile(p, "utf-8");
    } catch (e) {
      console.error(`  skip ${p}: ${e.message}`);
      continue;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) continue;
    for (const r of arr) {
      if (r.league_id && !byId.has(r.league_id)) byId.set(r.league_id, r);
    }
  }
  return [...byId.values()];
}

/** One league's diffusion payload → its team-identity rows. */
async function scrapeLeagueTeams(meta) {
  const data = await get(API + meta.league_id).then((r) => r.json());
  const league = {
    sport: data.SportName ?? meta.sport ?? null,
    sector: data.SectorName ?? meta.sector ?? null,
    category: data.CategoryName ?? meta.category ?? null,
    sex: data.SexTypeName ?? meta.sex_type ?? meta.sex ?? null,
    division: data.DivisionName ?? meta.division ?? null,
    season: data.SchoolYearYears ?? meta.season ?? null,
  };
  return (data.Teams ?? [])
    .filter((t) => t.TeamId)
    .map((t) => ({
      league_id: meta.league_id,
      team_id: t.TeamId,
      institution_id: t.InstitutionId ?? null,
      team_name: t.TeamName ?? null,
      team_code: t.TeamCode ?? null,
      ...league,
    }));
}

async function main() {
  if (typeof fetch !== "function") {
    console.error("This script needs a Node with global fetch (Node 18+).");
    process.exit(1);
  }
  const { ins, outPath, limit } = parseArgs(process.argv.slice(2));

  console.log(`Reading league catalogues:\n  ${ins.join("\n  ")}`);
  let leagues = await loadLeagues(ins);
  if (Number.isFinite(limit)) leagues = leagues.slice(0, limit);
  console.log(`  ${leagues.length} distinct leagues to scrape`);
  if (leagues.length === 0) {
    console.error("No leagues to scrape — aborting.");
    process.exit(1);
  }

  /* RESUME : re-read an existing --out and skip leagues already captured.
     The scrape is long (~2s/league) and may be interrupted (background time
     caps) — incremental flush + resume make re-runs pick up where they left
     off, NEVER re-scraping a done league. */
  const rows = [];
  const doneLeagues = new Set();
  try {
    const prev = JSON.parse(await readFile(outPath, "utf-8"));
    if (Array.isArray(prev)) {
      rows.push(...prev);
      for (const r of prev) if (r.league_id) doneLeagues.add(r.league_id);
    }
  } catch { /* no partial file yet */ }
  const remaining = leagues.filter((l) => !doneLeagues.has(l.league_id));
  console.log(`  ${doneLeagues.size} leagues already captured -> ${remaining.length} remaining\n`);

  const flush = () => writeFile(outPath, JSON.stringify(rows, null, 2) + "\n", "utf-8");

  for (let i = 0; i < remaining.length; i++) {
    const meta = remaining[i];
    const tag = `[${i + 1}/${remaining.length}]`;
    let teamRows;
    try {
      teamRows = await scrapeLeagueTeams(meta);
    } catch (e) {
      console.error(`${tag} ${meta.league_id} -> API FAILED: ${e.message}`);
      continue;
    }
    rows.push(...teamRows);
    if ((i + 1) % 50 === 0) {
      await flush(); // durable progress — survives an interruption
      console.log(`${tag} flushed (${rows.length} rows total)`);
    }
  }

  if (rows.length === 0) {
    console.error("\nNo team ids scraped — output NOT written.");
    process.exit(1);
  }

  await flush();

  /* ── summary ── */
  const distinctTeam = new Set(rows.map((r) => r.team_id)).size;
  const distinctInst = new Set(rows.filter((r) => r.institution_id).map((r) => r.institution_id)).size;
  const bySector = {};
  for (const r of rows) bySector[r.sector ?? "?"] = (bySector[r.sector ?? "?"] ?? 0) + 1;

  console.log(`\n=== ${outPath} written ===`);
  console.log(`leagues scraped:      ${leagues.length}`);
  console.log(`team rows:            ${rows.length}`);
  console.log(`distinct team_id:     ${distinctTeam}`);
  console.log(`distinct institution: ${distinctInst}`);
  console.log("by sector:");
  for (const k of Object.keys(bySector).sort()) console.log(`  ${String(k).padEnd(14)} ${bySector[k]}`);
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
