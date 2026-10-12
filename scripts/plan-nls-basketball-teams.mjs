// scripts/plan-nls-basketball-teams.mjs
// ============================================================================
// PLAN d'insertion des 107 équipes de la NLS Premier League (No Limits
// Showcases, basketball, saison 2 : 10 oct. 2026 → 30 avr. 2027).
// GÉNÈRE DU TEXTE, n'applique RIEN : aucune connexion DB. Écrit, à relire :
//   scripts/nls-basketball/1-creer.sql     clubs absents + 107 équipes
//   scripts/nls-basketball/2-rollback.sql  retire ce que 1-creer a écrit
//   scripts/nls-basketball/0-essai-local.sql  passage, relance, rollback,
//                                             dans UNE transaction annulée
//
// Source : data/nls/NLS_S02_equipes.csv — extrait du PDF officiel « NLS
//   PREMIER LEAGUE S02 TEAMS » révisé le 6 oct. Les codes NLS (BM-DAL2…) n'y
//   sont pas ; le libellé du PDF les remplace dans le journal.
//
// Décisions BP (2026-10-11) :
//   · Diamond / Gold = DIVISIONS ; catégorie Benjamin / Cadet / Juvénile ;
//     zone '' ; groupe à division unique → division '' (jamais NULL : un
//     NULL désarme teams_identity_unique) — lib/civil/classementCivil.ts.
//   · teams.league = LIGUE_NLS (« No Limits Showcases »), la constante.
//   · season '2026-2027' : la saison couvre oct. 2026 → avr. 2027.
//   · « CSS » (Cadet M Gold) = « C.S.S. ».
//
// Décision finale BP (2026-10-11) : les 34 participants deviennent 34 NOUVEAUX
//   clubs LIGUE_CIVILE nommés « NLS – » + le nom EXACT du PDF (« NLS – C.S.S. »,
//   « NLS – DALBÉ-VIAU »). Aucun nom complet cherché, aucune casse modifiée,
//   AUCUN rattachement à un club ou une école existante (pas même Bluehounds
//   ni Némésis). Le nom de l'équipe = le nom du club, avec « (n) » seulement
//   quand deux équipes du club sont dans le MÊME groupe (catégorie + genre +
//   division) — seul cas : DALBÉ-VIAU en Benjamin F.
//
// RÉ-IMPORT SANS DOUBLON : un club « NLS – … » n'est repris que s'il a été créé
//   par cet import (journal NLS_EQUIPES_CREEES) ; tout autre établissement qui
//   porte déjà ce nom ARRÊTE le script. Une équipe se retrouve par ON CONFLICT
//   ON CONSTRAINT teams_identity_unique. La garde exige insérées = 107 − déjà
//   présentes, et 107 équipes NLS au total.
//
// Run:  node --experimental-strip-types scripts/plan-nls-basketball-teams.mjs
// ============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classerGroupeCivil, LIGUE_NLS } from "../lib/civil/classementCivil.ts";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(RACINE, "data", "nls", "NLS_S02_equipes.csv");
const OUT = path.join(RACINE, "scripts", "nls-basketball");

const SPORT_BASKETBALL = "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492";
const SAISON = "2026-2027";
const N_EQUIPES = 107;
const N_CLUBS = 34;
const GENRES = new Set(["Masculin", "Féminin"]);

/** Graphies du PDF ramenées au club (BP 2026-10-11). */
const ALIAS = { "CSS": "C.S.S." };

/** Nom du club en base : « NLS – » (tiret demi-cadratin) + nom EXACT du PDF. */
const PREFIXE_CLUB = "NLS – ";
const nomClub = (c) => PREFIXE_CLUB + c;

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

/** CSV minimal : virgules, guillemets doublés, BOM. */
function lireCsv(texte) {
  const lignes = [];
  let champ = "", ligne = [], guill = false;
  const t = texte.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (guill) {
      if (ch === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (ch === '"') guill = false;
      else champ += ch;
    } else if (ch === '"') guill = true;
    else if (ch === ",") { ligne.push(champ); champ = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      ligne.push(champ); champ = "";
      if (ligne.some((c) => c !== "")) lignes.push(ligne);
      ligne = [];
    } else champ += ch;
  }
  if (champ !== "" || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const [tete, ...corps] = lignes;
  return corps.map((l) => Object.fromEntries(tete.map((c, i) => [c.trim(), (l[i] ?? "").normalize("NFC").trim()])));
}

async function main() {
  const brut = lireCsv(await readFile(SOURCE, "utf8"));

  // ------------------------------------------------------------- lecture
  const erreurs = [];
  const rows = brut.map((r, i) => {
    const club = ALIAS[r.club] ?? r.club;
    let g;
    try { g = classerGroupeCivil(LIGUE_NLS, r.categorie, r.division); }
    catch (e) { erreurs.push(`ligne ${i + 2} (${r.libelle_pdf}) : ${e.message}`); g = {}; }
    if (!GENRES.has(r.genre)) erreurs.push(`ligne ${i + 2} (${r.libelle_pdf}) : genre « ${r.genre} » hors liste`);
    if (!/^[12]$/.test(r.numero_equipe)) erreurs.push(`ligne ${i + 2} (${r.libelle_pdf}) : numéro « ${r.numero_equipe} »`);
    if (!club) erreurs.push(`ligne ${i + 2} : club vide`);
    return { libelle_pdf: r.libelle_pdf, club: nomClub(club), club_pdf: r.club, numero: Number(r.numero_equipe),
             age_group: g.categorie, division: g.division, zone: g.zone, gender: r.genre, note: r.note ?? "" };
  });
  const clubs = [...new Set(rows.map((r) => r.club))].sort((a, b) => a.localeCompare(b, "fr"));
  // deux noms qui ne diffèrent que par la casse ou les accents se confondraient
  const plie = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (new Set(clubs.map(plie)).size !== clubs.length) erreurs.push("deux clubs ne diffèrent que par la casse ou les accents");
  if (rows.length !== N_EQUIPES) erreurs.push(`${rows.length} équipes, attendu ${N_EQUIPES}`);
  if (clubs.length !== N_CLUBS) erreurs.push(`${clubs.length} clubs, attendu ${N_CLUBS}`);

  // ------------------------------------------------- nom d'équipe (numéro)
  const groupe = (r) => [r.club, r.age_group, r.gender, r.division].join("␟");
  const parGroupe = new Map();
  for (const r of rows) parGroupe.set(groupe(r), [...(parGroupe.get(groupe(r)) ?? []), r]);
  for (const r of rows) {
    const freres = parGroupe.get(groupe(r));
    if (freres.length > 1 && new Set(freres.map((x) => x.numero)).size !== freres.length)
      erreurs.push(`${r.club} ${r.age_group} ${r.gender} ${r.division || "—"} : deux équipes, même numéro`);
    r.name = freres.length > 1 ? `${r.club} (${r.numero})` : r.club;
  }

  // ----------------------------------- clé d'identité à 9 colonnes, simulée
  const cles = new Map();
  for (const r of rows) {
    const k = [r.club, SPORT_BASKETBALL, r.name, r.age_group, r.division, r.gender, SAISON, LIGUE_NLS, r.zone].join("␟");
    cles.set(k, [...(cles.get(k) ?? []), r.libelle_pdf]);
  }
  for (const [, v] of cles) if (v.length > 1) erreurs.push(`DOUBLON sur teams_identity_unique : ${v.join(" / ")}`);

  if (erreurs.length) {
    console.error("PLAN REFUSÉ :");
    for (const e of erreurs) console.error("  " + e);
    process.exit(1);
  }

  // ------------------------------------------------------------- compte
  console.log(`ÉQUIPES : ${rows.length}   CLUBS : ${clubs.length}   doublons sur la clé : 0`);
  const parG = {};
  for (const r of rows) { const k = `${r.age_group} ${r.gender} ${r.division || "—"}`; parG[k] = (parG[k] || 0) + 1; }
  for (const [k, n] of Object.entries(parG)) console.log(`   ${k.padEnd(28)} ${n}`);
  console.log(`\nCLUBS À CRÉER (LIGUE_CIVILE, tous nouveaux) : ${clubs.length}`);
  for (const c of clubs) console.log(`   ${c}`);
  console.log(`\nÉQUIPES NUMÉROTÉES (même club, même groupe) :`);
  for (const r of rows.filter((r) => r.name !== r.club)) console.log(`   ${r.name} — ${r.age_group} ${r.gender} ${r.division || "(division unique)"}`);

  // ----------------------------------------------------------------- SQL
  const valsClubs = clubs.map((c) => `    (${q(c)}, NULL::uuid, ${q(c)})`).join(",\n");
  const valsLot = rows.map((r) =>
    `    (${q(r.libelle_pdf)}, ${q(r.club)}, ${q(r.name)}, ${q(r.age_group)}, ${q(r.division)}, ${q(r.gender)}, ${q(r.zone)})`,
  ).join(",\n");

  const ENTETE = (titre) => [
    "-- ============================================================================",
    `-- NLS Premier League (${LIGUE_NLS}) — basketball, saison ${SAISON} — ${titre}`,
    "-- Généré par scripts/plan-nls-basketball-teams.mjs depuis data/nls/NLS_S02_equipes.csv.",
    "-- TEXTE À RELIRE — NE PAS APPLIQUER EN PROD SANS LE GO DE BP.",
    "-- ============================================================================",
  ].join("\n");

  const creer = `${ENTETE(`création : ${N_CLUBS} clubs nouveaux, ${N_EQUIPES} équipes`)}
-- Idempotent : une relance ne crée RIEN de ce qui existe (club repris seulement
-- s'il vient du journal de cet import, équipe par teams_identity_unique). Gardes : insérées =
-- ${N_EQUIPES} − déjà présentes ; ${N_EQUIPES} équipes NLS au total après coup ; une
-- ligne admin_operations quand quelque chose est écrit, aucune sinon.
do $$
declare
  v_bp uuid;
  n_lot int; n_clubs int; n_deja int; n_ins int; n_crees int; n_total int; n_ops0 int; n_ops1 int; n_journal int;
  v_equipes jsonb; v_clubs jsonb;
begin
  -- NULL en local (le compte n'y existe pas) ; admin_operations.par est nullable.
  select id into v_bp from public.users where email = 'bptds22@gmail.com';

  drop table if exists _nls_clubs; drop table if exists _nls_lot; drop table if exists _nls_crees;
  create temp table _nls_clubs (club text primary key, school_id uuid, nom text not null) on commit drop;
  insert into _nls_clubs values
${valsClubs};

  create temp table _nls_lot (libelle_pdf text, club text not null, name text not null, age_group text not null,
    division text not null, gender text not null, zone text not null) on commit drop;
  insert into _nls_lot values
${valsLot};

  select count(*), count(distinct club) into n_lot, n_clubs from _nls_lot;
  if n_lot <> ${N_EQUIPES} or n_clubs <> ${N_CLUBS} or (select count(*) from _nls_clubs) <> ${N_CLUBS} then
    raise exception 'NEXUS: lot de % équipe(s) / % club(s), attendu ${N_EQUIPES} / ${N_CLUBS}', n_lot, n_clubs; end if;

  -- 1. aucun rattachement (BP) : un club « NLS – … » n'est repris que s'il a été
  --    créé par cet import (relance). Tout autre établissement portant ce nom —
  --    casse et accents ignorés, tout type — arrête le script.
  drop table if exists _nls_j_clubs0;
  create temp table _nls_j_clubs0 on commit drop as
    select (e->>'id')::uuid as id from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_CREEES'
    except
    select (e->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_RETIREES';
  if exists (select 1 from _nls_clubs c join public.schools s
               on lower(extensions.unaccent('extensions.unaccent'::regdictionary, s.name))
                = lower(extensions.unaccent('extensions.unaccent'::regdictionary, c.nom))
              where s.id not in (select id from _nls_j_clubs0)) then
    raise exception 'NEXUS: un établissement hors import porte déjà un nom « NLS – … » — à trancher par BP'; end if;
  update _nls_clubs c set school_id = s.id
    from public.schools s where s.name = c.nom and s.type = 'LIGUE_CIVILE' and s.id in (select id from _nls_j_clubs0);

  create temp table _nls_crees (id uuid, nom text) on commit drop;
  with ins as (
    insert into public.schools (name, type)
    select nom, 'LIGUE_CIVILE' from _nls_clubs where school_id is null
    returning id, name)
  insert into _nls_crees select id, name from ins;
  get diagnostics n_crees = row_count;
  update _nls_clubs c set school_id = k.id from _nls_crees k where c.school_id is null and c.nom = k.nom;
  if exists (select 1 from _nls_clubs where school_id is null) then
    raise exception 'NEXUS: club non résolu après création'; end if;

  -- 3. équipes
  select count(*) into n_deja
    from _nls_lot l join _nls_clubs c using (club)
    join public.teams t on t.school_id = c.school_id and t.sport_id = '${SPORT_BASKETBALL}'
     and t.name = l.name and t.age_group = l.age_group and t.division = l.division and t.gender = l.gender
     and t.season = '${SAISON}' and t.league = ${q(LIGUE_NLS)} and t.zone = l.zone;

  with ins as (
    insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, league, zone, is_active)
    select c.school_id, '${SPORT_BASKETBALL}', l.name, l.age_group, l.division, l.gender, '${SAISON}', ${q(LIGUE_NLS)}, l.zone, true
      from _nls_lot l join _nls_clubs c using (club)
    on conflict on constraint teams_identity_unique do nothing
    returning id, school_id, name, age_group, division, gender)
  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', ins.id, 'libelle_pdf', l.libelle_pdf, 'club', l.club,
           'nom', ins.name, 'categorie', ins.age_group, 'division', ins.division, 'genre', ins.gender) order by l.libelle_pdf), '[]')
    into n_ins, v_equipes
    from ins join _nls_clubs c on c.school_id = ins.school_id
    join _nls_lot l on l.club = c.club and l.name = ins.name and l.age_group = ins.age_group
                   and l.division = ins.division and l.gender = ins.gender;

  select count(*) into n_total from public.teams
   where league = ${q(LIGUE_NLS)} and season = '${SAISON}' and sport_id = '${SPORT_BASKETBALL}';
  if n_ins <> ${N_EQUIPES} - n_deja or n_total <> ${N_EQUIPES} then
    raise exception 'NEXUS: garde échouée — insérées %, déjà présentes %, total NLS % (attendu ${N_EQUIPES})', n_ins, n_deja, n_total; end if;

  -- 4. journal
  select count(*) into n_ops0 from public.admin_operations;
  if n_ins + n_crees > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nom', nom) order by nom), '[]') into v_clubs from _nls_crees;
    insert into public.admin_operations (operation, motif, details, par)
    values ('NLS_EQUIPES_CREEES',
            'Import NLS Premier League S02 (basketball ${SAISON}) depuis le PDF officiel révisé le 6 oct. 2026',
            jsonb_build_object('ligue', ${q(LIGUE_NLS)}, 'saison', '${SAISON}', 'source', 'data/nls/NLS_S02_equipes.csv',
                               'equipes', v_equipes, 'clubs_crees', v_clubs, 'deja_presentes', n_deja),
            v_bp);
  end if;
  select count(*) into n_ops1 from public.admin_operations;
  n_journal := (n_ins + n_crees > 0)::int;
  if n_ops1 - n_ops0 <> n_journal then
    raise exception 'NEXUS: journal +%, attendu %', n_ops1 - n_ops0, n_journal; end if;

  raise notice 'NLS : % club(s) créé(s), % équipe(s) insérée(s), % déjà présente(s), total NLS %', n_crees, n_ins, n_deja, n_total;
end $$;
`;

  const rollback = `${ENTETE("ROLLBACK")}
-- Retire les équipes NLS et les clubs que 1-creer.sql a écrits, d'après le
-- journal (admin_operations NLS_EQUIPES_CREEES, moins ce qu'un rollback
-- précédent a déjà retiré). Gardé : les équipes NLS en base sont EXACTEMENT
-- celles du journal (${N_EQUIPES}) ; aucune n'a reçu de dépendant (athlète, coach,
-- invitation, page, fanion, événement, besoin, jeton, carte prospect, équipe
-- principale, revendication, match) ; aucun club créé n'a reçu autre chose que
-- ses équipes NLS. Sinon RIEN.
do $$
declare
  v_bp uuid; n_eq int; n_journal int; n_del int; n_clubs int; n_ops0 int; n_ops1 int;
begin
  select id into v_bp from public.users where email = 'bptds22@gmail.com';
  drop table if exists _nls_j_eq; drop table if exists _nls_j_clubs; drop table if exists _nls_eq;

  create temp table _nls_j_eq on commit drop as
    select (e->>'id')::uuid as id from public.admin_operations o, jsonb_array_elements(o.details->'equipes') e
     where o.operation = 'NLS_EQUIPES_CREEES'
    except
    select (e->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'equipes') e
     where o.operation = 'NLS_EQUIPES_RETIREES';
  create temp table _nls_j_clubs on commit drop as
    select (e->>'id')::uuid as id from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_CREEES'
    except
    select (e->>'id')::uuid from public.admin_operations o, jsonb_array_elements(o.details->'clubs_crees') e
     where o.operation = 'NLS_EQUIPES_RETIREES';
  create temp table _nls_eq on commit drop as
    select id from public.teams
     where league = ${q(LIGUE_NLS)} and season = '${SAISON}' and sport_id = '${SPORT_BASKETBALL}';

  select count(*) into n_eq from _nls_eq;
  select count(*) into n_journal from _nls_j_eq;
  if n_eq <> ${N_EQUIPES} or n_journal <> ${N_EQUIPES}
     or exists (select id from _nls_eq except select id from _nls_j_eq) then
    raise exception 'NEXUS: % équipe(s) NLS en base, % au journal, attendu ${N_EQUIPES} et les mêmes — rollback refusé', n_eq, n_journal; end if;

  if exists (select 1 from public.team_athletes x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_coaches x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_invitations x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_page_content x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_pennants x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_events x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_position_needs x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.team_join_tokens x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.cartes_prospect x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.users x join _nls_eq e on e.id = x.primary_team_id)
     or exists (select 1 from public.ambassadeur_revendications x join _nls_eq e on e.id = x.team_id)
     or exists (select 1 from public.games g join _nls_eq e on e.id in (g.home_team_id, g.visitor_team_id)) then
    raise exception 'NEXUS: une équipe NLS a reçu un dépendant — rollback refusé, à trancher par BP'; end if;

  if exists (select 1 from public.teams t join _nls_j_clubs c on c.id = t.school_id where t.id not in (select id from _nls_eq))
     or exists (select 1 from public.athletes a join _nls_j_clubs c on c.id = a.school_id)
     or exists (select 1 from public.users u join _nls_j_clubs c on c.id = u.school_id)
     or exists (select 1 from public.school_coaches x join _nls_j_clubs c on c.id = x.school_id)
     or exists (select 1 from public.invitations x join _nls_j_clubs c on c.id = x.school_id) then
    raise exception 'NEXUS: un club créé par l''import a reçu autre chose que ses équipes NLS — rollback refusé'; end if;

  select count(*) into n_ops0 from public.admin_operations;
  delete from public.teams t using _nls_eq e where t.id = e.id;
  get diagnostics n_del = row_count;
  delete from public.schools s using _nls_j_clubs c where s.id = c.id;
  get diagnostics n_clubs = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('NLS_EQUIPES_RETIREES', 'Rollback de l''import NLS Premier League S02 (basketball ${SAISON})',
          jsonb_build_object('ligue', ${q(LIGUE_NLS)}, 'saison', '${SAISON}',
            'equipes', (select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from _nls_eq),
            'clubs_crees', (select coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]') from _nls_j_clubs)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> ${N_EQUIPES} or n_clubs <> (select count(*) from _nls_j_clubs) or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes %, clubs %, journal +%) — rien écrit', n_del, n_clubs, n_ops1 - n_ops0; end if;
  raise notice 'NLS rollback : % équipe(s) et % club(s) retiré(s)', n_del, n_clubs;
end $$;
`;

  const compte = `select (select count(*) from public.teams where league = ${q(LIGUE_NLS)} and season = '${SAISON}') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;`;
  const essai = `${ENTETE("ESSAI À BLANC — LOCAL SEULEMENT")}
-- Passage, relance, contrôle des doublons, rollback, puis ROLLBACK de tout :
-- rien ne reste en base, pas même la ligne de journal.
-- docker cp scripts/nls-basketball supabase_db_Nexus:/tmp/nls
-- docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -f /tmp/nls/0-essai-local.sql
\\set ON_ERROR_STOP on
begin;
\\echo '=== avant'
${compte}
\\echo '=== passage 1 : attendu ${N_EQUIPES} équipes'
\\i /tmp/nls/1-creer.sql
${compte}
\\echo '=== relance : attendu 0 ajout, 0 club, 0 ligne de journal'
\\i /tmp/nls/1-creer.sql
${compte}
\\echo '=== doublons sur la clé d identité (attendu : aucune ligne)'
select school_id, name, age_group, division, gender, count(*) from public.teams
 where league = ${q(LIGUE_NLS)} group by 1, 2, 3, 4, 5 having count(*) > 1;
\\echo '=== groupes'
select age_group, gender, nullif(division, '') as division, count(*) from public.teams
 where league = ${q(LIGUE_NLS)} group by 1, 2, 3 order by 1, 2, 3;
\\echo '=== rollback : attendu 0 équipe NLS, clubs civils revenus au compte d avant'
\\i /tmp/nls/2-rollback.sql
${compte}
rollback;
\\echo '=== après ROLLBACK de la transaction d essai'
${compte}
`;

  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "1-creer.sql"), creer, "utf8");
  await writeFile(path.join(OUT, "2-rollback.sql"), rollback, "utf8");
  await writeFile(path.join(OUT, "0-essai-local.sql"), essai, "utf8");
  console.log(`\n--> ${path.relative(RACINE, OUT)}/{0-essai-local,1-creer,2-rollback}.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
