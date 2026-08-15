// scripts/scrape-lfmm-games.mjs
// ============================================================================
// LFMM — HORAIRES 2026, TACKLE SEULEMENT (lot 1). 100 % lecture.
//
// Périmètre : les 77 équipes dont la catégorie n'est pas FLAG *. Le flag est
// un second lot : ses 67 équipes n'ont d'ailleurs aucun match publié.
//
// SOURCE. La page horaire d'une équipe est rendue côté serveur et son HTML est
// directement exploitable — pas besoin de deviner :
//   <tr id="schedRow1407606" class="… schedRowDay_20260828">
//     td.col_Details   -> <a … gameID=1407606>       (identifiant du match)
//     td.col_Date      -> « Ven, 28/8/26 »
//     td.col_Time      -> « 8:00 pm »
//     td.col_Opponent  -> « Vicas » (domicile) ou « @ Vicas » (visiteur)
//     td.col_Score     -> vide tant que le match n'est pas joué
//     td.col_Location  -> « Parc des Bénévoles »
// La date ISO est DANS la classe (`schedRowDay_YYYYMMDD`) : on ne dépend pas
// du format j/m/aa affiché.
//
// DÉDOUBLONNAGE — attention au piège. Chaque match apparaît deux fois, une par
// équipe, et HomeTeamsONLINE attribue un `gameID` DIFFÉRENT à chaque vue :
// le même Stallions–Wildcats Ouest du 22/8 porte 1405392 côté receveur et
// 1405393 côté visiteur (ids consécutifs). `gameID` n'est donc PAS une
// identité de match — dédoublonner dessus ne fusionne rien (716 lignes au lieu
// de 358). La clé retenue : date ISO + catégorie + division + la paire
// d'équipes triée. On croise ensuite les deux vues : celle de l'équipe qui
// reçoit donne le domicile, celle qui se déplace donne le visiteur. Un match
// vu d'un seul côté (adversaire hors périmètre) reste complet grâce au
// préfixe « @ ».
//
// Sortie : data/import/civil_football_games_lfmm.json — JSON SEULEMENT.
// Aucune écriture DB. Zéro dépendance. UA Nexus, délai 800 ms.
//
// Run:  node scripts/scrape-lfmm-games.mjs
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const SAISON = "Fall_2026";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "..", "data", "import");
const OUT = path.join(DATA, "civil_football_games_lfmm.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let first = true;
async function get(url) {
  if (!first) await sleep(800);
  first = false;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

const decode = (s) =>
  String(s ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&eacute;/gi, "é").replace(/&egrave;/gi, "è").replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à").replace(/&acirc;/gi, "â").replace(/&ccedil;/gi, "ç")
    .replace(/&ocirc;/gi, "ô").replace(/&icirc;/gi, "î").replace(/&iuml;/gi, "ï")
    .replace(/&ugrave;/gi, "ù").replace(/&ucirc;/gi, "û")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cell = (row, cls) =>
  decode(row.match(new RegExp(`<td[^>]*class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</td>`, "i"))?.[1] ?? "");

function parseRows(html) {
  const out = [];
  for (const m of html.matchAll(/<tr id="schedRow(\d+)"([^>]*)>([\s\S]*?)<\/tr>/gi)) {
    const [, rowId, attrs, body] = m;
    const iso = attrs.match(/schedRowDay_(\d{4})(\d{2})(\d{2})/);
    const gameId = body.match(/gameID=(\d+)/)?.[1] ?? rowId;
    const opponentRaw = cell(body, "col_Opponent");
    const exterieur = /^@/.test(opponentRaw);
    out.push({
      game_id: gameId,
      date: iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null,
      date_affichee: cell(body, "col_Date") || null,
      heure: cell(body, "col_Time") || null,
      adversaire: opponentRaw.replace(/^@\s*/, "") || null,
      exterieur,
      pointage_brut: cell(body, "col_Score") || null,
      terrain: cell(body, "col_Location") || null,
    });
  }
  return out;
}

/** « L 7-44 », « G 21 - 14 », « 7-44 » -> { pour, contre } côté équipe vue. */
function parsePointage(txt) {
  if (!txt) return null;
  const m = txt.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]), brut: txt };
}

async function main() {
  const src = JSON.parse(await readFile(path.join(DATA, "civil_football_lfmm.json"), "utf8"));
  const tackle = src.equipes.filter((t) => !/^FLAG/i.test(t.categorie ?? ""));
  console.log(`LFMM — ${tackle.length} équipes tackle (flag exclu : ${src.equipes.length - tackle.length})\n`);

  const parGame = new Map();
  const erreurs = [];

  for (const [i, t] of tackle.entries()) {
    const url = `https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=schedule&div=${encodeURIComponent(t.node_id)}&viewseas=${SAISON}`;
    let rows;
    try {
      rows = parseRows(await get(url));
    } catch (e) {
      erreurs.push({ equipe: t.equipe_nom, node_id: t.node_id, err: e.message });
      continue;
    }
    for (const r of rows) {
      const paire = [t.equipe_nom, r.adversaire ?? "?"].sort((a, b) => a.localeCompare(b, "fr")).join(" | ");
      const cle = `${r.date}::${t.categorie}::${t.division}::${paire}`;
      const g = parGame.get(cle) ?? {
        cle,
        game_ids: [],
        ligue: "LFMM",
        saison: "Fall 2026",
        categorie: t.categorie,
        division: t.division,
        date: r.date,
        date_affichee: r.date_affichee,
        heure: r.heure,
        terrain: r.terrain,
        equipe_locale: null,
        equipe_visiteuse: null,
        pointage_local: null,
        pointage_visiteur: null,
        pointage_brut: r.pointage_brut,
        joue: false,
        vu_depuis: [],
        url_match: `https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=preview&sportsHQ=${t.node_id}&gameID=${r.game_id}`,
      };
      g.vu_depuis.push(t.equipe_nom);
      if (!g.game_ids.includes(r.game_id)) g.game_ids.push(r.game_id);
      g.heure ||= r.heure;
      // l'équipe consultée est visiteuse si l'adversaire est préfixé « @ »
      if (r.exterieur) {
        g.equipe_visiteuse ??= t.equipe_nom;
        g.equipe_locale ??= r.adversaire;
      } else {
        g.equipe_locale ??= t.equipe_nom;
        g.equipe_visiteuse ??= r.adversaire;
        g.terrain ||= r.terrain;
      }
      const p = parsePointage(r.pointage_brut);
      if (p) {
        g.joue = true;
        g.pointage_brut ??= p.brut;
        // le pointage est écrit du point de vue de l'équipe consultée
        if (r.exterieur) { g.pointage_visiteur ??= p.a; g.pointage_local ??= p.b; }
        else { g.pointage_local ??= p.a; g.pointage_visiteur ??= p.b; }
      }
      parGame.set(cle, g);
    }
    if ((i + 1) % 20 === 0) process.stdout.write(`  … ${i + 1}/${tackle.length}\n`);
  }

  const games = [...parGame.values()].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) || String(a.heure).localeCompare(String(b.heure)),
  );

  const dates = games.map((g) => g.date).filter(Boolean).sort();
  const joues = games.filter((g) => g.joue).length;
  const unSeulCote = games.filter((g) => g.vu_depuis.length === 1).length;

  console.log(`\n== LFMM : ${games.length} matchs distincts`);
  console.log(`   plage : ${dates[0]} -> ${dates.at(-1)}`);
  console.log(`   joués : ${joues}`);
  console.log(`   vus d'un seul côté : ${unSeulCote}`);
  console.log(`   sans date : ${games.filter((g) => !g.date).length}`);
  const parCat = {};
  for (const g of games) parCat[g.categorie] = (parCat[g.categorie] || 0) + 1;
  for (const [c, n] of Object.entries(parCat)) console.log(`   ${c.padEnd(12)} ${n}`);
  if (erreurs.length) {
    console.log(`\n   ERREURS (${erreurs.length}) :`);
    for (const e of erreurs) console.log(`     ${e.equipe} — ${e.err}`);
  }

  if (!games.length) {
    console.error("\nAUCUN match — sortie NON écrite.");
    process.exit(1);
  }

  await writeFile(
    OUT,
    JSON.stringify(
      {
        source: "LFMM — https://www.lfmm.net (HomeTeamsONLINE)",
        methode: "page horaire par équipe, rendu serveur, dédoublonné par gameID",
        saison: "Fall 2026",
        lot: "tackle seulement (flag = lot 2)",
        equipes_sondees: tackle.length,
        total_matchs: games.length,
        plage_dates: { debut: dates[0] ?? null, fin: dates.at(-1) ?? null },
        matchs_joues: joues,
        erreurs,
        matchs: games,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\n--> ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
