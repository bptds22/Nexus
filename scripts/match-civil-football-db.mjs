// scripts/match-civil-football-db.mjs
// ============================================================================
// Football civil — CROISEMENT des 4 sources avec NOTRE base (100 % read-only)
//
// Entrées (produites par les scrapers de découverte) :
//   data/import/civil_football_lfmm.json         (LFMM,  144 équipes)
//   data/import/civil_football_leaguesuite.json  (QBFL / QMFL / QMJFL)
//
// COMMENT LE CIVIL VIT DANS NOTRE SCHÉMA (vérifié sur le projet cloud
// nrloizyemulbhujrqhgx le 2026-08-13, en lecture seule) :
//
//   • Un CLUB civil = une ligne `public.schools` avec `type = 'LIGUE_CIVILE'`.
//     266 lignes au total, tous sports confondus. La table n'a PAS de
//     `sport_id` : un club est sport-agnostique. Colonnes utiles : name,
//     city (quasi toujours NULL sur le civil), region, website, logo_url.
//   • Une ÉQUIPE = une ligne `public.teams` (school_id → le club, sport_id,
//     name, division, age_group, gender, league (texte), season, is_active).
//     C'est `teams.sport_id` qui porte le sport, jamais le club.
//   • `public.ligues` n'est PAS la table des ligues civiles : elle ne contient
//     que la taxonomie RSEQ SCOLAIRE (Football cadet D1, juvénile D1/D2,
//     régional D3+, Flag Championnat). Aucune trace de LFMM / QBFL / QMFL /
//     QMJFL. Le rattachement d'une équipe à sa ligue civile se ferait donc
//     par `teams.league` (texte libre) — aujourd'hui NULL partout.
//   • Ni `schools` ni `teams` n'ont de colonne `created_by`. L'origine se lit
//     aux dates : les clubs civils football viennent du seed one-shot depuis
//     l'annuaire Football Québec, et les 2 seules équipes civiles football
//     existantes datent du 2026-05-25 (Wildcats, seed élite) et du 2026-07-07
//     (« Nexus », fixture de démo). Aucune équipe civile football créée par
//     un coach à ce jour.
//
//   ÉTAT DE DÉPART, en clair :
//     civil × Football       -> 2 équipes / 2 clubs
//     civil × Hockey         -> 15 équipes / 15 clubs (seed élite M18 AAA)
//     civil × tout le reste  -> 0 équipe
//   Autrement dit : les clubs sont largement là, les ÉQUIPES n'existent pas.
//
// Le mapping club source -> club DB ci-dessous a été établi par requêtes
// ILIKE sur `schools` puis arbitré à la main. Il est VOLONTAIREMENT explicite
// et figé dans le fichier : c'est la pièce que BP doit relire.
//
// Sorties : data/import/civil_football_matching.csv + .md
// AUCUNE écriture DB. Zéro dépendance.
//
// Run:  node scripts/match-civil-football-db.mjs
// ============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, "..", "data", "import");

// --------------------------------------------------------------------------
// Instantané LECTURE SEULE des clubs civils candidats (schools.type =
// 'LIGUE_CIVILE'), capturé le 2026-08-13. Rafraîchir avec :
//   select id, name, region from public.schools where type='LIGUE_CIVILE';
// --------------------------------------------------------------------------
const DB_CLUBS = {
  "Aces Pointe Saint-Charles": ["76db2b4e-c9d3-4590-bddc-471375527f46", "Montréal"],
  "Barons de Saint-Bruno": ["ac957b4c-755c-45dc-9259-18303ce1ff46", "Rive-Sud"],
  "Bulldogs de Laval": ["effd8a0c-cb55-4756-958d-e72be78a4320", "Laval"],
  "Cougars de Lakeshore": ["cef6aeba-b028-489f-bfc4-41a0f8ff9ab4", "Lac St-Louis"],
  "Cougars de Saint-Léonard": ["aff4fe61-9c05-4e15-8ef8-5ff1c093f200", "Bourassa"],
  "Diablos de LaPrairie": ["7f666c65-1359-4a70-8bde-6159e3dc24fc", "Rive-Sud"],
  "Football civil de Saint-Jean-sur-Richelieu (AFSCJ)": ["ea538b7e-fb6a-4fe1-a31a-520429918c8c", "Rive-Sud"],
  "Grizzlis de Boucherville": ["fd67d012-e41f-4c68-a139-4a7f7733b89f", "Rive-Sud"],
  "Hornets de la Rive-Sud": ["efc2bcaf-a001-40c8-85d8-a4432200f955", "Rive-Sud"],
  "Hornets de Sun Youth": ["6bdf59f4-1b40-4f41-8cb4-04112d138603", "Montréal"],
  "Lions du Lac St-Louis": ["d8fd91fe-01ce-43ee-bc4d-2f373960fc1c", "Montréal — Lac-Saint-Louis"],
  "North Shore Broncos": ["11fe3cb9-01e8-42c1-b32f-469c8f073377", "Montréal — Lac-Saint-Louis"],
  "Nos Jeunes à Cœur / Loups du Nord": ["029fa52e-9de3-4ad2-9d29-d65addb481d8", "Laurentides"],
  "Ottawa Junior Riders Football": ["a072677c-fa2c-4ae3-bce4-b5be315eab6b", "Outaouais"],
  "Packers de Greenfield": ["841c50d6-0873-4a40-8931-a3fac3e61550", "Rive-Sud"],
  "Patriotes de l'Ouest": ["14ee7e89-3283-4f63-b8db-d3f81d296615", "Lac St-Louis"],
  "Pirates du Richelieu": ["90848174-5dfd-4fdb-8480-fed92e008d8e", "Rive-Sud"],
  "Raiders de Chateauguay": ["94191deb-f4dd-4709-b2ab-c4a37924538d", "Sud-Ouest"],
  "Rhinos de Lanaudière": ["e68d56ee-e30f-4110-b099-e5b52834aa8c", "Lanaudière"],
  "South Shore Jr Packers": ["6a67ae8e-7c74-42f9-92e4-fa361f00552e", "Rive-Sud"],
  "Spartans de Saint-Laurent": ["479ca71a-4405-426a-be72-04ae16a10b35", "Lac St-Louis"],
  "Stallions de Saint-Lazare": ["e31cdd72-7762-4c23-9891-4197303a61c2", "Lac St-Louis"],
  "Vandoos de Drummondville": ["9daed387-05d1-4edb-8b28-c2fe4938bf7a", "Centre-du-Québec"],
  "Vicas de Victoriaville": ["2bc5a69e-5ac3-4257-ad24-0f3d15709422", "Centre-du-Québec"],
  "Vikings de Gatineau": ["96d9c81d-13cc-43f0-ac4c-c33c7c0012fc", "Outaouais"],
  "Vikings de Laval-Nord": ["1987b42b-7e35-4350-bc88-ab79105d24a7", "Laval"],
  "Warriors de LaSalle": ["20f94a7b-529a-426a-8c96-f7509e10db28", "Lac St-Louis"],
  "Wildcats Laurentides-Lanaudière": ["d4b92629-fd48-44be-b2d6-faa56aea0e49", "Laurentides"],
};

/**
 * club source -> { db, confiance, note }
 * confiance : HAUTE (nom + territoire concordants) | MOYENNE | AMBIGU | —
 * Clé = `${ligue}|${club racine ou nom complet}`.
 */
const MAPPING = {
  // ---- LFMM (racine du libellé d'équipe) --------------------------------
  "LFMM|Rhinos": { db: "Rhinos de Lanaudière", confiance: "HAUTE", note: "association LFMM « Rhinos Lanaudière »" },
  "LFMM|Barons": { db: "Barons de Saint-Bruno", confiance: "HAUTE", note: "association LFMM « Barons St-Bruno »" },
  "LFMM|Diablos": { db: "Diablos de LaPrairie", confiance: "HAUTE", note: "association LFMM « Diablos de Laprairie »" },
  "LFMM|Grizzlis": { db: "Grizzlis de Boucherville", confiance: "HAUTE", note: "association LFMM « Grizzlis de Boucherville »" },
  "LFMM|Vikings": { db: "Vikings de Laval-Nord", confiance: "HAUTE", note: "association LFMM « Vikings de Laval-Nord » — PAS les Vikings de Gatineau (QBFL/QMFL)" },
  "LFMM|Pirates": { db: "Pirates du Richelieu", confiance: "HAUTE", note: "association LFMM « Pirates du Richelieu »" },
  "LFMM|Vandoos": { db: "Vandoos de Drummondville", confiance: "HAUTE", note: "association LFMM « Vandoos de Drummondville »" },
  "LFMM|Packers": { db: "Packers de Greenfield", confiance: "HAUTE", note: "association LFMM « Packers Greenfield Park » — homonyme des South Shore Jr Packers (QMJFL)" },
  "LFMM|Vicas": { db: "Vicas de Victoriaville", confiance: "HAUTE", note: "association LFMM « Vicas de Victoriaville »" },
  "LFMM|Patriotes": { db: "Patriotes de l'Ouest", confiance: "HAUTE", note: "association LFMM « Western Patriotes »" },
  "LFMM|Stallions": { db: "Stallions de Saint-Lazare", confiance: "HAUTE", note: "association LFMM « Stallions Saint-Lazare »" },
  "LFMM|Wildcats": { db: "Wildcats Laurentides-Lanaudière", confiance: "HAUTE", note: "= ARFLL ; MÊME club que « Wildcats ARFLL » en QMJFL" },
  "LFMM|Cougars": { db: null, confiance: "AMBIGU", note: "2 candidats DB : Cougars de Lakeshore (Lac St-Louis) / Cougars de Saint-Léonard (Bourassa). Absent de la liste d'associations LFMM." },
  "LFMM|Titans": { db: null, confiance: "AMBIGU", note: "aucun club de football « Titans » en DB (le seul homonyme est un club de SOCCER, Bois-de-Filion). Candidat plausible : « Football civil de Saint-Jean-sur-Richelieu (AFSCJ) », l'association LFMM sans équipe rattachée." },
  "LFMM|Dorchesters": { db: null, confiance: "—", note: "aucun candidat en DB" },

  // ---- QBFL / QMFL / QMJFL (nom complet d'équipe) -----------------------
  "QBFL|Gatineau Vikings": { db: "Vikings de Gatineau", confiance: "HAUTE", note: "" },
  "QBFL|Lasalle Warriors": { db: "Warriors de LaSalle", confiance: "HAUTE", note: "" },
  "QBFL|Laval Bulldogs": { db: "Bulldogs de Laval", confiance: "HAUTE", note: "" },
  "QBFL|North Shore Lions": { db: null, confiance: "AMBIGU", note: "North Shore = une organisation, 3 équipes selon l'âge (Lions bantam / Mustangs midget / Broncos junior). La DB a « Lions du Lac St-Louis » ET « North Shore Broncos » comme DEUX clubs séparés — à fusionner ou à garder distincts, arbitrage BP." },
  "QBFL|St. Laurent Spartans": { db: "Spartans de Saint-Laurent", confiance: "HAUTE", note: "" },
  "QBFL|St. Leonard Cougars": { db: "Cougars de Saint-Léonard", confiance: "HAUTE", note: "" },
  "QBFL|Sun Youth Hornets": { db: "Hornets de Sun Youth", confiance: "HAUTE", note: "homonyme : « Hornets de la Rive-Sud » est un AUTRE club" },
  "QBFL|Lakeshore Cougars": { db: "Cougars de Lakeshore", confiance: "HAUTE", note: "saisons passées" },
  "QBFL|Chateauguay Raiders": { db: "Raiders de Chateauguay", confiance: "HAUTE", note: "saisons passées" },
  "QBFL|St-Lazare Stallions": { db: "Stallions de Saint-Lazare", confiance: "HAUTE", note: "saisons passées ; MÊME club qu'en LFMM" },
  "QBFL|Warriors de Lasalle": { db: "Warriors de LaSalle", confiance: "HAUTE", note: "graphie alternative de la même équipe" },
  "QBFL|St-Leonard Cougars": { db: "Cougars de Saint-Léonard", confiance: "HAUTE", note: "graphie alternative" },
  "QBFL|St-Laurent Spartans": { db: "Spartans de Saint-Laurent", confiance: "HAUTE", note: "graphie alternative" },

  "QMFL|Gatineau Vikings": { db: "Vikings de Gatineau", confiance: "HAUTE", note: "MÊME club qu'en QBFL" },
  "QMFL|LaSalle Warriors": { db: "Warriors de LaSalle", confiance: "HAUTE", note: "MÊME club qu'en QBFL" },
  "QMFL|Lasalle Warriors": { db: "Warriors de LaSalle", confiance: "HAUTE", note: "graphie alternative" },
  "QMFL|Warriors de Lasalle": { db: "Warriors de LaSalle", confiance: "HAUTE", note: "graphie alternative" },
  "QMFL|Laval Bulldogs": { db: "Bulldogs de Laval", confiance: "HAUTE", note: "MÊME club qu'en QBFL" },
  "QMFL|St. Laurent Spartans": { db: "Spartans de Saint-Laurent", confiance: "HAUTE", note: "" },
  "QMFL|St. Leonard Cougars": { db: "Cougars de Saint-Léonard", confiance: "HAUTE", note: "" },
  "QMFL|St Leonard Cougars": { db: "Cougars de Saint-Léonard", confiance: "HAUTE", note: "graphie alternative" },
  "QMFL|Sun Youth Hornets": { db: "Hornets de Sun Youth", confiance: "HAUTE", note: "" },
  "QMFL|Lakeshore Cougars": { db: "Cougars de Lakeshore", confiance: "HAUTE", note: "saisons passées" },
  "QMFL|North Shore Mustangs": { db: null, confiance: "AMBIGU", note: "même organisation North Shore que Lions/Broncos ; aucun club « Mustangs » en DB" },
  "QMFL|Bel Air Norsemen": { db: null, confiance: "—", note: "absent de la DB (belairfootball.club)" },
  "QMFL|Kanata Knights": { db: null, confiance: "—", note: "club ONTARIEN — hors périmètre RSEQ, décision d'inclusion à prendre" },
  "QMFL|Myers Riders": { db: null, confiance: "—", note: "club ONTARIEN (Ottawa) ; ne pas confondre avec « Ottawa Junior Riders Football » présent en DB" },
  "QMFL|North Gloucester Giants": { db: null, confiance: "—", note: "club ONTARIEN" },
  "QMFL|Orleans Raftsmen": { db: null, confiance: "—", note: "club ONTARIEN" },
  "QMFL|Test 1": { db: null, confiance: "IGNORER", note: "équipe bidon laissée dans la plateforme" },
  "QMFL|Test 2": { db: null, confiance: "IGNORER", note: "équipe bidon laissée dans la plateforme" },

  "QMJFL|Les Loups du Nord": { db: "Nos Jeunes à Cœur / Loups du Nord", confiance: "HAUTE", note: "" },
  "QMJFL|North Shore Broncos": { db: "North Shore Broncos", confiance: "HAUTE", note: "" },
  "QMJFL|South Shore Jr Packers": { db: "South Shore Jr Packers", confiance: "HAUTE", note: "homonyme des Packers de Greenfield (LFMM)" },
  "QMJFL|Wildcats ARFLL": { db: "Wildcats Laurentides-Lanaudière", confiance: "HAUTE", note: "MÊME club que « Wildcats » en LFMM" },
  "QMJFL|Ottawa JR Riders": { db: "Ottawa Junior Riders Football", confiance: "HAUTE", note: "club ontarien déjà présent en DB" },
};

/**
 * Équipes civiles football DÉJÀ en base (public.teams × schools LIGUE_CIVILE
 * × sports.nom ilike 'football'), instantané 2026-08-13. Il n'y en a que 2.
 */
const DB_TEAMS = [
  {
    id: "090e0ce0-b44c-4ec8-84b1-eaf9e7a26266",
    club: "Wildcats Laurentides-Lanaudière",
    name: "Wildcats Laurentides-Lanaudière Midget D1",
    age_group: "Midget",
    division: "Division 1",
    gender: "Masculin",
    season: "2025-2026",
    league: null,
  },
  {
    id: "30a35d43-3751-4d21-9478-13967dff7bf3",
    club: "Nexus Civil",
    name: "Nexus",
    age_group: "Midget",
    division: "AAA",
    gender: "Masculin",
    season: "2025-2026",
    league: null,
    note: "fixture de démo, sans source réelle",
  },
];

// --------------------------------------------------------------------------
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Une équipe DB correspond-elle à l'équipe source ? (catégorie + division) */
function matchDbTeam(clubDb, categorie, division) {
  if (!clubDb) return null;
  const cat = norm(categorie);
  const div = norm(division);
  return (
    DB_TEAMS.find(
      (t) =>
        t.club === clubDb &&
        cat.includes(norm(t.age_group)) &&
        (div.includes(norm(t.division)) || norm(t.division).includes(div.replace(/^.*division\s*/, "division "))),
    ) ?? null
  );
}

function statutFor(entry, dbTeam) {
  if (!entry) return { statut: "ABSENT", confiance: "—" };
  if (entry.confiance === "IGNORER") return { statut: "IGNORER", confiance: "—" };
  if (dbTeam) return { statut: `MATCHÉ (${dbTeam.id})`, confiance: entry.confiance };
  if (entry.confiance === "AMBIGU") return { statut: "AMBIGU", confiance: "AMBIGU" };
  if (entry.db) return { statut: "ABSENT (club en DB)", confiance: entry.confiance };
  return { statut: "ABSENT (club aussi)", confiance: "—" };
}

async function main() {
  const lfmm = JSON.parse(await readFile(path.join(DATA, "civil_football_lfmm.json"), "utf8"));
  const ls = JSON.parse(await readFile(path.join(DATA, "civil_football_leaguesuite.json"), "utf8"));

  const rows = [];

  for (const t of lfmm.equipes) {
    const entry = MAPPING[`LFMM|${t.club}`];
    const dbTeam = matchDbTeam(entry?.db, t.categorie, t.division);
    const { statut, confiance } = statutFor(entry, dbTeam);
    rows.push({
      ligue: "LFMM",
      sport: /^FLAG/i.test(t.categorie ?? "") ? "Flag football" : "Football",
      club_source: t.club,
      club_db: entry?.db ?? "",
      equipe: t.equipe_nom,
      categorie: t.categorie ?? "",
      division: t.division ?? "",
      saison: lfmm.saison_courante ?? "",
      id_technique: `node=${t.node_id}`,
      statut,
      confiance,
      note: entry?.note ?? "club source non mappé",
    });
  }

  for (const l of ls.ligues) {
    const curLabel = l.saisons?.find((s) => s.id === l.contexte?.saison_courante_id)?.label;
    for (const t of l.equipes.filter((e) => e.saison === curLabel)) {
      const entry = MAPPING[`${l.ligue}|${t.equipe_nom}`];
      const dbTeam = matchDbTeam(entry?.db, t.categorie, t.division);
      const { statut, confiance } = statutFor(entry, dbTeam);
      rows.push({
        ligue: l.ligue,
        sport: "Football",
        club_source: t.equipe_nom,
        club_db: entry?.db ?? "",
        equipe: t.equipe_nom,
        categorie: t.categorie ?? "",
        division: t.division ?? "",
        saison: t.saison ?? "",
        id_technique: `team=${t.team_id} setup_team=${t.setup_team_id ?? "—"} setup_div=${t.setup_division_id ?? "—"}`,
        statut,
        confiance,
        note: entry?.note ?? "club source non mappé",
      });
    }
  }

  // ------------------------------------------------------------- rapport --
  const parLigue = {};
  for (const r of rows) {
    const k = r.ligue;
    parLigue[k] ??= { equipes: 0, clubs: new Set(), matche: 0, ambigu: 0, absent: 0, ignore: 0, clubsEnDb: new Set(), clubsAbsents: new Set() };
    const p = parLigue[k];
    p.equipes++;
    p.clubs.add(r.club_source);
    if (r.statut.startsWith("MATCHÉ")) p.matche++;
    else if (r.statut === "AMBIGU") p.ambigu++;
    else if (r.statut === "IGNORER") p.ignore++;
    else p.absent++;
    if (r.club_db) p.clubsEnDb.add(r.club_db);
    else if (r.statut !== "IGNORER") p.clubsAbsents.add(r.club_source);
  }

  console.log("RÉSUMÉ PAR LIGUE (grain ÉQUIPE)\n");
  for (const [lig, p] of Object.entries(parLigue)) {
    console.log(
      `${lig.padEnd(6)} ${String(p.equipes).padStart(3)} équipes / ${String(p.clubs.size).padStart(2)} clubs source ` +
        `-> matché ${p.matche} | ambigu ${p.ambigu} | absent ${p.absent} | ignoré ${p.ignore}`,
    );
    console.log(`       clubs déjà en DB (${p.clubsEnDb.size}) : ${[...p.clubsEnDb].join(", ") || "—"}`);
    console.log(`       clubs SANS correspondance (${p.clubsAbsents.size}) : ${[...p.clubsAbsents].join(", ") || "—"}`);
  }

  // ---------------------------------------------------------------- CSV --
  const cols = ["ligue", "sport", "club_source", "club_db", "equipe", "categorie", "division", "saison", "id_technique", "statut", "confiance", "note"];
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  await mkdir(DATA, { recursive: true });
  await writeFile(path.join(DATA, "civil_football_matching.csv"), "﻿" + csv, "utf8");

  // ----------------------------------------------------------------- MD --
  const md = [
    "| Ligue | Club | Équipe (catégorie/division) | En DB ? | Confiance | Note |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.ligue} | ${r.club_db || r.club_source} | ${r.equipe} — ${r.categorie}${r.division ? " / " + r.division : ""} | ${r.statut} | ${r.confiance} | ${r.note} |`,
    ),
  ].join("\n");
  await writeFile(path.join(DATA, "civil_football_matching.md"), md, "utf8");

  console.log(`\n${rows.length} lignes -> ${path.join(DATA, "civil_football_matching.csv")} + .md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
