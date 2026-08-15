// scripts/civil-football-schedule-probe.mjs
// ============================================================================
// Sondage de la FORME des calendriers (read-only) — avant tout scraping.
// But : savoir si l'horaire est rendu côté serveur, et à quelle granularité,
// pour répondre « quelles équipes n'ont AUCUN match programmé » au moindre coût.
//
// AUCUNE écriture DB, aucun fichier de sortie massif. UA Nexus, délai 800 ms.
// Run:  node scripts/civil-football-schedule-probe.mjs
// ============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "data", "import", "_recon_football", "probe",
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;

async function get(url, method = "GET") {
  if (!first) await sleep(800);
  first = false;
  const res = await fetch(url, { method, headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" } });
  return { status: res.status, ct: res.headers.get("content-type"), body: await res.text(), url };
}

const strip = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/gi, " ")
   .replace(/<style[\s\S]*?<\/style>/gi, " ")
   .replace(/<[^>]+>/g, "\n")
   .replace(/&nbsp;/g, " ")
   .split("\n").map((s) => s.trim()).filter(Boolean);

async function main() {
  await mkdir(OUT, { recursive: true });

  // --- LFMM : horaire de la ligue entière, saison courante ----------------
  const lfmmAll = await get(
    "https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=schedule&viewseas=Fall_2026",
  );
  await writeFile(path.join(OUT, "lfmm_sched_all.html"), lfmmAll.body, "utf8");
  const lines = strip(lfmmAll.body);
  const i = lines.findIndex((l) => /^(Date|Dim|Lun|Mar|Mer|Jeu|Ven|Sam|\d{1,2}\s)/i.test(l));
  console.log(`[LFMM ligue] ${lfmmAll.status} bytes=${lfmmAll.body.length}`);
  console.log("  extrait:", JSON.stringify(lines.slice(Math.max(0, i), i + 40)));
  for (const re of [/&game=\d+/g, /gameID/gi, /vs\.?/g, /\d{4}-\d{2}-\d{2}/g]) {
    console.log(`  ${re.source} -> ${(lfmmAll.body.match(re) || []).length}`);
  }

  // --- LFMM : horaire d'UNE équipe (Wildcats bantam, div connu) -----------
  const lfmmTeam = await get(
    "https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=schedule&div=LFMM-WILDCATS1&viewseas=Fall_2026",
  );
  await writeFile(path.join(OUT, "lfmm_sched_team.html"), lfmmTeam.body, "utf8");
  const tl = strip(lfmmTeam.body);
  console.log(`\n[LFMM équipe] ${lfmmTeam.status} bytes=${lfmmTeam.body.length}`);
  console.log("  extrait:", JSON.stringify(tl.slice(-60, -20)));

  // --- LeagueSuite : horaire d'une division -------------------------------
  for (const [nom, url] of [
    ["QMFL", "https://qmfl.ca/league/qmfl/division/10/schedule"],
    ["QBFL", "https://qbflzone.com/league/qbfl/division/10/schedule"],
    ["QMJFL", "https://qmjfl.leaguesuite.com/league/quebec-major-junior-football-league/division/1/schedule"],
  ]) {
    const r = await get(url);
    await writeFile(path.join(OUT, `${nom.toLowerCase()}_sched.html`), r.body, "utf8");
    const s = strip(r.body);
    console.log(`\n[${nom}] ${r.status} bytes=${r.body.length}`);
    console.log(`  dates ISO: ${(r.body.match(/\d{4}-\d{2}-\d{2}/g) || []).length} | 'vs': ${(r.body.match(/\bvs\b/gi) || []).length} | /api/: ${[...new Set(r.body.match(/\/api\/[a-z0-9v/_{}$-]+/gi) || [])].join(", ")}`);
    console.log("  extrait:", JSON.stringify(s.slice(40, 90)));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
