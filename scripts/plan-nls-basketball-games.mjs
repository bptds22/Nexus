// scripts/plan-nls-basketball-games.mjs
// ============================================================================
// Import HEBDOMADAIRE des matchs NLS Premier League S02 (basketball 2026-2027).
// Lit un JSON NORMALISÉ, génère UN fichier .sql (un bloc do $$). N'APPLIQUE RIEN.
//
// SOURCE (décision BP 2026-10-14). JAMAIS de lecture automatique d'Exposure
// Events (robots.txt + conditions d'utilisation). Chaque mercredi, BP
// enregistre en PDF la page Schedule des 10 divisions
// (data/nls/pdf/AAAA-MM-JJ/) ; un lecteur en tire le JSON normalisé :
//   { "collecte_le": "ISO 8601", "matchs": [ { division_exposure, date,
//     heure, equipe_domicile, equipe_visiteur, lieu, score_dom, score_vis,
//     statut } ] }
// Ce script ne connaît que ce format : changer de source = changer de
// lecteur, pas de moteur.
//
// CLÉ D'UN MATCH (BP) : le PDF n'a PAS d'identifiant de match. Clé naturelle
//   (source NLS, saison, division Exposure, date, domicile, visiteur)
// — la division Exposure se lit en base (category, division, sex_type).
// Aucun index unique ne la porte ; games_identite_civile, plus stricte (paire
// non orientée, sans sexe), est vérifiée AVANT d'écrire.
//
// ÉQUIPES : (groupe classé par classerGroupeCivil(LIGUE_NLS, …), nom Exposure
// EXACT) → id, lu dans le JOURNAL admin_operations NLS_EQUIPES_CREEES
// (libelle_pdf), moins NLS_EQUIPES_RETIREES. Jamais par teams.name : « NLS –
// C.S.S. » ne distingue pas « C.S.S. BM » de « C.S.S. (2) JM ». Résolution
// DANS le SQL : un nom inconnu lève une exception, rien n'est écrit.
//
// APPARIEMENT d'un lot avec la base (groupes couverts par le lot seulement) :
//   1. même clé                      → même match (MAJ si heure, lieu ou
//                                      pointage diffèrent, sinon inchangé) ;
//   2. DÉPLACEMENT (BP) : pour une même paire NON ORIENTÉE d'une même
//      division, exactement 1 match de la base sans correspondant ET
//      exactement 1 match du lot sans correspondant → UPDATE du match
//      existant. Une INVERSION domicile / visiteur, le même jour ou non, en
//      est un cas (BP 2026-10-14) : la même ligne, côtés échangés ;
//   3. sinon : lot seul → INSERT ; base seule → MATCH_RETIRE (signalé,
//      jamais supprimé).
// UPDATE limité à game_date, game_time, venue, scores, is_played,
// collecte_le (+ updated_at) — et, pour une inversion SEULEMENT, aux deux
// côtés (home/visitor _team_id et _name_raw, les mêmes équipes échangées) —
// seulement si l'un d'eux diffère. Aucun DELETE.
// Gardes de nombre exact. Une ligne admin_operations NLS_MATCHS_IMPORT (ids
// insérés, anciennes ET nouvelles valeurs des modifiés, retraits) s'il y a
// quelque chose à dire ; aucune sinon. Rollback :
// scripts/nls-basketball/matchs/rollback-lot.sql.
//
// FENÊTRE : le SQL refuse de tourner le mardi, et le mercredi avant 5 h
// (heure de Montréal), sauf essai local déclaré par
//   set local nexus.essai_local = 'oui';
//
// Run:
//   node --experimental-strip-types scripts/plan-nls-basketball-games.mjs \
//        --json data/nls/matchs-AAAA-MM-JJ.json [--out <fichier.sql>]
// (le JSON vient de scripts/nls-basketball/parse-exposure-pdf.py)
// ============================================================================

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classerGroupeCivil, LIGUE_NLS } from "../lib/civil/classementCivil.ts";
import { minutesDe } from "../lib/calendar/heureMatch.ts";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SAISON = "2026-2027";
const SPORT = "Basketball";
const SOURCE_NOM = "NLS";
/** Page publique de vérification, pour l'humain qui lit la carte de match.
 *  Aucun script ne la lit. */
const SOURCE_URL = "https://basketball.exposureevents.com/277970/nls-premier-league-s02/schedule";

/** Les 10 divisions telles qu'Exposure les nomme (relevé 2026-10-14) →
 *  catégorie, genre, division SOURCE. Liste FERMÉE : toute autre valeur
 *  arrête le script. */
const DIVISIONS_EXPOSURE = {
  "Benjamin Féminin":     ["Benjamin", "Féminin", ""],
  "BENJAMIN M - DIAMOND": ["Benjamin", "Masculin", "Diamond"],
  "BENJAMIN M - GOLD":    ["Benjamin", "Masculin", "Gold"],
  "CADET FÉMININ":        ["Cadet", "Féminin", ""],
  "CADET M - DIAMOND":    ["Cadet", "Masculin", "Diamond"],
  "CADET M - GOLD":       ["Cadet", "Masculin", "Gold"],
  "JUVÉNILE F - DIAMOND": ["Juvénile", "Féminin", "Diamond"],
  "JUVÉNILE F - GOLD":    ["Juvénile", "Féminin", "Gold"],
  "JUVÉNILE M - DIAMOND": ["Juvénile", "Masculin", "Diamond"],
  "JUVÉNILE M - GOLD":    ["Juvénile", "Masculin", "Gold"],
};

/** Statuts admis. Un match annulé ou reporté n'a pas de colonne en base :
 *  tant que BP n'a pas tranché, il ARRÊTE l'import plutôt que de s'afficher
 *  comme un match à venir. */
const STATUTS = new Set(["prevu", "joue"]);

const texte = (v) => (v == null ? null : String(v).normalize("NFC").trim() || null);

function entier(v, champ, i) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`match ${i} : ${champ} illisible « ${v} »`);
  return n;
}

function dateIso(v, i) {
  const s = texte(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) throw new Error(`match ${i} : date illisible « ${v} » (attendu AAAA-MM-JJ)`);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error(`match ${i} : date impossible « ${v} »`);
  return s;
}

/** Heure locale de Montréal → « HH:MM » 24 h, lue par minutesDe (LA lecture
 *  de heureMatch). Forme canonique : « 6:30 PM » et « 18:30 » donnent la même
 *  valeur. Absente → null (« Heure à confirmer ») ; illisible → arrêt. */
function heure24(v, i) {
  const s = texte(v);
  if (s == null) return null;
  const mn = minutesDe(s);
  if (mn == null) throw new Error(`match ${i} : heure illisible « ${v} »`);
  return `${String(Math.floor(mn / 60)).padStart(2, "0")}:${String(mn % 60).padStart(2, "0")}`;
}

/** Valide et classe UN match normalisé. Lève à la première anomalie. */
export function normaliser(m, i) {
  const libelleDiv = texte(m.division_exposure);
  const div = DIVISIONS_EXPOSURE[libelleDiv];
  if (!div) throw new Error(`match ${i} : division Exposure inconnue « ${m.division_exposure} »`);
  const [categorie, genre, divisionSource] = div;
  const g = classerGroupeCivil(LIGUE_NLS, categorie, divisionSource);
  const dom = texte(m.equipe_domicile), vis = texte(m.equipe_visiteur);
  if (!dom || !vis) throw new Error(`match ${i} : équipe absente`);
  if (dom === vis) throw new Error(`match ${i} : « ${dom} » contre elle-même`);
  const statut = texte(m.statut)?.toLowerCase() ?? null;
  if (!STATUTS.has(statut)) throw new Error(`match ${i} : statut « ${m.statut} » non géré — à trancher par BP`);
  const sd = entier(m.score_dom, "score_dom", i), sv = entier(m.score_vis, "score_vis", i);
  if ((sd == null) !== (sv == null)) throw new Error(`match ${i} : un seul pointage sur deux`);
  if ((statut === "joue") !== (sd != null)) throw new Error(`match ${i} : statut « ${statut} » incohérent avec le pointage`);
  return {
    libelleDiv, categorie: g.categorie, division: g.division, genre,
    date: dateIso(m.date, i), heure: heure24(m.heure, i),
    dom, vis, lieu: texte(m.lieu), sd, sv,
  };
}

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? "NULL" : String(v));

/** Le texte de la clé d'un match, pour les messages et le journal. */
const CLE_SQL = (a) =>
  `format('%s | %s | %s c. %s', ${a}.libelle_div, ${a}.game_date, ${a}.home_name, ${a}.visitor_name)`;

export function sql(rows, { description, collecte_le }) {
  const C = q(collecte_le);
  const L = [];
  const p = (s) => L.push(s);
  p(`-- ============================================================================`);
  p(`-- NLS Premier League S02 — import des matchs (${rows.length}) — ${description}`);
  p(`-- Généré par scripts/plan-nls-basketball-games.mjs. TEXTE À RELIRE.`);
  p(`-- PROD : GO de BP seulement, jamais le mardi ni le mercredi avant 5 h.`);
  p(`-- ============================================================================`);
  p(`do $$`);
  p(`declare`);
  p(`  v_bp uuid; v_t timestamp := now() at time zone 'America/Toronto';`);
  p(`  n_lot int; n_base0 int; n_base1 int; n_meme int; n_depl int; n_nouv int; n_mod int; n_inch int;`);
  p(`  n_ins int; n_upd int; n_ret int; n_ret_nouv int; n_rev int; n_ops0 int; n_ops1 int; v_lot_no int; v_txt text;`);
  p(`  v_ins jsonb; v_mod jsonb; v_ret_nouv jsonb; v_ret_tous jsonb; v_ret_deja jsonb; v_div jsonb;`);
  p(`begin`);
  p(`  -- 0. fenêtre : jamais le mardi, ni le mercredi avant 5 h (Montréal)`);
  p(`  if coalesce(current_setting('nexus.essai_local', true), '') <> 'oui'`);
  p(`     and (extract(isodow from v_t) = 2 or (extract(isodow from v_t) = 3 and extract(hour from v_t) < 5)) then`);
  p(`    raise exception 'NEXUS: import NLS refusé — mardi, ou mercredi avant 5 h (%)', v_t; end if;`);
  p(`  select id into v_bp from public.users where email = 'bptds22@gmail.com';`);
  p(``);
  p(`  drop table if exists _nls_src; drop table if exists _nls_eq; drop table if exists _nls_res;`);
  p(`  drop table if exists _nls_base; drop table if exists _nls_lien;`);
  p(`  create temp table _nls_src (rang int primary key, libelle_div text not null, categorie text not null,`);
  p(`    division text not null, genre text not null, game_date date not null, game_time text,`);
  p(`    home_name text not null, visitor_name text not null, venue text, home_score int, visitor_score int,`);
  p(`    unique (categorie, division, genre, game_date, home_name, visitor_name)) on commit drop;`);
  p(`  insert into _nls_src values`);
  p(rows.map((r, i) =>
    `    (${i + 1}, ${q(r.libelleDiv)}, ${q(r.categorie)}, ${q(r.division)}, ${q(r.genre)}, ${q(r.date)}, ${q(r.heure)},` +
    ` ${q(r.dom)}, ${q(r.vis)}, ${q(r.lieu)}, ${n(r.sd)}, ${n(r.sv)})${i === rows.length - 1 ? ";" : ","}`).join("\n"));
  p(`  select count(*) into n_lot from _nls_src;`);
  p(`  if n_lot <> ${rows.length} then raise exception 'NEXUS: lot de % match(s), attendu ${rows.length}', n_lot; end if;`);
  p(``);
  p(`  -- 1. équipes : le JOURNAL de l'import des équipes, moins les retraits, et vivantes en base`);
  p(`  create temp table _nls_eq on commit drop as`);
  p(`    select (e->>'id')::uuid as id, e->>'libelle_pdf' as libelle, e->>'categorie' as categorie,`);
  p(`           e->>'division' as division, e->>'genre' as genre`);
  p(`      from public.admin_operations o, jsonb_array_elements(o.details->'equipes') e`);
  p(`     where o.operation = 'NLS_EQUIPES_CREEES'`);
  p(`       and (e->>'id')::uuid not in (select (x->>'id')::uuid from public.admin_operations r,`);
  p(`             jsonb_array_elements(r.details->'equipes') x where r.operation = 'NLS_EQUIPES_RETIREES')`);
  p(`       and (e->>'id')::uuid in (select id from public.teams where league = '${LIGUE_NLS}' and season = '${SAISON}');`);
  p(`  if (select count(*) from _nls_eq) = 0 then raise exception 'NEXUS: aucune équipe NLS au journal — import impossible'; end if;`);
  p(`  if exists (select 1 from _nls_eq group by libelle, categorie, division, genre having count(*) > 1) then`);
  p(`    raise exception 'NEXUS: journal ambigu — deux équipes sous le même (nom, groupe)'; end if;`);
  p(``);
  p(`  create temp table _nls_res on commit drop as`);
  p(`    select s.*, th.id as home_team_id, tv.id as visitor_team_id from _nls_src s`);
  p(`      left join _nls_eq th on th.libelle = s.home_name and th.categorie = s.categorie and th.division = s.division and th.genre = s.genre`);
  p(`      left join _nls_eq tv on tv.libelle = s.visitor_name and tv.categorie = s.categorie and tv.division = s.division and tv.genre = s.genre;`);
  p(`  select string_agg(distinct format('« %s » (%s)', x.nom, x.div), ', ') into v_txt from (`);
  p(`    select home_name as nom, libelle_div as div from _nls_res where home_team_id is null`);
  p(`    union all select visitor_name, libelle_div from _nls_res where visitor_team_id is null) x;`);
  p(`  if v_txt is not null then raise exception 'NEXUS: équipe(s) inconnue(s) — RIEN n''est écrit : %', v_txt; end if;`);
  p(``);
  p(`  -- 2. la base : matchs NLS de la saison, dans les groupes que le lot couvre`);
  p(`  select count(*) into n_base0 from public.games where source_nom = '${SOURCE_NOM}';`);
  p(`  create temp table _nls_base on commit drop as`);
  p(`    select g.id, g.category, g.division, g.sex_type, g.game_date, g.game_time, g.venue, g.home_score, g.visitor_score,`);
  p(`           g.is_played, g.collecte_le, g.home_name_raw, g.visitor_name_raw, g.home_team_id, g.visitor_team_id`);
  p(`      from public.games g`);
  p(`     where g.source_nom = '${SOURCE_NOM}' and g.rseq_game_id is null and g.season = '${SAISON}' and g.league_name = '${LIGUE_NLS}'`);
  p(`       and (g.category, g.division, g.sex_type) in (select distinct categorie, division, genre from _nls_src);`);
  p(`  if exists (select 1 from _nls_base group by category, division, sex_type, game_date, home_name_raw, visitor_name_raw having count(*) > 1) then`);
  p(`    raise exception 'NEXUS: la base porte déjà deux matchs NLS sous la même clé — à trancher par BP'; end if;`);
  p(``);
  p(`  -- 3. appariement : (a) même clé, (b) déplacement 1 pour 1 sur la paire NON orientée`);
  p(`  create temp table _nls_lien (rang int primary key, id uuid not null unique, mode text not null) on commit drop;`);
  p(`  insert into _nls_lien select r.rang, b.id, 'meme' from _nls_res r join _nls_base b`);
  p(`    on b.category = r.categorie and b.division = r.division and b.sex_type = r.genre`);
  p(`   and b.game_date = r.game_date and b.home_name_raw = r.home_name and b.visitor_name_raw = r.visitor_name;`);
  p(`  insert into _nls_lien select s.rang, b.id, 'deplace' from (`);
  p(`      select categorie, division, genre, least(home_name, visitor_name) as a, greatest(home_name, visitor_name) as z,`);
  p(`             min(rang) as rang from _nls_res`);
  p(`       where rang not in (select rang from _nls_lien) group by 1, 2, 3, 4, 5 having count(*) = 1) s`);
  p(`    join (select category, division, sex_type, least(home_name_raw, visitor_name_raw) as a,`);
  p(`                 greatest(home_name_raw, visitor_name_raw) as z, (array_agg(id))[1] as id from _nls_base`);
  p(`       where id not in (select id from _nls_lien) group by 1, 2, 3, 4, 5 having count(*) = 1) b`);
  p(`      on b.category = s.categorie and b.division = s.division and b.sex_type = s.genre and b.a = s.a and b.z = s.z;`);
  p(``);
  p(`  -- un match apparié dont les ÉQUIPES ont changé (autres que les deux mêmes, échangées) : arrêt`);
  p(`  select string_agg(${CLE_SQL("r")}, ' ; ') into v_txt from _nls_lien l join _nls_res r using (rang) join _nls_base b on b.id = l.id`);
  p(`   where not ((b.home_team_id, b.visitor_team_id) = (r.home_team_id, r.visitor_team_id)`);
  p(`           or (b.home_team_id, b.visitor_team_id) = (r.visitor_team_id, r.home_team_id));`);
  p(`  if v_txt is not null then raise exception 'NEXUS: équipes changées sur un match connu — à trancher par BP : %', v_txt; end if;`);
  p(``);
  p(`  select count(*) filter (where mode = 'meme'), count(*) filter (where mode = 'deplace') into n_meme, n_depl from _nls_lien;`);
  p(`  select count(*) into n_nouv from _nls_res where rang not in (select rang from _nls_lien);`);
  p(`  select count(*) into n_mod from _nls_lien l join _nls_res r using (rang) join _nls_base b on b.id = l.id`);
  p(`   where (b.game_date, b.game_time, b.venue, b.home_score, b.visitor_score, b.is_played, b.home_name_raw)`);
  p(`         is distinct from (r.game_date, r.game_time, r.venue, r.home_score, r.visitor_score,`);
  p(`                           (r.home_score is not null and r.visitor_score is not null), r.home_name);`);
  p(`  n_inch := n_lot - n_nouv - n_mod;`);
  p(``);
  p(`  -- garde : l'état FINAL ne doit pas violer games_identite_civile (paire non orientée, sans sexe)`);
  p(`  select string_agg(format('%s %s %s : %s / %s', x.c, nullif(x.d, ''), x.j, x.a, x.z), ' ; ') into v_txt from (`);
  p(`    select c, d, j, a, z from (`);
  p(`      select g.category as c, g.division as d, g.game_date as j,`);
  p(`             least(g.home_name_raw, g.visitor_name_raw) as a, greatest(g.home_name_raw, g.visitor_name_raw) as z`);
  p(`        from public.games g where g.rseq_game_id is null and g.league_name = '${LIGUE_NLS}' and g.season = '${SAISON}'`);
  p(`         and g.zone = '' and g.id not in (select id from _nls_lien)`);
  p(`      union all select r.categorie, r.division, r.game_date, least(r.home_name, r.visitor_name), greatest(r.home_name, r.visitor_name)`);
  p(`        from _nls_res r) f group by 1, 2, 3, 4, 5 having count(*) > 1) x;`);
  p(`  if v_txt is not null then raise exception 'NEXUS: même jour, mêmes équipes (games_identite_civile) — RIEN n''est écrit : %', v_txt; end if;`);
  p(``);
  p(`  -- 4. retirés : en base, dans un groupe couvert, sans correspondant. SIGNALÉS, jamais supprimés.`);
  p(`  select count(*) into n_ret from _nls_base where id not in (select id from _nls_lien);`);
  p(`  -- déjà signalés = la liste complète du dernier lot non défait`);
  p(`  select coalesce(o.details->'retires_tous', '[]') into v_ret_deja from public.admin_operations o`);
  p(`   where o.operation = 'NLS_MATCHS_IMPORT'`);
  p(`     and o.id::text not in (select r.details->>'lot' from public.admin_operations r where r.operation = 'NLS_MATCHS_ROLLBACK')`);
  p(`   order by (o.details->>'lot_no')::int desc limit 1;`);
  p(`  v_ret_deja := coalesce(v_ret_deja, '[]');`);
  p(`  -- revenus = déjà signalés que ce lot retrouve ; la liste complète garde les signalés hors des groupes du lot`);
  p(`  select count(*) into n_rev from jsonb_array_elements_text(v_ret_deja) x where x::uuid in (select id from _nls_lien);`);
  p(`  select coalesce(jsonb_agg(distinct x order by x), '[]') into v_ret_tous from (`);
  p(`    select x from jsonb_array_elements_text(v_ret_deja) x`);
  p(`     where x::uuid not in (select id from _nls_lien) and x::uuid not in (select id from _nls_base)`);
  p(`       and x::uuid in (select id from public.games)`);
  p(`    union select id::text from _nls_base where id not in (select id from _nls_lien)) t(x);`);
  p(`  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', id, 'date', game_date, 'heure', game_time,`);
  p(`           'domicile', home_name_raw, 'visiteur', visitor_name_raw, 'categorie', category, 'division', division, 'genre', sex_type)`);
  p(`           order by game_date, home_name_raw), '[]')`);
  p(`    into n_ret_nouv, v_ret_nouv from _nls_base where id not in (select id from _nls_lien) and not (v_ret_deja ? id::text);`);
  p(``);
  p(`  -- 5. INSERT des nouveaux`);
  p(`  with ins as (`);
  p(`    insert into public.games (season, phase, sector, game_date, game_time,`);
  p(`      home_team_id, visitor_team_id, home_name_raw, visitor_name_raw, home_score, visitor_score, is_played, venue,`);
  p(`      league_name, sport, division, category, zone, sex_type, source_nom, source_url, collecte_le)`);
  p(`    select '${SAISON}', 'regular', null, r.game_date, r.game_time,`);
  p(`      r.home_team_id, r.visitor_team_id, r.home_name, r.visitor_name, r.home_score, r.visitor_score,`);
  p(`      (r.home_score is not null and r.visitor_score is not null), r.venue,`);
  p(`      '${LIGUE_NLS}', '${SPORT}', r.division, r.categorie, '', r.genre, '${SOURCE_NOM}', ${q(SOURCE_URL)}, ${C}::timestamptz`);
  p(`      from _nls_res r where r.rang not in (select rang from _nls_lien)`);
  p(`    returning id, category, division, sex_type, game_date, home_name_raw, visitor_name_raw)`);
  p(`  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', ins.id, 'cle', ${CLE_SQL("r")}) order by r.rang), '[]')`);
  p(`    into n_ins, v_ins from ins join _nls_res r on r.categorie = ins.category and r.division = ins.division`);
  p(`     and r.genre = ins.sex_type and r.game_date = ins.game_date and r.home_name = ins.home_name_raw and r.visitor_name = ins.visitor_name_raw;`);
  p(``);
  p(`  -- 6. UPDATE limité, seulement si différent ; anciennes ET nouvelles valeurs au journal`);
  p(`  with upd as (`);
  p(`    update public.games g set game_date = r.game_date, game_time = r.game_time, venue = r.venue,`);
  p(`           home_score = r.home_score, visitor_score = r.visitor_score,`);
  p(`           is_played = (r.home_score is not null and r.visitor_score is not null),`);
  p(`           collecte_le = ${C}::timestamptz, updated_at = now(),`);
  p(`           -- inversion seulement : les deux mêmes équipes, côtés échangés (garde ci-dessus)`);
  p(`           home_team_id = r.home_team_id, visitor_team_id = r.visitor_team_id,`);
  p(`           home_name_raw = r.home_name, visitor_name_raw = r.visitor_name`);
  p(`      from _nls_lien l join _nls_res r using (rang) join _nls_base b on b.id = l.id`);
  p(`     where g.id = l.id`);
  p(`       and (b.game_date, b.game_time, b.venue, b.home_score, b.visitor_score, b.is_played, b.home_name_raw)`);
  p(`           is distinct from (r.game_date, r.game_time, r.venue, r.home_score, r.visitor_score,`);
  p(`                             (r.home_score is not null and r.visitor_score is not null), r.home_name)`);
  p(`    returning g.id, g.game_date, g.game_time, g.venue, g.home_score, g.visitor_score, g.is_played, g.collecte_le,`);
  p(`              g.home_team_id, g.visitor_team_id, g.home_name_raw, g.visitor_name_raw)`);
  p(`  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'cle', ${CLE_SQL("r")}, 'mode', l.mode,`);
  p(`           'inverse', b.home_team_id <> u.home_team_id,`);
  p(`           'avant', jsonb_build_object('game_date', b.game_date, 'game_time', b.game_time, 'venue', b.venue,`);
  p(`                     'home_score', b.home_score, 'visitor_score', b.visitor_score, 'is_played', b.is_played, 'collecte_le', b.collecte_le,`);
  p(`                     'home_team_id', b.home_team_id, 'visitor_team_id', b.visitor_team_id,`);
  p(`                     'home_name_raw', b.home_name_raw, 'visitor_name_raw', b.visitor_name_raw),`);
  p(`           'apres', jsonb_build_object('game_date', u.game_date, 'game_time', u.game_time, 'venue', u.venue,`);
  p(`                     'home_score', u.home_score, 'visitor_score', u.visitor_score, 'is_played', u.is_played, 'collecte_le', u.collecte_le,`);
  p(`                     'home_team_id', u.home_team_id, 'visitor_team_id', u.visitor_team_id,`);
  p(`                     'home_name_raw', u.home_name_raw, 'visitor_name_raw', u.visitor_name_raw))`);
  p(`           order by r.rang), '[]')`);
  p(`    into n_upd, v_mod from upd u join _nls_lien l on l.id = u.id join _nls_res r using (rang) join _nls_base b on b.id = u.id;`);
  p(``);
  p(`  -- 7. gardes de nombre exact`);
  p(`  select count(*) into n_base1 from public.games where source_nom = '${SOURCE_NOM}';`);
  p(`  if n_ins <> n_nouv or n_upd <> n_mod or n_base1 <> n_base0 + n_nouv then`);
  p(`    raise exception 'NEXUS: garde échouée — insérés %/% attendus, modifiés %/%, base NLS % -> % (attendu +%)',`);
  p(`      n_ins, n_nouv, n_upd, n_mod, n_base0, n_base1, n_nouv; end if;`);
  p(``);
  p(`  -- 8. journal : une ligne s'il y a du nouveau, du modifié, un retrait pas encore signalé ou un retour ; aucune sinon`);
  p(`  select jsonb_object_agg(libelle_div, n) into v_div from (select libelle_div, count(*) as n from _nls_src group by 1) d;`);
  p(`  select count(*) into n_ops0 from public.admin_operations;`);
  p(`  if n_ins + n_upd + n_ret_nouv + n_rev > 0 then`);
  p(`    select coalesce(max((details->>'lot_no')::int), 0) + 1 into v_lot_no from public.admin_operations where operation = 'NLS_MATCHS_IMPORT';`);
  p(`    insert into public.admin_operations (operation, motif, details, par)`);
  p(`    values ('NLS_MATCHS_IMPORT', 'Import hebdomadaire des matchs NLS Premier League S02 (basketball ${SAISON})',`);
  p(`      jsonb_build_object('lot_no', v_lot_no, 'ligue', '${LIGUE_NLS}', 'saison', '${SAISON}',`);
  p(`        'source', jsonb_build_object('nom', '${SOURCE_NOM}', 'description', ${q(description)}, 'collecte_le', ${C}),`);
  p(`        'compte', jsonb_build_object('lot', n_lot, 'par_division', v_div, 'nouveaux', n_ins, 'modifies', n_upd,`);
  p(`                   'dont_deplaces', n_depl, 'inchanges', n_inch, 'retires', n_ret, 'retires_nouveaux', n_ret_nouv, 'retires_revenus', n_rev),`);
  p(`        'inseres', v_ins, 'modifies', v_mod, 'retires_nouveaux', v_ret_nouv, 'retires_tous', v_ret_tous),`);
  p(`      v_bp);`);
  p(`  end if;`);
  p(`  select count(*) into n_ops1 from public.admin_operations;`);
  p(`  if n_ops1 - n_ops0 <> (n_ins + n_upd + n_ret_nouv + n_rev > 0)::int then`);
  p(`    raise exception 'NEXUS: journal +%, attendu %', n_ops1 - n_ops0, (n_ins + n_upd + n_ret_nouv + n_rev > 0)::int; end if;`);
  p(``);
  p(`  for v_txt in select format('MATCH_RETIRE %s %s %s — %s %s, %s c. %s%s', category, nullif(division, ''), sex_type, game_date,`);
  p(`                            coalesce(game_time, '?'), home_name_raw, visitor_name_raw,`);
  p(`                            case when v_ret_deja ? id::text then ' [déjà signalé]' else '' end)`);
  p(`                from _nls_base where id not in (select id from _nls_lien) order by game_date, home_name_raw loop`);
  p(`    raise warning 'NEXUS: %', v_txt;`);
  p(`  end loop;`);
  p(`  raise notice 'NEXUS NLS matchs : lot %, nouveaux %, modifiés % (dont % déplacé(s)), inchangés %, inconnus 0, retirés % (dont % nouveau(x)), revenus % ; base NLS % -> % ; journal +%',`);
  p(`    n_lot, n_ins, n_upd, n_depl, n_inch, n_ret, n_ret_nouv, n_rev, n_base0, n_base1, n_ops1 - n_ops0;`);
  p(`end $$;`);
  return L.join("\n") + "\n";
}

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) throw new Error(`argument inattendu « ${k} »`);
    a[k.slice(2)] = argv[++i];
  }
  return a;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.json) throw new Error("usage : --json <fichier normalisé> [--out <fichier.sql>]");
  const fichier = path.resolve(a.json);
  const brut = JSON.parse(await readFile(fichier, "utf8"));
  if (!Array.isArray(brut?.matchs)) throw new Error(`${fichier} : clé « matchs » absente ou pas un tableau`);
  const collecte_le = brut.collecte_le;
  if (!collecte_le || Number.isNaN(Date.parse(collecte_le))) throw new Error(`collecte_le absente ou illisible « ${collecte_le} »`);
  const description = `JSON normalisé ${path.basename(fichier)}`;

  const rows = brut.matchs.map((m, i) => normaliser(m, i + 1));
  if (rows.length === 0) throw new Error("lot vide — une source muette n'est pas un calendrier vide");
  const vus = new Set();
  for (const r of rows) {
    const k = [r.libelleDiv, r.date, r.dom, r.vis].join(" | ");
    if (vus.has(k)) throw new Error(`clé en double dans la source : ${k}`);
    vus.add(k);
  }

  const out = path.resolve(a.out ?? fichier.replace(/\.json$/i, ".sql"));
  await writeFile(out, sql(rows, { description, collecte_le }), "utf8");

  const parDiv = {};
  for (const r of rows) parDiv[r.libelleDiv] = (parDiv[r.libelleDiv] ?? 0) + 1;
  const dates = rows.map((r) => r.date).sort();
  console.log(`source   : ${description} (collecte ${collecte_le})`);
  for (const [d, k] of Object.entries(parDiv)) console.log(`  ${d.padEnd(22)} ${String(k).padStart(3)} match(s)`);
  console.log(`total    : ${rows.length} · du ${dates[0]} au ${dates.at(-1)} · joués ${rows.filter((r) => r.sd != null).length} · sans heure ${rows.filter((r) => r.heure == null).length}`);
  console.log(`écrit    : ${out} — RIEN n'est appliqué.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`ARRÊT : ${e.message}`); process.exit(1); });
}
