// scripts/civil-football-recon.mjs
// ============================================================================
// Ligues civiles FOOTBALL — RECONNAISSANCE (étape 0, 100 % read-only)
//
// But : identifier la PLATEFORME derrière chacune des 4 sources avant d'écrire
// un scraper par source. On ne parse rien ici — on fetch les pages d'entrée,
// on sauve le HTML brut, et on imprime les indices qui trahissent la stack :
// generator/meta, scripts (bundles, __NEXT_DATA__, Angular/Vue), endpoints
// d'API visibles dans le HTML, formulaires + <select> (les sites ASP pilotent
// tout par dropdowns), et les liens internes qui ressemblent à des équipes.
//
// Sources :
//   LFMM  https://www.lfmm.net/teams/default.asp?u=LFMM&s=football   (ASP SSR)
//   QBFL  https://qbflzone.com/league/qbfl/calendar
//   QMFL  https://qmfl.ca/league/qmfl/calendar                        (même
//         plateforme apparente que QBFL — on cherche l'API JSON derrière)
//   QMJFL http://qmjfl.ca                                             (inconnu)
//
// Sorties (data/import/ est gitignoré) :
//   data/import/_recon_football/<source>.html   HTML brut
//   data/import/_recon_football/summary.json    indices par source
//
// AUCUNE écriture DB. Zéro dépendance (fetch global, Node 18+).
// UA Nexus explicite + délai 800 ms entre requêtes.
//
// Run:  node scripts/civil-football-recon.mjs
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

const SOURCES = [
  { key: "lfmm", url: "https://www.lfmm.net/teams/default.asp?u=LFMM&s=football" },
  { key: "qbfl", url: "https://qbflzone.com/league/qbfl/calendar" },
  { key: "qmfl", url: "https://qmfl.ca/league/qmfl/calendar" },
  { key: "qmjfl", url: "http://qmjfl.ca" },
];

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "import",
  "_recon_football",
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctl.signal, redirect: "follow" });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      server: res.headers.get("server"),
      poweredBy: res.headers.get("x-powered-by"),
      contentType: res.headers.get("content-type"),
      body,
    };
  } finally {
    clearTimeout(timer);
  }
}

const all = (re, s) => [...s.matchAll(re)].map((m) => m[1]);
const uniq = (a) => [...new Set(a)];

function fingerprint(html) {
  return {
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim().slice(0, 160),
    generator: html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i)?.[1] || null,
    // bundles / frameworks
    scripts: uniq(all(/<script[^>]+src=["']([^"']+)["']/gi, html)).slice(0, 30),
    hasNextData: /__NEXT_DATA__/.test(html),
    hasNuxt: /__NUXT__/.test(html),
    hasAngular: /ng-version|ng-app/.test(html),
    hasReactRoot: /id=["'](root|app|__next)["']/.test(html),
    // indices d'API dans le HTML
    apiHints: uniq([
      ...all(/["'](\/api\/[^"'\s?]{2,80})/gi, html),
      ...all(/["'](https?:\/\/[^"'\s]*\/api\/[^"'\s]{2,80})/gi, html),
      ...all(/["'](https?:\/\/[a-z0-9.-]*(?:firebaseio|supabase|amazonaws|cloudfront)[^"'\s]{0,60})/gi, html),
    ]).slice(0, 40),
    // ASP/dropdown driven sites
    forms: uniq(all(/<form[^>]+action=["']([^"']+)["']/gi, html)).slice(0, 20),
    selects: uniq(all(/<select[^>]+name=["']([^"']+)["']/gi, html)).slice(0, 20),
    // liens internes qui sentent l'équipe / la division / la saison
    teamishLinks: uniq(
      all(/<a[^>]+href=["']([^"']+)["']/gi, html).filter((h) =>
        /team|equipe|équipe|roster|club|division|season|saison|schedule|calendar|horaire|standing|classement/i.test(h),
      ),
    ).slice(0, 60),
    bytes: html.length,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const summary = [];

  for (const [i, src] of SOURCES.entries()) {
    if (i > 0) await sleep(DELAY_MS);
    process.stdout.write(`\n=== ${src.key.toUpperCase()} — ${src.url}\n`);
    try {
      const res = await get(src.url);
      await writeFile(path.join(OUT_DIR, `${src.key}.html`), res.body, "utf8");
      const fp = fingerprint(res.body);
      const row = {
        key: src.key,
        url: src.url,
        status: res.status,
        finalUrl: res.finalUrl,
        server: res.server,
        poweredBy: res.poweredBy,
        contentType: res.contentType,
        ...fp,
      };
      summary.push(row);
      console.log(
        JSON.stringify(
          {
            status: row.status,
            finalUrl: row.finalUrl,
            server: row.server,
            poweredBy: row.poweredBy,
            title: row.title,
            bytes: row.bytes,
            hasNextData: row.hasNextData,
            hasNuxt: row.hasNuxt,
            hasAngular: row.hasAngular,
            selects: row.selects,
            forms: row.forms,
            apiHints: row.apiHints,
            scripts: row.scripts.slice(0, 12),
            teamishLinks: row.teamishLinks.slice(0, 25),
          },
          null,
          2,
        ),
      );
    } catch (err) {
      const row = { key: src.key, url: src.url, error: String(err?.message || err) };
      summary.push(row);
      console.log(`  ERREUR: ${row.error}`);
    }
  }

  await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n--> ${path.join(OUT_DIR, "summary.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
