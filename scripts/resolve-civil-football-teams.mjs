// scripts/resolve-civil-football-teams.mjs
// ============================================================================
// RÉSOLUTION des noms d'équipes des matchs vers l'inventaire d'équipes.
// 100 % lecture, aucune requête réseau, aucune requête DB. Rien n'est inséré.
//
// LE PRINCIPE, ET POURQUOI IL TIENT.
// La tentation est de résoudre « Lasalle Warriors » vers `teams.name` en base
// par similarité de chaîne. C'est le piège : les libellés DB sont francisés
// (« Warriors de LaSalle »), un même club a plusieurs équipes (St. Leonard
// Cougars joue en QBFL ET en QMFL), et le fuzzy sur 446 matchs finit par
// coller deux équipes différentes ensemble sans qu'on le voie.
//
// On ne résout donc JAMAIS vers la base par le nom. On résout vers
// l'INVENTAIRE DE LA SOURCE — les mêmes fichiers de découverte qui ont produit
// les équipes — dans un périmètre fermé :
//
//     (ligue, saison, catégorie, division) -> libellé exact
//
// Le libellé d'un match et le libellé d'une équipe viennent de la MÊME page du
// MÊME site : à périmètre égal, l'égalité de chaîne est exacte, pas approchée.
// C'est l'inventaire qui porte ensuite le `teams.id`, une fois les équipes
// insérées — la jointure match -> équipe ne repose alors sur aucun texte.
//
// Ce script PROUVE cette affirmation : il résout les 446 matchs et signale la
// moindre chaîne non résolue. Zéro non-résolu = la règle tient.
//
// Run:  node scripts/resolve-civil-football-teams.mjs
// ============================================================================

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "import");
const J = async (f) => JSON.parse(await readFile(path.join(DATA, f), "utf8"));

/** Clé de périmètre. La ligue en fait partie : QBFL écrit « Lasalle Warriors »
 *  et QMFL « LaSalle Warriors » — deux chaînes, deux équipes, deux ligues. */
const scope = (ligue, saison, categorie, division) =>
  `${ligue}::${saison}::${categorie ?? ""}::${division ?? ""}`;

async function main() {
  // ---------- 1. l'inventaire des 103 équipes tackle -----------------------
  const inv = new Map(); // scope -> Map(libellé -> équipe)
  const add = (ligue, saison, categorie, division, nom, meta) => {
    const s = scope(ligue, saison, categorie, division);
    if (!inv.has(s)) inv.set(s, new Map());
    inv.get(s).set(nom, { ligue, saison, categorie, division, nom, ...meta });
  };

  const lfmm = await J("civil_football_lfmm.json");
  for (const t of lfmm.equipes.filter((e) => !/^FLAG/i.test(e.categorie ?? ""))) {
    add("LFMM", "Fall 2026", t.categorie, t.division, t.equipe_nom, {
      club_source: t.club, node_id: t.node_id,
    });
  }

  const ls = await J("civil_football_leaguesuite.json");
  const IGNORER = new Set(["Test 1", "Test 2", "Ottawa JR Riders"]);
  for (const l of ls.ligues) {
    const label = l.saisons?.find((s) => s.id === l.contexte?.saison_courante_id)?.label;
    for (const e of l.equipes) {
      if (e.saison !== label) continue;
      if (IGNORER.has(e.equipe_nom)) continue;
      if (e.setup_division_id == null) continue; // non rattachée à une division
      add(l.ligue, "2026", e.categorie, e.division, e.equipe_nom, {
        club_source: e.club, team_id: e.team_id, setup_team_id: e.setup_team_id,
      });
    }
  }

  let nbEquipes = 0;
  for (const m of inv.values()) nbEquipes += m.size;
  console.log(`INVENTAIRE : ${nbEquipes} équipes tackle sur ${inv.size} périmètres (ligue×saison×catégorie×division)\n`);

  // ---------- 2. résolution des 446 matchs ---------------------------------
  const fichiers = [
    ["LFMM", "civil_football_games_lfmm.json"],
    ["QMFL", "civil_football_games_qmfl.json"],
    ["QBFL", "civil_football_games_qbfl.json"],
    ["QMJFL", "civil_football_games_qmjfl.json"],
  ];

  let total = 0, resolus = 0;
  const echecs = [];
  for (const [ligue, f] of fichiers) {
    const d = await J(f);
    let ok = 0;
    for (const g of d.matchs) {
      total++;
      const s = scope(ligue, g.saison, g.categorie, g.division);
      const table = inv.get(s);
      const h = table?.get(g.equipe_locale);
      const v = table?.get(g.equipe_visiteuse);
      if (h && v) { ok++; resolus++; }
      else {
        echecs.push({
          ligue, date: g.date, scope: s,
          locale: g.equipe_locale, locale_ok: Boolean(h),
          visiteuse: g.equipe_visiteuse, visiteuse_ok: Boolean(v),
          perimetre_connu: Boolean(table),
        });
      }
    }
    console.log(`${ligue.padEnd(6)} ${String(ok).padStart(3)}/${d.matchs.length} matchs résolus des DEUX côtés`);
  }

  console.log(`\nTOTAL : ${resolus}/${total} matchs résolus — ${echecs.length} échec(s)`);
  for (const e of echecs.slice(0, 25)) {
    console.log(`  ✗ ${e.ligue} ${e.date} [${e.scope}]`);
    if (!e.locale_ok) console.log(`      locale non résolue    : « ${e.locale} »`);
    if (!e.visiteuse_ok) console.log(`      visiteuse non résolue : « ${e.visiteuse} »`);
    if (!e.perimetre_connu) console.log(`      (périmètre inconnu)`);
  }

  // ---------- 3. les trois cas demandés ------------------------------------
  console.log(`\n════ LES TROIS CAS ════`);
  const montre = (titre, libelle) => {
    console.log(`\n── ${titre}`);
    let n = 0;
    for (const [s, table] of inv) {
      for (const [nom, e] of table) {
        if (nom.toLowerCase().replace(/\s+/g, "") !== libelle.toLowerCase().replace(/\s+/g, "")) continue;
        n++;
        console.log(`   ${s}`);
        console.log(`      libellé source « ${nom} » · club « ${e.club_source} » · id source ${e.node_id ?? e.team_id}`);
      }
    }
    if (!n) console.log(`   (aucune entrée pour « ${libelle} »)`);
  };
  montre("St. Leonard Cougars — un club, deux ligues", "St. Leonard Cougars");
  montre("Lasalle Warriors — graphie QBFL", "Lasalle Warriors");
  montre("LaSalle Warriors — graphie QMFL", "LaSalle Warriors");
  montre("Myers Riders — libellé du registre", "Myers Riders");
  montre("Myers Ryders — libellé du menu", "Myers Ryders");

  // le menu marketing n'est PAS une source de résolution : on le montre
  console.log(`\n── « Myers Ryders » d'où vient-il ?`);
  for (const l of ls.ligues) {
    for (const c of l.clubs_menu ?? []) {
      if (/myers/i.test(c.nom)) console.log(`   ${l.ligue} · menu de navigation : « ${c.nom} » <${c.site}>`);
    }
    for (const e of l.equipes) {
      if (/myers/i.test(e.equipe_nom)) console.log(`   ${l.ligue} · registre d'équipes (${e.saison}) : « ${e.equipe_nom} » team_id=${e.team_id}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
