// scripts/plan-civil-football-games.mjs
// ============================================================================
// Génère l'INSERT des 446 matchs — un fichier .sql par ligue. N'APPLIQUE RIEN.
//
// RÉSOLUTION DES FK. Les identifiants d'équipe ne sont JAMAIS écrits en dur et
// JAMAIS résolus par similarité de nom : l'INSERT porte une jointure sur
// `teams` selon la règle prouvée sur les 446 matchs —
//     (league, season, sport_id, age_group, division) + name EXACT
// Le libellé d'un match et le `teams.name` viennent de la même page du même
// site : à périmètre égal, l'égalité est exacte. Les JOIN sont des INNER JOIN,
// donc toute ligne non résolue DISPARAÎT — d'où le contrôle de compte
// obligatoire après application.
//
// Colonnes constantes (décisions BP) : season '2026-2027' (MÊME chaîne que
// teams — les pages d'équipe joignent en égalité stricte), phase 'regular',
// sector NULL, sex_type 'Masculin', sport 'Football', tout le terrain dans
// `venue`, rien dans `field_number`, `rseq_game_id` laissé NULL (c'est ce qui
// fait basculer la ligne sous l'index d'identité civile).
//
// Run:  node scripts/plan-civil-football-games.mjs
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "import");
const J = async (f) => JSON.parse(await readFile(path.join(DATA, f), "utf8"));

const SPORT = "4b859bf1-5832-4258-897c-e094062926af";
const SAISON = "2026-2027";

const AGE = {
  "ATOME": "Atome", "MOUSTIQUE": "Moustique", "PEE-WEE": "Pee-Wee",
  "BANTAM AAA": "Bantam", "MIDGET AAA": "Midget",
  "Bantam AAA": "Bantam", "Midget AAA": "Midget", "Junior Major": "Junior",
};
// identique au générateur d'équipes : seul le tiret SÉPARATEUR devient cadratin
const titre = (s) =>
  s.toLowerCase()
    .replace(/\s+-\s+/g, " — ")
    .replace(/(^|[\s—-])([a-zà-ÿ])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\bAaa\b/g, "AAA")
    .replace(/\s+/g, " ")
    .trim();
const DIV_LS = { QBFL: "AAA", QMFL: "AAA", QMJFL: "Majeur" };

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? "NULL" : String(v));

function sql(ligue, rows) {
  const L = [];
  L.push(`WITH src(age_group, division, game_date, game_time, home_name, visitor_name, venue, home_score, visitor_score) AS (`);
  L.push(`VALUES`);
  L.push(
    rows.map((r, i) =>
      `  (${q(r.age_group)},${q(r.division)},${q(r.date)}::date,${q(r.heure)},${q(r.local)},${q(r.visiteur)},${q(r.terrain)},${n(r.ps_local)}::int,${n(r.ps_visiteur)}::int)${i === rows.length - 1 ? "" : ","}`,
    ).join("\n"),
  );
  L.push(`)`);
  L.push(`INSERT INTO public.games (`);
  L.push(`  season, phase, sector, game_date, game_time,`);
  L.push(`  home_team_id, visitor_team_id, home_name_raw, visitor_name_raw,`);
  L.push(`  home_score, visitor_score, is_played, venue,`);
  L.push(`  league_name, sport, division, category, sex_type`);
  L.push(`)`);
  L.push(`SELECT`);
  L.push(`  '${SAISON}', 'regular', NULL, s.game_date, s.game_time,`);
  L.push(`  th.id, tv.id, s.home_name, s.visitor_name,`);
  L.push(`  s.home_score, s.visitor_score,`);
  L.push(`  (s.home_score IS NOT NULL AND s.visitor_score IS NOT NULL), s.venue,`);
  L.push(`  '${ligue}', 'Football', s.division, s.age_group, 'Masculin'`);
  L.push(`FROM src s`);
  for (const [alias, col] of [["th", "home_name"], ["tv", "visitor_name"]]) {
    L.push(`JOIN public.teams ${alias}`);
    L.push(`  ON ${alias}.league = '${ligue}' AND ${alias}.season = '${SAISON}'`);
    L.push(` AND ${alias}.sport_id = '${SPORT}'`);
    L.push(` AND ${alias}.age_group = s.age_group AND ${alias}.division = s.division`);
    L.push(` AND ${alias}.name = s.${col}`);
  }
  L.push(`;`);
  return L.join("\n");
}

async function main() {
  const sorties = [];

  // ---- LFMM ---------------------------------------------------------------
  const lfmm = await J("civil_football_games_lfmm.json");
  const rl = lfmm.matchs.map((g) => ({
    age_group: AGE[g.categorie], division: titre(g.division),
    date: g.date, heure: (g.heure ?? "").trim() || null,
    local: g.equipe_locale, visiteur: g.equipe_visiteuse, terrain: g.terrain,
    ps_local: g.pointage_local, ps_visiteur: g.pointage_visiteur,
  }));
  sorties.push(["LFMM", rl]);

  // ---- LeagueSuite --------------------------------------------------------
  for (const [key, ligue] of [["qmfl", "QMFL"], ["qbfl", "QBFL"], ["qmjfl", "QMJFL"]]) {
    const d = await J(`civil_football_games_${key}.json`);
    sorties.push([ligue, d.matchs.map((g) => ({
      age_group: AGE[g.categorie], division: DIV_LS[ligue],
      date: g.date, heure: (g.heure ?? "").trim() || null,
      local: g.equipe_locale, visiteur: g.equipe_visiteuse, terrain: g.terrain,
      ps_local: g.pointage_local, ps_visiteur: g.pointage_visiteur,
    }))]);
  }

  let total = 0;
  for (const [ligue, rows] of sorties) {
    const manquants = rows.filter((r) => !r.age_group || !r.division || !r.date || !r.local || !r.visiteur);
    if (manquants.length) {
      console.error(`${ligue} : ${manquants.length} ligne(s) incomplète(s) — ARRÊT`);
      console.error(JSON.stringify(manquants.slice(0, 5), null, 2));
      process.exit(1);
    }
    const f = path.join(DATA, `civil_football_games_insert_${ligue.toLowerCase()}.sql`);
    const texte = sql(ligue, rows);
    await writeFile(f, texte, "utf8");
    total += rows.length;
    console.log(`${ligue.padEnd(6)} ${String(rows.length).padStart(3)} matchs · ${Math.round(Buffer.byteLength(texte, "utf8") / 1024)} Ko · joués ${rows.filter((r) => r.ps_local != null).length}`);
  }
  console.log(`\nTOTAL ${total} matchs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
