// generer-reparation.mjs <cotes.json> <sortie-prefixe>
// Réparation UNIQUE des côtés de match incohérents : games.*_rseq_team_id ≠ teams.rseq_team_id de l'équipe reliée.
// Entrée : la liste relevée en base (requête lister-incoherents.sql, lecture seule), au format JSON.
// Pour chaque match, lit la valeur que le RSEQ sert AUJOURD'HUI (GetLeagueDiffusion sur s1, 800 ms entre appels,
// User-Agent Nexus-Veille) et classe chaque côté :
//   a) servi, et le RSEQ sert l'équipe déjà reliée  -> réaligner *_rseq_team_id sur la valeur servie (SEULE écriture) ;
//   b) servi, mais le RSEQ sert une AUTRE équipe     -> LISTÉ, rien écrit (toucher *_team_id exige BP) ;
//   c) match plus servi par le RSEQ                  -> LISTÉ, rien écrit.
// Sorties : <prefixe>.sql (transaction gardée, nombre exact, admin_operations), <prefixe>.rollback.sql,
//           <prefixe>.liste.csv (les trois catégories, pour BP). Aucune écriture : ce script produit du SQL.
import fs from 'fs';
const [, , entree, prefixe] = process.argv;
const cotes = JSON.parse(fs.readFileSync(entree, 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; Nexus-Veille/1.0; reparation unique pour nexussports.ca)', 'Accept-Language': 'fr-CA,fr;q=0.9' };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
const servis = new Map(); // rseq_game_id -> { home, visitor }
let dernier = 0;
for (const ligue of [...new Set(cotes.map((c) => c.rseq_league_id))]) {
  const attente = dernier + 800 - Date.now(); if (attente > 0) await dodo(attente);
  dernier = Date.now();
  const r = await fetch('https://s1.rseq.ca/api/LeagueApi/GetLeagueDiffusion/?leagueId=' + ligue, { headers: UA });
  dernier = Date.now();
  if (!r.ok) { console.error('ligue', ligue, 'HTTP', r.status); continue; }
  const j = await r.json();
  for (const k of ['RegularSeasonGames', 'PostSeasonGames', 'PreSeasonGames', 'ChampionshipGames']) {
    for (const g of j[k] || []) if (g.GameId) servis.set(String(g.GameId).toLowerCase(), { home: g.HomeTeamId ?? null, visitor: g.VisitingTeamId ?? null });
  }
}
const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const lignes = cotes.map((c) => {
  const s = servis.get(String(c.rseq_game_id).toLowerCase());
  const servi = s ? (c.cote === 'home' ? s.home : s.visitor) : undefined;
  const cat = !s ? 'c_plus_servi' : (String(servi).toLowerCase() === String(c.team_rseq).toLowerCase() ? 'a_realigner' : 'b_autre_equipe_servie');
  return { ...c, servi: servi ?? null, categorie: cat };
});
const a = lignes.filter((l) => l.categorie === 'a_realigner');
fs.writeFileSync(prefixe + '.liste.csv', 'categorie;game_id;cote;rseq_game_id;ligue;nom_servi;equipe_reliee;team_id;rseq_colonne;rseq_equipe_reliee;rseq_servi\n'
  + lignes.map((l) => [l.categorie, l.game_id, l.cote, l.rseq_game_id, l.league_name, l.nom_raw, l.team_name, l.team_id, l.rseq_colonne, l.team_rseq, l.servi ?? ''].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n') + '\n');
const valeurs = a.map((l) => `      (${q(l.game_id)}::uuid, ${q(l.cote)}, ${q(l.rseq_colonne)}::uuid, ${q(l.servi)}::uuid, ${q(l.team_id)}::uuid)`).join(',\n');
const vide = a.length === 0;
const cte = vide ? '' : `with v(game_id, cote, ancien, nouveau, team_id) as (values\n${valeurs})`;
const sql = `-- Réparation UNIQUE des identifiants RSEQ de côtés de match (générée le ${new Date().toISOString()}).
-- Ne réécrit QUE games.home_rseq_team_id / visitor_rseq_team_id, sur la valeur que le RSEQ sert aujourd'hui, et
-- seulement là où cette valeur est déjà celle de l'équipe reliée (catégorie a). Aucun *_team_id n'est touché.
-- Catégories b et c : listées dans ${prefixe.split(/[\\/]/).pop()}.liste.csv, rien écrit.
-- Transaction gardée : exactement ${a.length} côté(s) réaligné(s) et 1 ligne admin_operations, sinon RIEN.
do $$
declare v_bp uuid; n_att constant int := ${a.length}; n_h int := 0; n_v int := 0; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  select count(*) into n_ops0 from public.admin_operations;
${vide ? '' : `  ${cte}, u as (
    update public.games g set home_rseq_team_id = v.nouveau
      from v where v.cote = 'home' and g.id = v.game_id
       and g.home_rseq_team_id is not distinct from v.ancien and g.home_team_id = v.team_id
    returning 1)
  select count(*) into n_h from u;
  ${cte}, u as (
    update public.games g set visitor_rseq_team_id = v.nouveau
      from v where v.cote = 'visitor' and g.id = v.game_id
       and g.visitor_rseq_team_id is not distinct from v.ancien and g.visitor_team_id = v.team_id
    returning 1)
  select count(*) into n_v from u;`}
  insert into public.admin_operations (operation, motif, details, par)
  values ('REPARATION_RSEQ_IDS_COTES', 'Réalignement unique de games.*_rseq_team_id sur la valeur servie par le RSEQ (équipe reliée inchangée)',
          jsonb_build_object('cotes', n_h + n_v, 'domicile', n_h, 'visiteur', n_v,
            'listes_non_touchees', jsonb_build_object('b_autre_equipe_servie', ${lignes.filter((l) => l.categorie === 'b_autre_equipe_servie').length}, 'c_plus_servi', ${lignes.filter((l) => l.categorie === 'c_plus_servi').length}),
            'changements', ${vide ? `'[]'::jsonb` : `(select jsonb_agg(jsonb_build_object('game_id', game_id, 'cote', cote, 'ancien', ancien, 'nouveau', nouveau)) from (values\n${valeurs}) x(game_id, cote, ancien, nouveau, team_id))`}),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_h + n_v <> n_att or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (réalignés %, attendu %, ops +%) — rien écrit', n_h + n_v, n_att, n_ops1 - n_ops0;
  end if;
  raise notice 'OK réparation : % côté(s) réaligné(s) (% domicile, % visiteur), 1 ligne admin_operations', n_h + n_v, n_h, n_v;
end $$;
`;
const rb = `-- ROLLBACK de la réparation : remet l'ancien *_rseq_team_id là où la réparation l'avait changé (et seulement là
-- où la valeur est encore celle qu'elle avait posée). Gardé : exactement ${a.length} côté(s), sinon RIEN.
do $$
declare v_bp uuid; n_att constant int := ${a.length}; n_h int := 0; n_v int := 0; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  select count(*) into n_ops0 from public.admin_operations;
${vide ? '' : `  ${cte}, u as (
    update public.games g set home_rseq_team_id = v.ancien
      from v where v.cote = 'home' and g.id = v.game_id and g.home_rseq_team_id = v.nouveau
    returning 1)
  select count(*) into n_h from u;
  ${cte}, u as (
    update public.games g set visitor_rseq_team_id = v.ancien
      from v where v.cote = 'visitor' and g.id = v.game_id and g.visitor_rseq_team_id = v.nouveau
    returning 1)
  select count(*) into n_v from u;`}
  insert into public.admin_operations (operation, motif, details, par)
  values ('REPARATION_RSEQ_IDS_COTES_ANNULEE', 'Rollback de la réparation unique des identifiants RSEQ de côtés de match',
          jsonb_build_object('cotes', n_h + n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_h + n_v <> n_att or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (remis %, attendu %) — rien écrit', n_h + n_v, n_att;
  end if;
  raise notice 'OK rollback réparation : % côté(s) remis', n_h + n_v;
end $$;
`;
fs.writeFileSync(prefixe + '.sql', sql);
fs.writeFileSync(prefixe + '.rollback.sql', rb);
const t = {}; lignes.forEach((l) => { t[l.categorie] = (t[l.categorie] || 0) + 1; });
console.log(JSON.stringify({ cotes: lignes.length, ligues_lues: new Set(cotes.map((c) => c.rseq_league_id)).size, categories: t }));
