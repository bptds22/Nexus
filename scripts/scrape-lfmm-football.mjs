// scripts/scrape-lfmm-football.mjs
// ============================================================================
// LFMM — Ligue de Football Montréal-Métro — DÉCOUVERTE clubs → équipes
//
// Plateforme : HomeTeamsONLINE (ASP classique, rendu serveur, hébergé
// Cloudflare + ASP.NET). URL canonique :
//   https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=<page>
//   params observés : p=teams|schedule|standings|custom,
//                     div=<nodeID>, viewseas=Fall_2026, locationID=<id>
//
// LE FILON : la page p=teams embarque l'arbre COMPLET de l'organisation dans
// une variable JS `globalVars.orgNodes = { "<nodeID>": {...}, ... }`. Chaque
// nœud porte ID / parent / children / label / abbrev / nodeType / depth /
// sport / logo. On n'a donc PAS à parser le DOM : on lit l'arbre, et le grain
// ÉQUIPE tombe tout seul (un nœud nodeType=team par catégorie/division —
// « Rhinos » Atome et « Rhinos » Pee-Wee sont deux nœuds distincts).
//
// Le `nodeID` d'une équipe est aussi son identifiant d'URL (`&div=<nodeID>`),
// donc c'est LA clé technique pour aller chercher son horaire au tour suivant.
//
// Deux sources complémentaires fetchées au passage :
//   - p=schedule  -> <select> des saisons (viewseas) + <select> des divisions
//                    + <select> des emplacements (terrains)
//   - p=custom&pagename=Associations -> les CLUBS/associations membres avec
//                    leur nom complet incluant la ville (le nœud d'équipe,
//                    lui, ne porte que le nom court : « Rhinos »)
//
// Sortie : data/import/civil_football_lfmm.json  (gitignoré) — JSON SEULEMENT,
// aucune écriture DB. Zéro dépendance (fetch global, Node 18+).
// UA Nexus explicite, délai 800 ms entre requêtes.
//
// Run:  node scripts/scrape-lfmm-football.mjs
//   flags: --season Fall_2026   (défaut : saison courante du site)
//          --out <path>
// ============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://www.lfmm.net/teams/default.asp";
const ORG = { u: "LFMM", s: "football" };
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const DELAY_MS = 800;
const TIMEOUT_MS = 30_000;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const SEASON = arg("season");
const OUT = path.resolve(
  HERE,
  "..",
  arg("out") || path.join("data", "import", "civil_football_lfmm.json"),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;

async function get(params) {
  if (!first) await sleep(DELAY_MS);
  first = false;
  const qs = new URLSearchParams({ ...ORG, ...params });
  if (SEASON) qs.set("viewseas", SEASON);
  const url = `${BASE}?${qs}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- helpers --
const decode = (s) =>
  String(s ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&acirc;/gi, "â")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô")
    .replace(/&icirc;/gi, "î")
    .replace(/&iuml;/gi, "ï")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&ucirc;/gi, "û")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** Extrait un littéral objet JS en équilibrant les accolades depuis `marker`. */
function extractObjectAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf("{", at + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let quote = "";
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

function parseSelectOptions(html, hintRe) {
  const out = [];
  const selectRe = /<select\b[^>]*>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = selectRe.exec(html))) {
    const openTag = html.slice(m.index, m.index + m[0].indexOf(">") + 1);
    if (hintRe && !hintRe.test(openTag)) continue;
    const opts = [...m[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => ({
      value: decode(o[1].match(/value="([^"]*)"/i)?.[1] ?? ""),
      label: decode(o[2]),
      className: o[1].match(/class="([^"]*)"/i)?.[1] ?? "",
      selected: /selected/i.test(o[1]),
    }));
    if (opts.length) out.push({ openTag: openTag.slice(0, 200), options: opts });
  }
  return out;
}

// ------------------------------------------------------------------- main --
async function main() {
  console.log("LFMM — HomeTeamsONLINE — découverte clubs → équipes\n");

  // 1) l'arbre complet de l'organisation
  const teamsHtml = await get({ p: "teams" });
  const raw = extractObjectAfter(teamsHtml, "globalVars.orgNodes");
  if (!raw) throw new Error("globalVars.orgNodes introuvable — la page a changé de forme");
  const nodes = JSON.parse(raw);
  const byId = new Map(Object.entries(nodes).map(([id, n]) => [String(id), n]));
  console.log(`orgNodes: ${byId.size} nœuds`);

  const types = {};
  for (const n of byId.values()) types[n.nodeType] = (types[n.nodeType] || 0) + 1;
  console.log(`nodeTypes: ${JSON.stringify(types)}`);

  const chain = (node) => {
    const out = [];
    let cur = node;
    const seen = new Set();
    while (cur && !seen.has(String(cur.ID))) {
      seen.add(String(cur.ID));
      out.unshift(cur);
      cur = cur.parent ? byId.get(String(cur.parent)) : null;
    }
    return out;
  };

  // 2) saisons / divisions / emplacements exposés par le filtre du calendrier
  const schedHtml = await get({ p: "schedule" });
  const selects = parseSelectOptions(schedHtml);
  const seasonSel = selects.find((s) => /viewseas/.test(s.openTag));
  const divSel = selects.find((s) => /name="div"/i.test(s.openTag));
  const locSel = selects.find((s) => /locationID/.test(s.openTag));
  const seasons = seasonSel?.options.map((o) => ({ value: o.value, label: o.label, current: o.selected })) ?? [];
  const locations = locSel?.options.filter((o) => o.value).map((o) => ({ id: o.value, name: o.label })) ?? [];
  const scheduleDivisions =
    divSel?.options
      .filter((o) => o.value && o.value !== "ALL")
      .map((o) => ({ id: o.value, label: o.label, isDivision: /is_division/.test(o.className) })) ?? [];
  console.log(
    `saisons: ${seasons.length} (courante: ${seasons.find((s) => s.current)?.label ?? "?"}) | ` +
      `divisions au filtre: ${scheduleDivisions.length} | emplacements: ${locations.length}`,
  );

  // 3) les associations membres = les CLUBS (nom long avec la ville)
  // (page « custom » : simple contenu éditorial, les noms sont du texte nu —
  //  pas des <a> — donc on découpe le bloc en lignes de texte.)
  const assocHtml = await get({ p: "custom", pagename: "Associations" });
  const assocBlock =
    assocHtml.match(/associations membres[\s\S]{0,8000}?(?=<\/div>\s*<div class="pageFooter|PRINT)/i)?.[0] ??
    assocHtml.match(/associations membres[\s\S]{0,8000}/i)?.[0] ??
    "";
  const associations = [
    ...new Set(
      assocBlock
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/td>|<\/tr>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .split("\n")
        .map(decode)
        .filter(
          (t) =>
            t.length > 4 &&
            t.length < 90 &&
            !/^(print|accueil|contact|photos|liens|nouvelles|associations)$/i.test(t) &&
            !/associations membres/i.test(t),
        ),
    ),
  ];
  console.log(`associations listées: ${associations.length}`);

  // 4) grain ÉQUIPE — un nœud nodeType=team = une équipe (catégorie+division)
  const teams = [];
  for (const n of byId.values()) {
    if (n.nodeType !== "team") continue;
    const path_ = chain(n);
    const ancestors = path_.slice(0, -1);
    // profondeur observée: [org] > [catégorie] > [division] > [équipe]
    const division = ancestors.at(-1) ?? null;
    const categorie = ancestors.at(-2) ?? null;
    const label = decode(n.label);
    // Les libellés d'équipe portent le club PUIS un qualificatif (couleur,
    // point cardinal, prénom d'entraîneur, numéro) : « Grizzlis Bleu Griz »,
    // « Wildcats Est », « Diablos Blanc Nicolas », « Wildcats 2 ». La racine
    // = premier mot. HEURISTIQUE — à faire arbitrer avant toute insertion.
    const racine = label.split(/\s+/)[0];
    teams.push({
      ligue: "LFMM",
      ligue_nom: "Ligue de Football Montréal-Métro",
      club: racine, // HEURISTIQUE (cf. club_racine_heuristique)
      club_racine_heuristique: true,
      qualificatif: label.slice(racine.length).trim() || null,
      equipe_nom: label,
      categorie: categorie ? decode(categorie.label) : null,
      division: division ? decode(division.label) : null,
      genre: null, // NON publié par LFMM
      ville: null, // NON publié au grain équipe (cf. `associations`)
      region: null,
      abbrev: n.abbrev || null,
      logo: n.logo || null,
      site_web: n.website && n.website !== "notActive" ? n.website : null,
      // identifiants techniques — clés pour les horaires du prochain tour
      node_id: String(n.ID),
      parent_id: n.parent ? String(n.parent) : null,
      depth: n.depth,
      chemin: path_.map((x) => decode(x.label)).join(" > "),
      url_horaire: `${BASE}?u=LFMM&s=football&p=schedule&div=${n.ID}`,
    });
  }
  teams.sort(
    (a, b) =>
      String(a.categorie).localeCompare(String(b.categorie), "fr") ||
      String(a.division).localeCompare(String(b.division), "fr") ||
      a.equipe_nom.localeCompare(b.equipe_nom, "fr"),
  );

  // 5) rapport
  const parCategorie = {};
  for (const t of teams) {
    const k = t.categorie ?? "(sans catégorie)";
    parCategorie[k] ??= { equipes: 0, divisions: new Set(), clubs: new Set() };
    parCategorie[k].equipes++;
    parCategorie[k].divisions.add(t.division);
    parCategorie[k].clubs.add(t.club);
  }
  console.log(`\n== ${teams.length} équipes, ${new Set(teams.map((t) => t.club)).size} clubs (racine) distincts`);
  for (const [cat, v] of Object.entries(parCategorie)) {
    console.log(
      `  ${cat.padEnd(14)} ${String(v.equipes).padStart(3)} équipes | ${v.divisions.size} division(s) | ${v.clubs.size} clubs`,
    );
  }
  console.log(`\nclubs (racine): ${[...new Set(teams.map((t) => t.club))].sort((a, b) => a.localeCompare(b, "fr")).join(", ")}`);

  // divisions déclarées mais SANS équipe (le site en affiche : structure prête,
  // inscriptions pas faites) — signal utile pour le matching.
  const divisionsAvecEquipes = new Set(teams.map((t) => t.division));
  const divisionsVides = [...byId.values()]
    .filter((n) => n.nodeType === "division" && !(n.children || []).length)
    .map((n) => ({ id: String(n.ID), label: decode(n.label), parent: decode(byId.get(String(n.parent))?.label ?? "") }))
    .filter((d) => !divisionsAvecEquipes.has(d.label));
  if (divisionsVides.length) {
    console.log(`\ndivisions déclarées SANS équipe: ${divisionsVides.length}`);
    for (const d of divisionsVides) console.log(`  ${d.parent} > ${d.label} (id=${d.id})`);
  }
  if (associations.length) {
    console.log(`\nassociations membres (nom long, avec ville):`);
    for (const a of associations) console.log(`  ${a}`);
  }

  if (!teams.length) {
    console.error("\nAUCUNE équipe extraite — sortie NON écrite (on ne clobbe pas un bon fichier).");
    process.exit(1);
  }

  const payload = {
    source: "LFMM — https://www.lfmm.net (HomeTeamsONLINE)",
    plateforme: "HomeTeamsONLINE",
    sport: "football",
    saison_demandee: SEASON,
    saison_courante: seasons.find((s) => s.current)?.label ?? null,
    saisons_disponibles: seasons,
    perimetre_site: {
      sports: ["football"], // var sport='football' — un seul sport sur ce site
      note: "Le flag football n'est pas un sport séparé ici : il vit comme des catégories FLAG 10M/12M/14M/17M dans l'arbre football.",
    },
    associations_membres: associations,
    emplacements: locations,
    divisions_au_filtre: scheduleDivisions,
    divisions_sans_equipe: divisionsVides,
    total_equipes: teams.length,
    equipes: teams,
  };
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n--> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
