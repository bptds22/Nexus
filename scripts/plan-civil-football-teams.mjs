// scripts/plan-civil-football-teams.mjs
// ============================================================================
// PLAN d'insertion des 103 équipes tackle — GÉNÈRE DU TEXTE, n'applique RIEN.
// Aucune connexion DB, aucune écriture : lit les JSON de découverte et écrit
// un fichier .sql à relire.
//
// Décisions BP appliquées ici :
//   gender = 'Masculin' sur les 103 (un NULL désarmerait la contrainte à 8
//     colonnes : Postgres traite deux NULL comme distincts dans un UNIQUE)
//   season = '2026-2027' — la MÊME chaîne que games, car les pages d'équipe
//     joignent en égalité stricte (loadForRender.ts:78, teamEditorContext:213)
//   league = le sigle de la ligue — champ AFFICHÉ (teamLabel.ts:59)
//   Cougars LFMM -> Lakeshore ; Titans ET Dorchesters -> AFCSJ
//   North Shore = un club, trois équipes (Lions/Mustangs/Broncos)
//   homonymes au nom complet : Packers de Greenfield / Packers de South Shore
//   ignorés : les 67 flag, Ottawa JR Riders, Test 1, Test 2
//
// Run:  node scripts/plan-civil-football-teams.mjs
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "import");
const J = async (f) => JSON.parse(await readFile(path.join(DATA, f), "utf8"));
const OUT = path.join(DATA, "civil_football_teams_insert.sql");

const SPORT_FOOTBALL = "4b859bf1-5832-4258-897c-e094062926af";
const SAISON = "2026-2027";
const GENRE = "Masculin";

// club source -> { id: uuid existant } | { creer: {...} }
const CLUBS = {
  // ---- LFMM (racine du libellé) ----
  "LFMM|Rhinos":      { id: "e68d56ee-e30f-4110-b099-e5b52834aa8c", nom: "Rhinos de Lanaudière" },
  "LFMM|Barons":      { id: "ac957b4c-755c-45dc-9259-18303ce1ff46", nom: "Barons de Saint-Bruno" },
  "LFMM|Diablos":     { id: "7f666c65-1359-4a70-8bde-6159e3dc24fc", nom: "Diablos de LaPrairie" },
  "LFMM|Grizzlis":    { id: "fd67d012-e41f-4c68-a139-4a7f7733b89f", nom: "Grizzlis de Boucherville" },
  "LFMM|Vikings":     { id: "1987b42b-7e35-4350-bc88-ab79105d24a7", nom: "Vikings de Laval-Nord" },
  "LFMM|Pirates":     { id: "90848174-5dfd-4fdb-8480-fed92e008d8e", nom: "Pirates du Richelieu" },
  "LFMM|Vandoos":     { id: "9daed387-05d1-4edb-8b28-c2fe4938bf7a", nom: "Vandoos de Drummondville" },
  "LFMM|Packers":     { id: "841c50d6-0873-4a40-8931-a3fac3e61550", nom: "Packers de Greenfield" },
  "LFMM|Vicas":       { id: "2bc5a69e-5ac3-4257-ad24-0f3d15709422", nom: "Vicas de Victoriaville" },
  "LFMM|Patriotes":   { id: "14ee7e89-3283-4f63-b8db-d3f81d296615", nom: "Patriotes de l'Ouest" },
  "LFMM|Stallions":   { id: "e31cdd72-7762-4c23-9891-4197303a61c2", nom: "Stallions de Saint-Lazare" },
  "LFMM|Wildcats":    { id: "d4b92629-fd48-44be-b2d6-faa56aea0e49", nom: "Wildcats Laurentides-Lanaudière" },
  "LFMM|Cougars":     { id: "cef6aeba-b028-489f-bfc4-41a0f8ff9ab4", nom: "Cougars de Lakeshore" },
  "LFMM|Titans":      { id: "ea538b7e-fb6a-4fe1-a31a-520429918c8c", nom: "AFCSJ", renommer: "Football civil de Saint-Jean-sur-Richelieu (AFCSJ)" },
  "LFMM|Dorchesters": { id: "ea538b7e-fb6a-4fe1-a31a-520429918c8c", nom: "AFCSJ", renommer: "Football civil de Saint-Jean-sur-Richelieu (AFCSJ)" },

  // ---- QBFL ----
  "QBFL|Gatineau Vikings":      { id: "96d9c81d-13cc-43f0-ac4c-c33c7c0012fc", nom: "Vikings de Gatineau" },
  "QBFL|Lasalle Warriors":      { id: "20f94a7b-529a-426a-8c96-f7509e10db28", nom: "Warriors de LaSalle" },
  "QBFL|Laval Bulldogs":        { id: "effd8a0c-cb55-4756-958d-e72be78a4320", nom: "Bulldogs de Laval" },
  "QBFL|North Shore Lions":     { id: "6e2937eb-4c52-4fc7-9353-c8516ef94d01", nom: "North Shore" },
  "QBFL|St. Laurent Spartans":  { id: "479ca71a-4405-426a-be72-04ae16a10b35", nom: "Spartans de Saint-Laurent" },
  "QBFL|St. Leonard Cougars":   { id: "aff4fe61-9c05-4e15-8ef8-5ff1c093f200", nom: "Cougars de Saint-Léonard" },
  "QBFL|Sun Youth Hornets":     { id: "6bdf59f4-1b40-4f41-8cb4-04112d138603", nom: "Hornets de Sun Youth" },

  // ---- QMFL ----
  "QMFL|Gatineau Vikings":         { id: "96d9c81d-13cc-43f0-ac4c-c33c7c0012fc", nom: "Vikings de Gatineau" },
  "QMFL|LaSalle Warriors":         { id: "20f94a7b-529a-426a-8c96-f7509e10db28", nom: "Warriors de LaSalle" },
  "QMFL|Laval Bulldogs":           { id: "effd8a0c-cb55-4756-958d-e72be78a4320", nom: "Bulldogs de Laval" },
  "QMFL|St. Laurent Spartans":     { id: "479ca71a-4405-426a-be72-04ae16a10b35", nom: "Spartans de Saint-Laurent" },
  "QMFL|St. Leonard Cougars":      { id: "aff4fe61-9c05-4e15-8ef8-5ff1c093f200", nom: "Cougars de Saint-Léonard" },
  "QMFL|Sun Youth Hornets":        { id: "6bdf59f4-1b40-4f41-8cb4-04112d138603", nom: "Hornets de Sun Youth" },
  "QMFL|North Shore Mustangs":     { id: "6e2937eb-4c52-4fc7-9353-c8516ef94d01", nom: "North Shore" },
  "QMFL|Bel Air Norsemen":         { creer: { nom: "Bel Air Norsemen", region: "Rive-Sud", site: "https://belairfootball.club/" } },
  "QMFL|Kanata Knights":           { creer: { nom: "Kanata Knights", region: "Ontario", site: "https://kanataknights.ca/" } },
  "QMFL|Myers Riders":             { creer: { nom: "Myers Riders", region: "Ontario", site: "https://myersriders.ca/" } },
  "QMFL|North Gloucester Giants":  { creer: { nom: "North Gloucester Giants", region: "Ontario", site: "https://nggiants.com/northgloucestergiants/" } },
  "QMFL|Orleans Raftsmen":         { creer: { nom: "Orleans Raftsmen", region: "Ontario", site: "https://www.orleansminorfootball.ca/orleansminorfootball/" } },

  // ---- QMJFL ----
  "QMJFL|Les Loups du Nord":      { id: "029fa52e-9de3-4ad2-9d29-d65addb481d8", nom: "Nos Jeunes à Cœur / Loups du Nord" },
  "QMJFL|North Shore Broncos":    { id: "6e2937eb-4c52-4fc7-9353-c8516ef94d01", nom: "North Shore" },
  "QMJFL|South Shore Jr Packers": { id: "6a67ae8e-7c74-42f9-92e4-fa361f00552e", nom: "Packers de South Shore", renommer: "Packers de South Shore" },
  "QMJFL|Wildcats ARFLL":         { id: "d4b92629-fd48-44be-b2d6-faa56aea0e49", nom: "Wildcats Laurentides-Lanaudière" },
};

// catégorie source -> age_group en base (valeurs déjà présentes quand possible)
const AGE = {
  "ATOME": "Atome", "MOUSTIQUE": "Moustique", "PEE-WEE": "Pee-Wee",
  "BANTAM AAA": "Bantam", "MIDGET AAA": "Midget",
  "Bantam AAA": "Bantam", "Midget AAA": "Midget", "Junior Major": "Junior",
};

// division source -> division en base. JAMAIS NULL : un NULL désarmerait la
// contrainte à 8 colonnes exactement comme un gender NULL.
// Attention : seul le tiret SÉPARATEUR (entouré d'espaces) devient un cadratin.
// Un `\s*-\s*` global couperait « PEE-WEE » en « Pee — Wee ».
const titre = (s) =>
  s.toLowerCase()
    .replace(/\s+-\s+/g, " — ")
    .replace(/(^|[\s—-])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\bAaa\b/g, "AAA")
    .replace(/\s+/g, " ")
    .trim();
const DIV_LS = { QBFL: "AAA", QMFL: "AAA", QMJFL: "Majeur" };

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

async function main() {
  const rows = [];

  const lfmm = await J("civil_football_lfmm.json");
  for (const t of lfmm.equipes.filter((e) => !/^FLAG/i.test(e.categorie ?? ""))) {
    rows.push({
      ligue: "LFMM", club_source: t.club, nom: t.equipe_nom,
      age_group: AGE[t.categorie] ?? null, division: titre(t.division),
      categorie_source: t.categorie, division_source: t.division, ref: `node ${t.node_id}`,
    });
  }

  const ls = await J("civil_football_leaguesuite.json");
  const IGNORER = new Set(["Test 1", "Test 2", "Ottawa JR Riders"]);
  for (const l of ls.ligues) {
    const label = l.saisons?.find((s) => s.id === l.contexte?.saison_courante_id)?.label;
    for (const e of l.equipes) {
      if (e.saison !== label || IGNORER.has(e.equipe_nom) || e.setup_division_id == null) continue;
      rows.push({
        ligue: l.ligue, club_source: e.equipe_nom, nom: e.equipe_nom,
        age_group: AGE[e.categorie] ?? null, division: DIV_LS[l.ligue],
        categorie_source: e.categorie, division_source: e.division,
        ref: `team_id ${e.team_id} · setup_team ${e.setup_team_id}`,
      });
    }
  }

  // --------------------------------------------------------------- contrôles
  const sansAge = rows.filter((r) => !r.age_group);
  const sansClub = rows.filter((r) => !CLUBS[`${r.ligue}|${r.club_source}`]);
  const sansDiv = rows.filter((r) => !r.division);
  if (sansAge.length || sansClub.length || sansDiv.length) {
    console.error("PLAN INCOMPLET :");
    for (const r of sansAge) console.error(`  age_group manquant : ${r.ligue} ${r.nom} (${r.categorie_source})`);
    for (const r of sansClub) console.error(`  club non mappé    : ${r.ligue} | ${r.club_source}`);
    for (const r of sansDiv) console.error(`  division vide     : ${r.ligue} ${r.nom}`);
    process.exit(1);
  }

  // clé à 8 colonnes, simulée
  const cles = new Map();
  for (const r of rows) {
    const c = CLUBS[`${r.ligue}|${r.club_source}`];
    const clubKey = c.id ?? `NOUVEAU:${c.creer.nom}`;
    const k = [clubKey, SPORT_FOOTBALL, r.nom, r.age_group, r.division, GENRE, SAISON, r.ligue].join("␟");
    if (!cles.has(k)) cles.set(k, []);
    cles.get(k).push(r);
  }
  const collisions = [...cles.entries()].filter(([, v]) => v.length > 1);

  // ------------------------------------------------------------------ compte
  const existants = new Map(), aCreer = new Map(), aRenommer = new Map();
  for (const r of rows) {
    const c = CLUBS[`${r.ligue}|${r.club_source}`];
    if (c.id) { existants.set(c.id, c.nom); if (c.renommer) aRenommer.set(c.id, c.renommer); }
    else aCreer.set(c.creer.nom, c.creer);
  }

  console.log(`ÉQUIPES À INSÉRER : ${rows.length}`);
  const parLigue = {};
  for (const r of rows) parLigue[r.ligue] = (parLigue[r.ligue] || 0) + 1;
  console.log(`  ${JSON.stringify(parLigue)}`);
  console.log(`\nCLUBS EXISTANTS réutilisés : ${existants.size}`);
  for (const [id, nom] of [...existants].sort((a, b) => a[1].localeCompare(b[1], "fr"))) console.log(`   ${nom}  (${id})`);
  console.log(`\nCLUBS À CRÉER : ${aCreer.size}`);
  for (const c of aCreer.values()) console.log(`   ${c.nom}  [${c.region}]  ${c.site}`);
  console.log(`\nCLUBS À RENOMMER : ${aRenommer.size}`);
  for (const [id, n] of aRenommer) console.log(`   ${id} -> « ${n} »`);
  console.log(`\nCOLLISIONS sur la clé à 8 colonnes : ${collisions.length}`);
  for (const [k, v] of collisions) console.log(`   ✗ ${k}\n     ${v.map((x) => x.nom).join(" / ")}`);
  const ages = [...new Set(rows.map((r) => r.age_group))].sort();
  console.log(`\nage_group utilisés : ${ages.join(", ")}`);

  // -------------------------------------------------------------------- SQL
  const L = [];
  L.push("-- ============================================================================");
  L.push(`-- Football civil — LOT 1 (TACKLE) : ${rows.length} équipes, saison 2026-2027`);
  L.push("-- TEXTE À RELIRE — NE PAS APPLIQUER SANS GO.");
  L.push("--");
  L.push("-- gender 'Masculin' explicite partout : un NULL désarmerait");
  L.push("-- teams_identity_unique (Postgres traite deux NULL comme distincts).");
  L.push("-- season '2026-2027' : MÊME chaîne que games — les pages d'équipe");
  L.push("-- joignent en égalité stricte sur cette colonne.");
  L.push("-- league : sigle affiché à l'athlète via teamLabel.ts, pas un identifiant.");
  L.push("-- ============================================================================");
  L.push("");
  L.push("BEGIN;");
  L.push("");
  L.push("-- 1. corrections de nom sur des clubs existants -----------------------------");
  for (const [id, nom] of aRenommer) {
    L.push(`UPDATE public.schools SET name = ${q(nom)}, updated_at = now() WHERE id = '${id}';`);
  }
  L.push("");
  L.push("-- 2. les clubs absents de la base -------------------------------------------");
  for (const c of aCreer.values()) {
    L.push(`INSERT INTO public.schools (name, type, region, website)`);
    L.push(`VALUES (${q(c.nom)}, 'LIGUE_CIVILE', ${q(c.region)}, ${q(c.site)});`);
  }
  L.push("");
  L.push(`-- 3. les ${rows.length} équipes ------------------------------------------------------`);
  L.push("INSERT INTO public.teams (school_id, sport_id, name, age_group, division, gender, season, league, is_active)");
  L.push("VALUES");
  // La virgule se pose AVANT le commentaire de fin de ligne : la mettre après
  // la commenterait, et la liste VALUES perdrait ses séparateurs.
  const vals = rows.map((r, i) => {
    const c = CLUBS[`${r.ligue}|${r.club_source}`];
    const club = c.id
      ? `'${c.id}'`
      : `(SELECT id FROM public.schools WHERE name = ${q(c.creer.nom)} AND type = 'LIGUE_CIVILE')`;
    const tuple = `  (${club}, '${SPORT_FOOTBALL}', ${q(r.nom)}, ${q(r.age_group)}, ${q(r.division)}, ${q(GENRE)}, ${q(SAISON)}, ${q(r.ligue)}, true)`;
    const fin = i === rows.length - 1 ? ";" : ",";
    return `${tuple}${fin}  -- ${r.ligue} · ${r.categorie_source} · ${r.division_source} · ${r.ref}`;
  });
  L.push(vals.join("\n"));
  L.push("");
  L.push("COMMIT;");
  L.push("");

  await writeFile(OUT, L.join("\n"), "utf8");
  console.log(`\n--> ${OUT}  (${rows.length} lignes VALUES)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
