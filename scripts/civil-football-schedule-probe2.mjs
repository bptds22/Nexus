// scripts/civil-football-schedule-probe2.mjs
// ============================================================================
// LeagueSuite — trouver D'OÙ viennent les matchs (read-only).
// /league/{key}/division/{id}/schedule ne rend AUCUN match côté serveur
// (72 lignes de texte = uniquement le chrome). On sonde donc des routes
// candidates + le sous-domaine stats.* repéré via recherche web.
// AUCUNE écriture DB. UA Nexus, délai 800 ms.
// Run:  node scripts/civil-football-schedule-probe2.mjs
// ============================================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
  Accept: "application/json, text/html;q=0.9",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;

async function probe(url, method = "GET") {
  if (!first) await sleep(800);
  first = false;
  try {
    const res = await fetch(url, {
      method,
      headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" },
    });
    const body = await res.text();
    const ct = res.headers.get("content-type") || "";
    const head = body.slice(0, 220).replace(/\s+/g, " ");
    console.log(`[${res.status}] ${method} ${url}\n     ct=${ct.split(";")[0]} bytes=${body.length} :: ${head}`);
    return { status: res.status, ct, body };
  } catch (e) {
    console.log(`[ERR] ${url} :: ${e.message}`);
    return { status: 0, body: "" };
  }
}

const O = "https://qmfl.ca";
const CANDIDATES = [
  `${O}/api/v1/schedule?setup_division_id=10`,
  `${O}/api/v1/games?setup_division_id=10`,
  `${O}/api/v1/matches?setup_division_id=10`,
  `${O}/api/schedule/division/10`,
  `${O}/api/v1/division/10/schedule`,
  `${O}/api/setup-divisions/10/schedule`,
  `${O}/api/v1/season-calendar?league_id=1&season_id=F26`,
  `${O}/api/calendar/league/1/season/F26`,
];

console.log("=== routes candidates (GET puis POST sur les 404) ===");
for (const u of CANDIDATES) {
  const r = await probe(u);
  if (r.status === 405 || r.status === 404) await probe(u, "POST");
}

console.log("\n=== sous-domaine stats.* (plateforme distincte ?) ===");
await probe("https://stats.qmfl.ca/en/team/F24/5/67/5732");
await probe("https://stats.qmfl.ca/");
await probe("https://stats.qbflzone.com/");
