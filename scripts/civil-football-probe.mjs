// scripts/civil-football-probe.mjs
// ============================================================================
// Ligues civiles FOOTBALL — SONDAGE d'API (étape 0b, 100 % read-only)
//
// La reconnaissance a montré que QBFL / QMFL / QMJFL tournent tous sur
// LeagueSuite (portal.leaguesuite.com, PHP 8.3, Blade + Alpine). Le HTML de
// /league/{key}/calendar embarque :
//   window.LEAGUE_ID / SEASON_ID / SETUP_COMPETITION_ID / TENANT_ID
//   var divisionMenu = {...}   <- divisions groupées par catégorie
//   fetch('/api/setup-divisions-navs/league/{id}/season/{sid}/competition/1', POST)
//
// Ce script CONFIRME les endpoints avant d'écrire le vrai scraper :
//   1. POST /api/setup-divisions-navs/league/{L}/season/{S}/competition/1
//   2. GET  /api/v1/search-team?team_name=..&setup_competition_id=..&limit=..
//   3. GET  /league/{key}/division/{id}/teams        (HTML — structure ?)
// Et côté LFMM (ASP classique, pas d'API) : quelles pages portent les équipes.
//
// Sorties brutes dans data/import/_recon_football/probe/ (gitignoré).
// AUCUNE écriture DB. Zéro dépendance. UA Nexus, délai 800 ms.
//
// Run:  node scripts/civil-football-probe.mjs
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
const TIMEOUT_MS = 30_000;

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

async function req(url, { method = "GET", accept = "text/html" } = {}) {
  if (!first) await sleep(DELAY_MS);
  first = false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...HEADERS, Accept: accept, "X-Requested-With": "XMLHttpRequest" },
      signal: ctl.signal,
    });
    const body = await res.text();
    return { status: res.status, contentType: res.headers.get("content-type"), body, url };
  } catch (err) {
    return { status: 0, error: String(err?.message || err), body: "", url };
  } finally {
    clearTimeout(timer);
  }
}

async function dump(name, res) {
  const ext = /json/i.test(res.contentType || "") ? "json" : "html";
  await writeFile(path.join(OUT_DIR, `${name}.${ext}`), res.body, "utf8");
  const head = res.body.slice(0, 700).replace(/\s+/g, " ");
  console.log(
    `\n[${res.status}] ${res.url}\n  ct=${res.contentType || "-"} bytes=${res.body.length}${res.error ? " ERR=" + res.error : ""}\n  ${head}`,
  );
  return res;
}

// LeagueSuite: un site = un "tenant". league_id est LOCAL au site (souvent 1).
const LS = [
  { key: "qbfl", origin: "https://qbflzone.com", leagueKey: "qbfl", leagueId: 1, seasons: ["F26"] },
  { key: "qmfl", origin: "https://qmfl.ca", leagueKey: "qmfl", leagueId: 1, seasons: ["F26"] },
  { key: "qmjfl", origin: "https://qmjfl.leaguesuite.com", leagueKey: null, leagueId: 1, seasons: [] },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // --- QMJFL : le frameset pointe ici, on découvre league key + ids -------
  console.log("\n########## QMJFL — page d'entrée derrière le frameset");
  await dump("qmjfl_root", await req("https://qmjfl.leaguesuite.com/"));

  // --- LeagueSuite : l'API des divisions ---------------------------------
  for (const site of LS.filter((s) => s.leagueKey)) {
    console.log(`\n########## ${site.key.toUpperCase()} — API divisions`);
    for (const season of site.seasons) {
      // competition/1 = ce que le site appelle lui-même (cf. divisionMenu JS)
      await dump(
        `${site.key}_divisions_${season}`,
        await req(
          `${site.origin}/api/setup-divisions-navs/league/${site.leagueId}/season/${season}/competition/1`,
          { method: "POST", accept: "application/json" },
        ),
      );
    }
    // recherche d'équipes : 'a' matche large, on voit la forme de la réponse
    await dump(
      `${site.key}_search_team_a`,
      await req(
        `${site.origin}/api/v1/search-team?team_name=a&setup_competition_id=10&limit=100`,
        { accept: "application/json" },
      ),
    );
    // page équipes d'une division connue (10 = celle du menu)
    await dump(
      `${site.key}_division10_teams`,
      await req(`${site.origin}/league/${site.leagueKey}/division/10/teams`),
    );
  }

  // --- LFMM : ASP classique, où vivent les équipes ? ----------------------
  console.log("\n########## LFMM — pages candidates");
  const LFMM = "https://www.lfmm.net/teams/default.asp?u=LFMM&s=football";
  for (const [name, suffix] of [
    ["lfmm_standings", "&p=standings"],
    ["lfmm_teams", "&p=teams"],
    ["lfmm_associations", "&p=custom&pagename=Associations"],
    ["lfmm_schedule", "&p=schedule"],
  ]) {
    await dump(name, await req(LFMM + suffix));
  }

  console.log(`\n--> ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
