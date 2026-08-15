// scripts/scrape-leaguesuite-football.mjs
// ============================================================================
// QBFL / QMFL / QMJFL — DÉCOUVERTE clubs → équipes (plateforme LeagueSuite)
//
// Les trois sites tournent sur la MÊME plateforme, LeagueSuite
// (portal.leaguesuite.com, Laravel/PHP 8.3 + Blade + Alpine), un « tenant »
// par ligue :
//   QBFL   https://qbflzone.com/league/qbfl            tenant11
//   QMFL   https://qmfl.ca/league/qmfl                 tenant5
//   QMJFL  https://qmjfl.leaguesuite.com/league/quebec-major-junior-football-league
//                                                      tenant35
//   (qmjfl.ca n'est qu'un <frameset> vers qmjfl.leaguesuite.com)
//
// API découverte en lisant le HTML de /calendar (pas de doc publique) :
//
//   1. Constantes injectées dans la page :
//        window.LEAGUE_ID, window.SEASON_ID ("F26"), window.TENANT_ID,
//        window.SETUP_COMPETITION_ID
//   2. `var divisionMenu = {...}` — divisions de la saison courante, groupées
//        par catégorie : { categorized: { "<catégorie>": [ { id, division_id,
//        setup_competition_id, division_name, category_name, ... } ] } }
//   3. POST /api/setup-divisions-navs/league/{leagueId}/season/{seasonId}/competition/1
//        -> même forme que divisionMenu, pour N'IMPORTE QUELLE saison.
//        (POST sans corps ; c'est ce que le site appelle lui-même.)
//   4. GET /api/v1/search-team?team_name={q}&setup_competition_id={c}&limit=100
//        -> [{ team_id, team_participation_id, name, abbrev, logo, color,
//              season_name, placements:[{ setup_team_id, setup_division_id,
//              division_name, category_name }] }]
//        Le filtre est un préfixe de MOT, et la réponse ignore la saison
//        courante : elle couvre TOUT l'historique du tenant.
//
// Pourquoi un balayage a..z plutôt que la page /division/{id}/teams : cette
// page ne rend PAS la grille côté serveur (montée en JS), alors que le
// balayage rend les identifiants techniques (setup_team_id / setup_division_id)
// dont on aura besoin pour les horaires. On balaie a..z + 0..9 + initiales
// accentuées pour ne rater aucun nom.
//
// Sortie : data/import/civil_football_leaguesuite.json (gitignoré) — JSON
// SEULEMENT, aucune écriture DB. Zéro dépendance (fetch global, Node 18+).
// UA Nexus explicite, délai 800 ms entre requêtes.
//
// Run:  node scripts/scrape-leaguesuite-football.mjs
//   flags: --out <path>   --only qbfl,qmfl,qmjfl
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

const SITES = [
  {
    key: "QBFL",
    nom: "Quebec Bantam Football League",
    origin: "https://qbflzone.com",
    leagueKey: "qbfl",
    siteVitrine: "https://qbflzone.com",
  },
  {
    key: "QMFL",
    nom: "Quebec Midget Football League",
    origin: "https://qmfl.ca",
    leagueKey: "qmfl",
    siteVitrine: "https://qmfl.ca",
  },
  {
    key: "QMJFL",
    nom: "Ligue de Football Junior Majeur du Québec",
    origin: "https://qmjfl.leaguesuite.com",
    leagueKey: "quebec-major-junior-football-league",
    siteVitrine: "http://qmjfl.ca",
  },
];

// préfixes de recherche : lettres, chiffres, initiales accentuées courantes
const PROBES = [
  ..."abcdefghijklmnopqrstuvwxyz".split(""),
  ..."0123456789".split(""),
  "é", "è", "ê", "à", "â", "ô", "î", "ç", "û",
];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY = (arg("only") || "").split(",").filter(Boolean).map((s) => s.toUpperCase());
const OUT = path.resolve(
  HERE,
  "..",
  arg("out") || path.join("data", "import", "civil_football_leaguesuite.json"),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;

async function req(url, method = "GET") {
  if (!first) await sleep(DELAY_MS);
  first = false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest" },
      signal: ctl.signal,
    });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

const decode = (s) =>
  String(s ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

function extractObjectAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf("{", at + marker.length);
  if (start < 0) return null;
  let depth = 0, inStr = false, quote = "", esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}

/** Divisions renvoyées par l'API/le menu -> liste plate. */
function flattenDivisions(menu, seasonId) {
  const rows = [];
  const push = (categorie, d) =>
    rows.push({
      saison_id: seasonId,
      categorie: categorie ?? d.category_name ?? null,
      division_nom: d.division_name ?? null,
      setup_division_id: d.id, // <- l'id utilisé dans /division/{id}/...
      division_id: d.division_id,
      setup_competition_id: d.setup_competition_id,
      ordre: d.order,
      a_series: Boolean(d.playoff_setup_division),
      setup_division_id_series: d.playoff_setup_division?.id ?? null,
    });
  for (const d of menu?.uncategorized ?? []) push(null, d);
  for (const [cat, list] of Object.entries(menu?.categorized ?? {})) {
    for (const d of list) push(cat, d);
  }
  return rows;
}

async function scrapeSite(site) {
  console.log(`\n=========== ${site.key} — ${site.origin}/league/${site.leagueKey}`);
  const calUrl = `${site.origin}/league/${site.leagueKey}/calendar`;
  const cal = await req(calUrl);
  if (cal.status !== 200) throw new Error(`${site.key}: calendar HTTP ${cal.status}`);
  const html = cal.body;

  const g = (re) => html.match(re)?.[1] ?? null;
  const ctx = {
    league_id: Number(g(/window\.LEAGUE_ID\s*=\s*(\d+)/)),
    league_key: g(/window\.LEAGUE_KEY\s*=\s*'([^']+)'/) ?? site.leagueKey,
    saison_courante_id: g(/window\.SEASON_ID\s*=\s*"([^"]+)"/),
    setup_competition_id: g(/window\.SETUP_COMPETITION_ID\s*=\s*"([^"]+)"/),
    tenant_id: g(/window\.TENANT_ID\s*=\s*"([^"]+)"/),
    langues: JSON.parse(g(/window\.AVAILABLE_LANGUAGES\s*=\s*(\[[^\]]*\])/) ?? "[]"),
  };
  console.log(`  contexte: ${JSON.stringify(ctx)}`);

  // saisons : <select name="season_id">
  const seasonSelect = html.match(/<select[^>]*name="season_id"[\s\S]*?<\/select>/i)?.[0] ?? "";
  const saisons = [
    ...new Map(
      [...seasonSelect.matchAll(/<option value="([^"]+)"([^>]*)>([\s\S]*?)<\/option>/gi)].map((m) => [
        m[1],
        { id: m[1], label: decode(m[3]), courante: /selected/i.test(m[2]) },
      ]),
    ).values(),
  ];
  console.log(`  saisons: ${saisons.map((s) => `${s.id}=${s.label}`).join(", ") || "(aucune)"}`);

  // clubs membres listés au menu, avec leur site officiel
  const clubsMenu = [
    ...new Map(
      [...html.matchAll(/<a href="(https?:\/\/[^"]+)"[^>]*target="_blank"[^>]*>([^<]{3,60})<\/a>/gi)]
        .map((m) => ({ nom: decode(m[2]), site: m[1] }))
        .filter((c) => !/leaguesuite|facebook|instagram|twitter|youtube|tiktok|policy|terms/i.test(c.site))
        .map((c) => [c.nom.toLowerCase(), c]),
    ).values(),
  ];
  console.log(`  clubs au menu: ${clubsMenu.length}`);

  // divisions, saison par saison
  const divisions = [];
  const menuCourant = extractObjectAfter(html, "var divisionMenu");
  if (menuCourant && ctx.saison_courante_id) {
    divisions.push(...flattenDivisions(JSON.parse(menuCourant), ctx.saison_courante_id));
  }
  for (const s of saisons) {
    if (s.id === ctx.saison_courante_id) continue;
    const r = await req(
      `${site.origin}/api/setup-divisions-navs/league/${ctx.league_id}/season/${s.id}/competition/1`,
      "POST",
    );
    if (r.status !== 200) {
      console.log(`  ! divisions ${s.id}: HTTP ${r.status}`);
      continue;
    }
    try {
      divisions.push(...flattenDivisions(JSON.parse(r.body), s.id));
    } catch {
      console.log(`  ! divisions ${s.id}: réponse non-JSON`);
    }
  }
  console.log(`  divisions: ${divisions.length}`);
  for (const d of divisions) {
    console.log(`    [${d.saison_id}] ${d.categorie} / ${d.division_nom} (setup_division_id=${d.setup_division_id})`);
  }

  // équipes : balayage de la recherche
  const comp = ctx.setup_competition_id ?? "1";
  const found = new Map();
  let hits = 0;
  for (const q of PROBES) {
    const r = await req(
      `${site.origin}/api/v1/search-team?team_name=${encodeURIComponent(q)}&setup_competition_id=${encodeURIComponent(comp)}&limit=100`,
    );
    let rows = [];
    try {
      rows = JSON.parse(r.body);
    } catch {
      continue;
    }
    if (!Array.isArray(rows)) continue;
    hits += rows.length;
    for (const t of rows) found.set(`${t.team_id}:${t.team_participation_id}`, t);
  }
  console.log(`  recherche: ${PROBES.length} préfixes, ${hits} résultats bruts -> ${found.size} inscriptions distinctes`);

  // grain ÉQUIPE : une ligne par (équipe × placement) = par saison/division
  const equipes = [];
  for (const t of found.values()) {
    const placements = t.placements?.length ? t.placements : [null];
    for (const p of placements) {
      equipes.push({
        ligue: site.key,
        ligue_nom: site.nom,
        club: decode(t.name),
        equipe_nom: decode(t.name),
        categorie: p?.category_name ?? null,
        division: p?.division_name ?? null,
        saison: t.season_name ?? null,
        genre: null, // NON publié par la plateforme
        ville: null, // NON publié (indice : site officiel du club, cf. clubs_menu)
        region: null,
        abbrev: t.abbrev || null,
        couleur: t.color || null,
        logo: t.logo || null,
        // identifiants techniques — clés pour les horaires du prochain tour
        team_id: t.team_id,
        team_participation_id: t.team_participation_id,
        setup_team_id: p?.setup_team_id ?? null,
        setup_division_id: p?.setup_division_id ?? null,
        url_equipe:
          p?.setup_division_id != null && p?.setup_team_id != null
            ? `${site.origin}/league/${site.leagueKey}/division/${p.setup_division_id}/teams/${p.setup_team_id}`
            : t.team_participation_id != null
              ? `${site.origin}/league/${site.leagueKey}/teams/${t.team_participation_id}`
              : null,
        url_horaire_division:
          p?.setup_division_id != null
            ? `${site.origin}/league/${site.leagueKey}/division/${p.setup_division_id}/schedule`
            : null,
      });
    }
  }
  equipes.sort(
    (a, b) =>
      String(b.saison).localeCompare(String(a.saison), "fr") ||
      String(a.categorie).localeCompare(String(b.categorie), "fr") ||
      a.equipe_nom.localeCompare(b.equipe_nom, "fr"),
  );

  const parSaison = {};
  for (const e of equipes) {
    const k = e.saison ?? "(sans saison)";
    parSaison[k] ??= new Set();
    parSaison[k].add(e.equipe_nom);
  }
  console.log("  équipes par saison:");
  for (const [s, set] of Object.entries(parSaison).sort((a, b) => b[0].localeCompare(a[0]))) {
    console.log(`    ${s.padEnd(12)} ${set.size}`);
  }

  return {
    ligue: site.key,
    ligue_nom: site.nom,
    site_vitrine: site.siteVitrine,
    plateforme: "LeagueSuite",
    base_url: `${site.origin}/league/${site.leagueKey}`,
    contexte: ctx,
    saisons,
    clubs_menu: clubsMenu,
    divisions,
    total_inscriptions: equipes.length,
    equipes,
  };
}

async function main() {
  const cibles = SITES.filter((s) => !ONLY.length || ONLY.includes(s.key));
  const out = [];
  for (const site of cibles) {
    try {
      out.push(await scrapeSite(site));
    } catch (e) {
      console.error(`  ÉCHEC ${site.key}: ${e.message}`);
      out.push({ ligue: site.key, erreur: String(e.message) });
    }
  }

  const totalEquipes = out.reduce((n, s) => n + (s.equipes?.length ?? 0), 0);
  if (!totalEquipes) {
    console.error("\nAUCUNE équipe extraite — sortie NON écrite.");
    process.exit(1);
  }
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { plateforme: "LeagueSuite", sport: "football", ligues: out, total_inscriptions: totalEquipes },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n--> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
