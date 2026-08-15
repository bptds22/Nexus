// scripts/parse-leaguesuite-games.mjs
// ============================================================================
// QBFL / QMFL / QMJFL — HORAIRES 2026. 100 % lecture, aucune requête réseau.
//
// POURQUOI PAS DE SCRAPING ICI. Les trois sites LeagueSuite montent leur
// calendrier CÔTÉ CLIENT : /division/{id}/schedule ne rend que le chrome en
// HTTP (72 lignes de texte), et /api/v1/matches répond 401 même avec la
// session anonyme complète. Le contrôle sur les saisons PASSÉES (QMFL 2025 et
// 2024, QBFL 2025) rend le même vide — ce n'est donc pas un fait de données.
// Les pages ont été lues au NAVIGATEUR (Claude in Chrome, lecture seule) et le
// texte rendu est conservé tel quel dans :
//   data/import/_browser_{qmfl,qbfl,qmjfl}_schedule.txt
// Ce script ne fait que parser ces captures — la provenance reste vérifiable.
//
// FORME DU TEXTE RENDU
//   Semaine 1 / Week 1
//   SAM. AOÛT 29            <- date
//   3:00 PM                 <- heure
//   Myers Riders            <- VISITEUR
//   @
//   LaSalle Warriors        <- LOCAL
//   Parc Riverside (Main)   <- terrain
//   Aperçu: / Preview:
// Et pour un match joué, le pointage encadre le « @ » :
//   Les Loups du Nord / 7 / @ / 44 / North Shore Broncos / … / Summary
//
// Sorties : data/import/civil_football_games_{qmfl,qbfl,qmjfl}.json
// Aucune écriture DB. Zéro dépendance.
//
// Run:  node scripts/parse-leaguesuite-games.mjs
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "..", "data", "import");
const ANNEE = 2026;

const MOIS = {
  JANV: 1, JAN: 1, FÉVR: 2, FEV: 2, FEB: 2, MARS: 3, MAR: 3, AVR: 4, APR: 4,
  MAI: 5, MAY: 5, JUIN: 6, JUN: 6, JUIL: 7, JUL: 7, AOÛT: 8, AOUT: 8, AUG: 8,
  SEPT: 9, SEP: 9, OCT: 10, NOV: 11, DÉC: 12, DEC: 12,
};

const LIGUES = [
  { key: "qmfl", ligue: "QMFL", nom: "Quebec Midget Football League", categorie: "Midget AAA", division: "QMFL", base: "https://qmfl.ca/league/qmfl/division/10/schedule" },
  { key: "qbfl", ligue: "QBFL", nom: "Quebec Bantam Football League", categorie: "Bantam AAA", division: "QBFL", base: "https://qbflzone.com/league/qbfl/division/10/schedule" },
  { key: "qmjfl", ligue: "QMJFL", nom: "Ligue de Football Junior Majeur du Québec", categorie: "Junior Major", division: "QMJFL", base: "https://qmjfl.leaguesuite.com/league/quebec-major-junior-football-league/division/1/schedule" },
];

const estDate = (l) => /^(LUN|MAR|MER|JEU|VEN|SAM|DIM|MON|TUE|WED|THU|FRI|SAT|SUN)\.?\s+[A-ZÉÛÈ]+\.?\s+\d{1,2}$/i.test(l);
const estHeure = (l) => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(l);
const estSemaine = (l) => /^(Semaine|Week)\s+\d+$/i.test(l);
const estFin = (l) => /^(Aperçu:?|Preview:?|Summary|Résumé)$/i.test(l);
const estEntier = (l) => /^\d{1,3}$/.test(l);

function isoDate(ligne) {
  const m = ligne.match(/^[A-ZÉÛ]+\.?\s+([A-ZÉÛÈ]+)\.?\s+(\d{1,2})$/i);
  if (!m) return null;
  const mois = MOIS[m[1].toUpperCase().replace(/\.$/, "")];
  if (!mois) return null;
  return `${ANNEE}-${String(mois).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

function parse(texte, cfg) {
  const lignes = texte.split("\n").map((s) => s.trim()).filter(Boolean);
  const matchs = [];
  let semaine = null;

  for (let i = 0; i < lignes.length; i++) {
    if (estSemaine(lignes[i])) { semaine = lignes[i]; continue; }
    if (!estDate(lignes[i])) continue;

    const date = isoDate(lignes[i]);
    if (!date || !estHeure(lignes[i + 1] ?? "")) continue;

    // on ramasse le bloc jusqu'au marqueur de fin
    const bloc = [];
    for (let j = i + 2; j < lignes.length && !estFin(lignes[j]); j++) {
      if (estDate(lignes[j]) || estSemaine(lignes[j])) break;
      bloc.push(lignes[j]);
    }
    const at = bloc.indexOf("@");
    if (at < 0) continue;

    // avant le « @ » : visiteur (+ son pointage) ; après : (pointage local) local, terrain
    const avant = bloc.slice(0, at);
    const apres = bloc.slice(at + 1);
    let pointageVisiteur = null, pointageLocal = null;
    if (avant.length && estEntier(avant.at(-1))) pointageVisiteur = Number(avant.pop());
    if (apres.length && estEntier(apres[0])) pointageLocal = Number(apres.shift());
    const visiteur = avant.join(" ").trim();
    const terrain = apres.length > 1 ? apres.pop() : null;
    const local = apres.join(" ").trim();
    if (!visiteur || !local) continue;

    matchs.push({
      ligue: cfg.ligue,
      saison: "2026",
      categorie: cfg.categorie,
      division: cfg.division,
      semaine,
      date,
      heure: lignes[i + 1],
      equipe_locale: local,
      equipe_visiteuse: visiteur,
      terrain,
      pointage_local: pointageLocal,
      pointage_visiteur: pointageVisiteur,
      joue: pointageLocal != null && pointageVisiteur != null,
    });
    i++;
  }
  return matchs;
}

async function main() {
  const recap = [];
  for (const cfg of LIGUES) {
    const texte = await readFile(path.join(DATA, `_browser_${cfg.key}_schedule.txt`), "utf8");
    let matchs = parse(texte, cfg);

    // la page QMFL republie une ligne à l'identique (Orleans @ Myers, 2 oct.) —
    // on dédoublonne sur date+heure+paire, et on garde la trace du doublon.
    const vus = new Map();
    const doublons = [];
    for (const m of matchs) {
      const cle = `${m.date}|${m.heure}|${m.equipe_locale}|${m.equipe_visiteuse}`;
      if (vus.has(cle)) { doublons.push(cle); continue; }
      vus.set(cle, m);
    }
    matchs = [...vus.values()].sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));

    const dates = matchs.map((m) => m.date).sort();
    const joues = matchs.filter((m) => m.joue).length;
    const equipes = [...new Set(matchs.flatMap((m) => [m.equipe_locale, m.equipe_visiteuse]))].sort();

    console.log(`\n== ${cfg.ligue} : ${matchs.length} matchs, ${equipes.length} équipes`);
    console.log(`   plage : ${dates[0]} -> ${dates.at(-1)} | joués : ${joues}${doublons.length ? ` | doublons source écartés : ${doublons.length}` : ""}`);
    console.log(`   équipes : ${equipes.join(", ")}`);

    const out = path.join(DATA, `civil_football_games_${cfg.key}.json`);
    await writeFile(
      out,
      JSON.stringify(
        {
          source: cfg.base,
          plateforme: "LeagueSuite",
          methode: "page lue au navigateur (calendrier monté côté client, non accessible en HTTP) ; capture brute conservée dans _browser_" + cfg.key + "_schedule.txt",
          ligue: cfg.ligue,
          ligue_nom: cfg.nom,
          saison: "2026",
          categorie: cfg.categorie,
          total_matchs: matchs.length,
          plage_dates: { debut: dates[0] ?? null, fin: dates.at(-1) ?? null },
          matchs_joues: joues,
          doublons_source_ecartes: doublons,
          equipes,
          matchs,
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log(`   --> ${out}`);
    recap.push({ ligue: cfg.ligue, matchs: matchs.length, equipes: equipes.length, debut: dates[0], fin: dates.at(-1), joues, doublons: doublons.length });
  }
  console.log("\n" + JSON.stringify(recap, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
