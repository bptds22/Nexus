// scripts/scrape-cegep-programs.mjs
// ============================================================================
// Scraper des PROGRAMMES collégiaux offerts PAR ÉTABLISSEMENT, depuis le portail
// de la Fédération des cégeps (lecegep.ca) — pour seeder l'éditeur « Ma page »
// programmes (Bloc 2). Source : API GraphQL publique Craft CMS
//   POST https://www.lecegep.ca/graphql   (formationEntries, paginé)
//
// La liste est GLOBALE (2281 formations, chacune portant ses établissements) ;
// on INVERSE en établissement → [programmes], filtré au CATALOGUE DEC seulement
// (profileFormation ∈ {Formation préuniversitaire, Formation technique}) —
// aucune formation continue / AEC / aux entreprises.
//
// Sortie : data/import/cegep_programs.json — par établissement :
//   { institution, region, programs: [{ name, code, type }] }
//   code = code DEC (null si absent) ; type = "préuniversitaire" | "technique".
//
// Zéro dépendance : global fetch (Node 18+). Délai poli 0.8s entre pages.
// Exit 1 si ZÉRO programme (fichier NON écrit). JSON ONLY — aucune DB.
//
// Flags :  --limit <n>  (n pages max, tests polis) · --out <path>
// ============================================================================
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = "https://www.lecegep.ca/graphql";
const UA = "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)";
const PAGE = 100;
const DELAY_MS = 800;
const TIMEOUT_MS = 30_000;
const DEC_PROFILES = new Map([
  ["Formation préuniversitaire", "préuniversitaire"],
  ["Formation technique", "technique"],
]);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = path.join(ROOT, "data/import/cegep_programs.json");

function parseArgs(argv) {
  const out = { limitPages: Infinity, outPath: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) out.limitPages = Math.max(1, parseInt(argv[++i], 10) || 1);
    else if (argv[i] === "--out" && argv[i + 1]) out.outPath = path.resolve(argv[++i]);
  }
  return out;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERY = `query ($limit:Int!, $offset:Int!) {
  formationEntries(site:"fr", limit:$limit, offset:$offset, orderBy:"title ASC", relationEtablissements:":notempty:") {
    title
    ... on formation_default_Entry {
      formationCode
      profileFormation { title }
      relationEtablissements {
        ... on formationInstitution_default_Entry {
          institution {
            title
            ... on institution_default_Entry { regionInstitution { title } }
          }
        }
      }
    }
  }
}`;

async function fetchPage(offset) {
  await sleep(DELAY_MS);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { limit: PAGE, offset } }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const json = await res.json();
    if (json.errors) throw new Error("GraphQL: " + JSON.stringify(json.errors).slice(0, 200));
    return json.data.formationEntries ?? [];
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  if (typeof fetch !== "function") { console.error("Node 18+ requis (global fetch)."); process.exit(1); }
  const { limitPages, outPath } = parseArgs(process.argv.slice(2));

  // institution.title -> { region, programs: Map(key -> {name,code,type}) }
  const byInst = new Map();
  let offset = 0, page = 0, totalForms = 0, decForms = 0;

  for (; page < limitPages; page++) {
    let rows;
    try { rows = await fetchPage(offset); }
    catch (e) { console.error(`page ${page + 1} (offset ${offset}) -> ${e.message}`); process.exit(1); }
    if (rows.length === 0) break;
    totalForms += rows.length;

    for (const f of rows) {
      const profile = (f.profileFormation ?? []).map((p) => p.title).find((t) => DEC_PROFILES.has(t));
      if (!profile) continue; // hors catalogue DEC (continue/AEC/entreprises)
      decForms++;
      const type = DEC_PROFILES.get(profile);
      const prog = { name: f.title, code: f.formationCode ?? null, type };
      for (const blk of f.relationEtablissements ?? []) {
        for (const inst of blk.institution ?? []) {
          const name = inst.title;
          if (!name) continue;
          let e = byInst.get(name);
          if (!e) { e = { region: inst.regionInstitution?.[0]?.title ?? null, programs: new Map() }; byInst.set(name, e); }
          const key = (prog.code || "") + "|" + prog.name; // dédup par (code,nom) intra-établissement
          if (!e.programs.has(key)) e.programs.set(key, prog);
        }
      }
    }
    console.log(`page ${page + 1}: +${rows.length} formations (offset ${offset}) — DEC cumulés ${decForms}, établissements ${byInst.size}`);
    offset += PAGE;
    if (rows.length < PAGE) break;
  }

  const result = [...byInst.entries()]
    .map(([institution, e]) => ({ institution, region: e.region, programs: [...e.programs.values()] }))
    .filter((r) => r.programs.length > 0)
    .sort((a, b) => a.institution.localeCompare(b.institution, "fr"));

  const totalPrograms = result.reduce((n, r) => n + r.programs.length, 0);
  if (totalPrograms === 0) { console.error("\nZéro programme DEC — fichier NON écrit."); process.exit(1); }

  await writeFile(outPath, JSON.stringify(result, null, 1) + "\n", "utf-8");

  const byType = {};
  for (const r of result) for (const p of r.programs) byType[p.type] = (byType[p.type] || 0) + 1;
  const withCode = result.reduce((n, r) => n + r.programs.filter((p) => p.code).length, 0);
  console.log(`\n=== ${outPath} écrit ===`);
  console.log(`formations parcourues : ${totalForms}`);
  console.log(`formations DEC (préuni/technique) : ${decForms}`);
  console.log(`établissements : ${result.length}`);
  console.log(`programmes (paires établissement×programme) : ${totalPrograms}  | par type : ${JSON.stringify(byType)}`);
  console.log(`programmes avec code DEC : ${withCode} / ${totalPrograms}`);
  console.log(`\nsample (2 établissements) :`);
  for (const r of result.slice(0, 2)) console.log(`  ${r.institution} [${r.region}] — ${r.programs.length} prog. ex: ${r.programs.slice(0, 2).map((p) => `${p.name}${p.code ? " (" + p.code + ")" : ""}`).join(" · ")}`);
}

main().catch((e) => { console.error("\nFATAL:", e.message); process.exit(1); });
