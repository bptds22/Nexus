// scripts/civil-football-no-schedule.mjs
// ============================================================================
// « Quelles équipes n'ont AUCUN match programmé à partir d'aujourd'hui ? »
// 100 % LECTURE. Aucune insertion, aucun gros fichier de sortie : la liste
// s'imprime, et seul un petit JSON récapitulatif est écrit.
//
// LFMM — la page horaire d'UNE équipe est rendue côté serveur :
//   default.asp?u=LFMM&s=football&p=schedule&div=<nodeID>&viewseas=Fall_2026
// Elle liste « Dim, 30/8/26 · 1:30 pm · @ Titans · Stade … ». On lit les dates
// au format j/m/aa et on compte celles >= aujourd'hui. 144 équipes, 800 ms
// entre chaque requête.
//
// LEAGUESUITE (QBFL/QMFL/QMJFL) — /division/{id}/schedule ne rend AUCUN match
// côté serveur, et /api/v1/matches est authentifié (401 même avec la session
// anonyme complète). On ne peut donc pas conclure directement.
// D'où le CONTRÔLE : on demande la même page pour une saison PASSÉE. Si 2025
// rend des matchs et 2026 non, l'absence est un fait de données ; si 2025 est
// vide aussi, l'absence n'est qu'un artefact de rendu et on ne conclut RIEN.
//
// Run:  node scripts/civil-football-no-schedule.mjs
//   flags: --only lfmm|ls
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "..", "data", "import");
const argv = process.argv.slice(2);
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;
async function get(url) {
  if (!first) await sleep(800);
  first = false;
  const res = await fetch(url, { headers: HEADERS });
  return { status: res.status, body: await res.text() };
}

const AUJOURDHUI = new Date();
AUJOURDHUI.setHours(0, 0, 0, 0);

/** « Dim, 30/8/26 » -> Date. Le site écrit j/m/aa. */
function parseDatesFr(html) {
  const out = [];
  for (const m of html.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{2})\b/g)) {
    const [, j, mo, a] = m;
    const d = new Date(2000 + Number(a), Number(mo) - 1, Number(j));
    if (!Number.isNaN(d.getTime())) out.push(d);
  }
  return out;
}

async function lfmm() {
  const src = JSON.parse(await readFile(path.join(DATA, "civil_football_lfmm.json"), "utf8"));
  const equipes = src.equipes;
  console.log(`\n########## LFMM — ${equipes.length} équipes, saison ${src.saison_courante}\n`);

  const sans = [], avec = [], erreurs = [];
  for (const [i, t] of equipes.entries()) {
    const url = `https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=schedule&div=${encodeURIComponent(t.node_id)}&viewseas=Fall_2026`;
    let r;
    try {
      r = await get(url);
    } catch (e) {
      erreurs.push({ ...t, err: e.message });
      continue;
    }
    if (r.status !== 200) {
      erreurs.push({ ...t, err: `HTTP ${r.status}` });
      continue;
    }
    // on isole le tableau d'horaire pour ne pas ramasser les dates du chrome
    const bloc = r.body.match(/Adversaire[\s\S]*?(?:<\/table>|Info sur le Match[\s\S]*?<\/table>)/i)?.[0] ?? r.body;
    const dates = parseDatesFr(bloc);
    const futurs = dates.filter((d) => d >= AUJOURDHUI);
    const row = { ...t, total: dates.length, futurs: futurs.length,
      prochain: futurs.length ? futurs.sort((a, b) => a - b)[0].toISOString().slice(0, 10) : null };
    (futurs.length ? avec : sans).push(row);
    if ((i + 1) % 20 === 0) process.stdout.write(`  … ${i + 1}/${equipes.length}\n`);
  }

  console.log(`\n== LFMM : ${avec.length} équipes avec calendrier, ${sans.length} SANS, ${erreurs.length} erreurs\n`);
  if (sans.length) {
    console.log("ÉQUIPES SANS AUCUN MATCH À VENIR :");
    const parCat = {};
    for (const t of sans) (parCat[t.categorie] ??= []).push(t);
    for (const [cat, list] of Object.entries(parCat)) {
      console.log(`  ${cat} (${list.length})`);
      for (const t of list) console.log(`      ${t.equipe_nom.padEnd(28)} ${t.division}   ${t.total ? `(${t.total} match(s), aucun à venir)` : "(aucun match du tout)"}`);
    }
  }
  if (erreurs.length) {
    console.log("\nERREURS :");
    for (const e of erreurs) console.log(`  ${e.equipe_nom} — ${e.err}`);
  }
  return { avec: avec.length, sans, erreurs };
}

async function leaguesuite() {
  console.log(`\n########## LEAGUESUITE — contrôle rendu serveur\n`);
  const compte = (h) => ({
    bytes: h.length,
    vs: (h.match(/\bvs\b/gi) || []).length,
    heures: (h.match(/\b\d{1,2}:\d{2}\s*(am|pm)\b/gi) || []).length,
    texte: h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, "\n").split("\n").map((s) => s.trim()).filter(Boolean).length,
  });
  const cibles = [
    ["QMFL 2026 (F26)", "https://qmfl.ca/league/qmfl/division/10/schedule"],
    ["QMFL 2025 (F25) — CONTRÔLE", "https://qmfl.ca/league/qmfl/division/1/schedule"],
    ["QMFL 2024 (F24) — CONTRÔLE", "https://qmfl.ca/league/qmfl/division/2/schedule"],
    ["QBFL 2026 (F26)", "https://qbflzone.com/league/qbfl/division/10/schedule"],
    ["QBFL 2025 (F25) — CONTRÔLE", "https://qbflzone.com/league/qbfl/division/7/schedule"],
    ["QMJFL 2026 (F26)", "https://qmjfl.leaguesuite.com/league/quebec-major-junior-football-league/division/1/schedule"],
  ];
  const res = [];
  for (const [nom, url] of cibles) {
    const r = await get(url);
    const c = compte(r.body);
    res.push({ nom, url, status: r.status, ...c });
    console.log(`  ${nom.padEnd(30)} [${r.status}] ${String(c.bytes).padStart(6)} o · ${c.texte} lignes de texte · ${c.vs} « vs » · ${c.heures} heures`);
  }
  const passees = res.filter((r) => /CONTRÔLE/.test(r.nom));
  const rendu = passees.some((r) => r.vs > 0 || r.heures > 0);
  console.log(
    rendu
      ? "\n  -> Les saisons passées RENDENT des matchs : l'absence en 2026 est un fait de données."
      : "\n  -> Les saisons passées ne rendent RIEN non plus : le calendrier est monté côté client.\n     CONCLUSION IMPOSSIBLE par cette voie — il faut un navigateur (Claude in Chrome) pour trancher.",
  );
  return { res, concluant: rendu };
}

const out = {};
if (ONLY !== "ls") out.lfmm = await lfmm();
if (ONLY !== "lfmm") out.leaguesuite = await leaguesuite();
await writeFile(
  path.join(DATA, "civil_football_sans_calendrier.json"),
  JSON.stringify(
    {
      genere_le: AUJOURDHUI.toISOString().slice(0, 10),
      lfmm_sans_calendrier: out.lfmm?.sans?.map((t) => ({ equipe: t.equipe_nom, categorie: t.categorie, division: t.division, node_id: t.node_id, matchs_total: t.total })) ?? [],
      lfmm_avec_calendrier: out.lfmm?.avec ?? 0,
      leaguesuite_controle: out.leaguesuite ?? null,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`\n--> ${path.join(DATA, "civil_football_sans_calendrier.json")}`);
