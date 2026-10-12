-- ============================================================================
-- NLS Premier League (No Limits Showcases) — basketball, saison 2026-2027 — création : 34 clubs nouveaux, 107 équipes
-- Généré par scripts/plan-nls-basketball-teams.mjs depuis data/nls/NLS_S02_equipes.csv.
-- TEXTE À RELIRE — NE PAS APPLIQUER EN PROD SANS LE GO DE BP.
-- ============================================================================
-- Idempotent : une relance ne crée RIEN de ce qui existe (club repris seulement
-- s'il vient du journal de cet import, équipe par teams_identity_unique). Gardes : insérées =
-- 107 − déjà présentes ; 107 équipes NLS au total après coup ; une
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
    ('NLS – 3KBM', NULL::uuid, 'NLS – 3KBM'),
    ('NLS – AGBU', NULL::uuid, 'NLS – AGBU'),
    ('NLS – ARGO ELITE', NULL::uuid, 'NLS – ARGO ELITE'),
    ('NLS – BLUEHOUNDS', NULL::uuid, 'NLS – BLUEHOUNDS'),
    ('NLS – BREAKPOINT', NULL::uuid, 'NLS – BREAKPOINT'),
    ('NLS – C.B.O. CAVALIERS', NULL::uuid, 'NLS – C.B.O. CAVALIERS'),
    ('NLS – C.S.S.', NULL::uuid, 'NLS – C.S.S.'),
    ('NLS – CB ELITE', NULL::uuid, 'NLS – CB ELITE'),
    ('NLS – CSJV', NULL::uuid, 'NLS – CSJV'),
    ('NLS – DALBÉ-VIAU', NULL::uuid, 'NLS – DALBÉ-VIAU'),
    ('NLS – DROPOFF', NULL::uuid, 'NLS – DROPOFF'),
    ('NLS – FUSION', NULL::uuid, 'NLS – FUSION'),
    ('NLS – GD ELITE', NULL::uuid, 'NLS – GD ELITE'),
    ('NLS – GILAS', NULL::uuid, 'NLS – GILAS'),
    ('NLS – LEGACY', NULL::uuid, 'NLS – LEGACY'),
    ('NLS – LEVEL UP', NULL::uuid, 'NLS – LEVEL UP'),
    ('NLS – MATRIX', NULL::uuid, 'NLS – MATRIX'),
    ('NLS – MENTOR SPORT', NULL::uuid, 'NLS – MENTOR SPORT'),
    ('NLS – MTG', NULL::uuid, 'NLS – MTG'),
    ('NLS – NEMESIS', NULL::uuid, 'NLS – NEMESIS'),
    ('NLS – NFNL', NULL::uuid, 'NLS – NFNL'),
    ('NLS – NORDSTAR', NULL::uuid, 'NLS – NORDSTAR'),
    ('NLS – NSL SELECT', NULL::uuid, 'NLS – NSL SELECT'),
    ('NLS – PHEBUS', NULL::uuid, 'NLS – PHEBUS'),
    ('NLS – PINK PANTHERS', NULL::uuid, 'NLS – PINK PANTHERS'),
    ('NLS – PREMIER PAS', NULL::uuid, 'NLS – PREMIER PAS'),
    ('NLS – REBELS', NULL::uuid, 'NLS – REBELS'),
    ('NLS – REVOLUTION', NULL::uuid, 'NLS – REVOLUTION'),
    ('NLS – RIVERAINS', NULL::uuid, 'NLS – RIVERAINS'),
    ('NLS – ROM BBALL', NULL::uuid, 'NLS – ROM BBALL'),
    ('NLS – SAGESSE', NULL::uuid, 'NLS – SAGESSE'),
    ('NLS – SFB', NULL::uuid, 'NLS – SFB'),
    ('NLS – SSM', NULL::uuid, 'NLS – SSM'),
    ('NLS – UPHILL', NULL::uuid, 'NLS – UPHILL');

  create temp table _nls_lot (libelle_pdf text, club text not null, name text not null, age_group text not null,
    division text not null, gender text not null, zone text not null) on commit drop;
  insert into _nls_lot values
    ('C.B.O. CAVALIERS BF', 'NLS – C.B.O. CAVALIERS', 'NLS – C.B.O. CAVALIERS', 'Benjamin', '', 'Féminin', ''),
    ('C.S.S. BF', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Benjamin', '', 'Féminin', ''),
    ('DALBÉ-VIAU (2)', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU (2)', 'Benjamin', '', 'Féminin', ''),
    ('DALBÉ-VIAU BF', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU (1)', 'Benjamin', '', 'Féminin', ''),
    ('FUSION BF', 'NLS – FUSION', 'NLS – FUSION', 'Benjamin', '', 'Féminin', ''),
    ('PHEBUS BF', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Benjamin', '', 'Féminin', ''),
    ('REBELS BF', 'NLS – REBELS', 'NLS – REBELS', 'Benjamin', '', 'Féminin', ''),
    ('SSM BF', 'NLS – SSM', 'NLS – SSM', 'Benjamin', '', 'Féminin', ''),
    ('C.S.S. BM', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('DALBÉ-VIAU BM', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('DROPOFF BM', 'NLS – DROPOFF', 'NLS – DROPOFF', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('NEMESIS BM', 'NLS – NEMESIS', 'NLS – NEMESIS', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('NFNL BM', 'NLS – NFNL', 'NLS – NFNL', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('ROM BBALL BM', 'NLS – ROM BBALL', 'NLS – ROM BBALL', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('SFB BM', 'NLS – SFB', 'NLS – SFB', 'Benjamin', 'Diamond', 'Masculin', ''),
    ('3KBM BM', 'NLS – 3KBM', 'NLS – 3KBM', 'Benjamin', 'Gold', 'Masculin', ''),
    ('C.S.S. BM', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Benjamin', 'Gold', 'Masculin', ''),
    ('CB ELITE BM', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Benjamin', 'Gold', 'Masculin', ''),
    ('DALBÉ-VIAU (2)', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Benjamin', 'Gold', 'Masculin', ''),
    ('DROPOFF (2) BM', 'NLS – DROPOFF', 'NLS – DROPOFF', 'Benjamin', 'Gold', 'Masculin', ''),
    ('MATRIX BM', 'NLS – MATRIX', 'NLS – MATRIX', 'Benjamin', 'Gold', 'Masculin', ''),
    ('MENTOR SPORT BM', 'NLS – MENTOR SPORT', 'NLS – MENTOR SPORT', 'Benjamin', 'Gold', 'Masculin', ''),
    ('MTG BM', 'NLS – MTG', 'NLS – MTG', 'Benjamin', 'Gold', 'Masculin', ''),
    ('NEMESIS (2) BM', 'NLS – NEMESIS', 'NLS – NEMESIS', 'Benjamin', 'Gold', 'Masculin', ''),
    ('NORDSTAR BM', 'NLS – NORDSTAR', 'NLS – NORDSTAR', 'Benjamin', 'Gold', 'Masculin', ''),
    ('PHEBUS BM', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Benjamin', 'Gold', 'Masculin', ''),
    ('REBELS BM', 'NLS – REBELS', 'NLS – REBELS', 'Benjamin', 'Gold', 'Masculin', ''),
    ('RIVERAINS BM', 'NLS – RIVERAINS', 'NLS – RIVERAINS', 'Benjamin', 'Gold', 'Masculin', ''),
    ('SSM BM', 'NLS – SSM', 'NLS – SSM', 'Benjamin', 'Gold', 'Masculin', ''),
    ('C.B.O. CAVALIERS CF', 'NLS – C.B.O. CAVALIERS', 'NLS – C.B.O. CAVALIERS', 'Cadet', '', 'Féminin', ''),
    ('C.S.S. CF', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Cadet', '', 'Féminin', ''),
    ('CB ELITE CF', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Cadet', '', 'Féminin', ''),
    ('DALBÉ-VIAU CF', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Cadet', '', 'Féminin', ''),
    ('FUSION CF', 'NLS – FUSION', 'NLS – FUSION', 'Cadet', '', 'Féminin', ''),
    ('MENTOR SPORT CF', 'NLS – MENTOR SPORT', 'NLS – MENTOR SPORT', 'Cadet', '', 'Féminin', ''),
    ('PHEBUS CF', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Cadet', '', 'Féminin', ''),
    ('PINK PANTHERS CF', 'NLS – PINK PANTHERS', 'NLS – PINK PANTHERS', 'Cadet', '', 'Féminin', ''),
    ('SFB CF', 'NLS – SFB', 'NLS – SFB', 'Cadet', '', 'Féminin', ''),
    ('SSM CF', 'NLS – SSM', 'NLS – SSM', 'Cadet', '', 'Féminin', ''),
    ('3KBM CM', 'NLS – 3KBM', 'NLS – 3KBM', 'Cadet', 'Diamond', 'Masculin', ''),
    ('CB ELITE CM', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Cadet', 'Diamond', 'Masculin', ''),
    ('DROPOFF CM', 'NLS – DROPOFF', 'NLS – DROPOFF', 'Cadet', 'Diamond', 'Masculin', ''),
    ('LEVEL UP CM', 'NLS – LEVEL UP', 'NLS – LEVEL UP', 'Cadet', 'Diamond', 'Masculin', ''),
    ('NFNL CM', 'NLS – NFNL', 'NLS – NFNL', 'Cadet', 'Diamond', 'Masculin', ''),
    ('NORDSTAR CM', 'NLS – NORDSTAR', 'NLS – NORDSTAR', 'Cadet', 'Diamond', 'Masculin', ''),
    ('NSL SELECT CM', 'NLS – NSL SELECT', 'NLS – NSL SELECT', 'Cadet', 'Diamond', 'Masculin', ''),
    ('ROM BBALL CM', 'NLS – ROM BBALL', 'NLS – ROM BBALL', 'Cadet', 'Diamond', 'Masculin', ''),
    ('SAGESSE CM', 'NLS – SAGESSE', 'NLS – SAGESSE', 'Cadet', 'Diamond', 'Masculin', ''),
    ('SFB CM', 'NLS – SFB', 'NLS – SFB', 'Cadet', 'Diamond', 'Masculin', ''),
    ('UPHILL CM', 'NLS – UPHILL', 'NLS – UPHILL', 'Cadet', 'Diamond', 'Masculin', ''),
    ('3KBM (2) CM', 'NLS – 3KBM', 'NLS – 3KBM', 'Cadet', 'Gold', 'Masculin', ''),
    ('AGBU CM', 'NLS – AGBU', 'NLS – AGBU', 'Cadet', 'Gold', 'Masculin', ''),
    ('CB ELITE (2) CM', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Cadet', 'Gold', 'Masculin', ''),
    ('CSS CM', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Cadet', 'Gold', 'Masculin', ''),
    ('DALBÉ-VIAU CM', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Cadet', 'Gold', 'Masculin', ''),
    ('DROPOFF (2) CM', 'NLS – DROPOFF', 'NLS – DROPOFF', 'Cadet', 'Gold', 'Masculin', ''),
    ('FUSION CM', 'NLS – FUSION', 'NLS – FUSION', 'Cadet', 'Gold', 'Masculin', ''),
    ('GILAS CM', 'NLS – GILAS', 'NLS – GILAS', 'Cadet', 'Gold', 'Masculin', ''),
    ('MATRIX CM', 'NLS – MATRIX', 'NLS – MATRIX', 'Cadet', 'Gold', 'Masculin', ''),
    ('MTG CM', 'NLS – MTG', 'NLS – MTG', 'Cadet', 'Gold', 'Masculin', ''),
    ('NEMESIS CM', 'NLS – NEMESIS', 'NLS – NEMESIS', 'Cadet', 'Gold', 'Masculin', ''),
    ('PHEBUS CM', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Cadet', 'Gold', 'Masculin', ''),
    ('PREMIER PAS CM', 'NLS – PREMIER PAS', 'NLS – PREMIER PAS', 'Cadet', 'Gold', 'Masculin', ''),
    ('REBELS CM', 'NLS – REBELS', 'NLS – REBELS', 'Cadet', 'Gold', 'Masculin', ''),
    ('RIVERAINS CM', 'NLS – RIVERAINS', 'NLS – RIVERAINS', 'Cadet', 'Gold', 'Masculin', ''),
    ('ROM BBALL (2) CM', 'NLS – ROM BBALL', 'NLS – ROM BBALL', 'Cadet', 'Gold', 'Masculin', ''),
    ('BLUEHOUNDS JF', 'NLS – BLUEHOUNDS', 'NLS – BLUEHOUNDS', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('BREAKPOINT JF', 'NLS – BREAKPOINT', 'NLS – BREAKPOINT', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('CB ELITE JF', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('DALBÉ-VIAU JF', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('MATRIX JF', 'NLS – MATRIX', 'NLS – MATRIX', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('PHEBUS JF', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('SSM JF', 'NLS – SSM', 'NLS – SSM', 'Juvénile', 'Diamond', 'Féminin', ''),
    ('BLUEHOUNDS (2) JF', 'NLS – BLUEHOUNDS', 'NLS – BLUEHOUNDS', 'Juvénile', 'Gold', 'Féminin', ''),
    ('C.B.O. CAVALIERS JF', 'NLS – C.B.O. CAVALIERS', 'NLS – C.B.O. CAVALIERS', 'Juvénile', 'Gold', 'Féminin', ''),
    ('C.S.S. JF', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Juvénile', 'Gold', 'Féminin', ''),
    ('MATRIX (2) JF', 'NLS – MATRIX', 'NLS – MATRIX', 'Juvénile', 'Gold', 'Féminin', ''),
    ('PREMIER PAS JF', 'NLS – PREMIER PAS', 'NLS – PREMIER PAS', 'Juvénile', 'Gold', 'Féminin', ''),
    ('REBELS JF', 'NLS – REBELS', 'NLS – REBELS', 'Juvénile', 'Gold', 'Féminin', ''),
    ('3KBM JM', 'NLS – 3KBM', 'NLS – 3KBM', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('C.S.S. JM', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('CB ELITE JM', 'NLS – CB ELITE', 'NLS – CB ELITE', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('DALBÉ-VIAU JM', 'NLS – DALBÉ-VIAU', 'NLS – DALBÉ-VIAU', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('DROPOFF JM', 'NLS – DROPOFF', 'NLS – DROPOFF', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('FUSION JM', 'NLS – FUSION', 'NLS – FUSION', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('GD ELITE', 'NLS – GD ELITE', 'NLS – GD ELITE', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('LEVEL UP JM', 'NLS – LEVEL UP', 'NLS – LEVEL UP', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('NFNL JM', 'NLS – NFNL', 'NLS – NFNL', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('NORDSTAR JM', 'NLS – NORDSTAR', 'NLS – NORDSTAR', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('PREMIER PAS JM', 'NLS – PREMIER PAS', 'NLS – PREMIER PAS', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('SFB JM', 'NLS – SFB', 'NLS – SFB', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('SSM JM', 'NLS – SSM', 'NLS – SSM', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('UPHILL JM', 'NLS – UPHILL', 'NLS – UPHILL', 'Juvénile', 'Diamond', 'Masculin', ''),
    ('ARGO ELITE', 'NLS – ARGO ELITE', 'NLS – ARGO ELITE', 'Juvénile', 'Gold', 'Masculin', ''),
    ('BREAKPOINT JM', 'NLS – BREAKPOINT', 'NLS – BREAKPOINT', 'Juvénile', 'Gold', 'Masculin', ''),
    ('C.S.S. (2) JM', 'NLS – C.S.S.', 'NLS – C.S.S.', 'Juvénile', 'Gold', 'Masculin', ''),
    ('CSJV JM', 'NLS – CSJV', 'NLS – CSJV', 'Juvénile', 'Gold', 'Masculin', ''),
    ('LEGACY JM', 'NLS – LEGACY', 'NLS – LEGACY', 'Juvénile', 'Gold', 'Masculin', ''),
    ('MATRIX JM', 'NLS – MATRIX', 'NLS – MATRIX', 'Juvénile', 'Gold', 'Masculin', ''),
    ('MENTOR SPORT JM', 'NLS – MENTOR SPORT', 'NLS – MENTOR SPORT', 'Juvénile', 'Gold', 'Masculin', ''),
    ('MTG JM', 'NLS – MTG', 'NLS – MTG', 'Juvénile', 'Gold', 'Masculin', ''),
    ('PHEBUS JM', 'NLS – PHEBUS', 'NLS – PHEBUS', 'Juvénile', 'Gold', 'Masculin', ''),
    ('PREMIER PAS (2) JM', 'NLS – PREMIER PAS', 'NLS – PREMIER PAS', 'Juvénile', 'Gold', 'Masculin', ''),
    ('REBELS JM', 'NLS – REBELS', 'NLS – REBELS', 'Juvénile', 'Gold', 'Masculin', ''),
    ('REVOLUTION JM', 'NLS – REVOLUTION', 'NLS – REVOLUTION', 'Juvénile', 'Gold', 'Masculin', ''),
    ('RIVERAINS JM', 'NLS – RIVERAINS', 'NLS – RIVERAINS', 'Juvénile', 'Gold', 'Masculin', ''),
    ('SSM (2) JM', 'NLS – SSM', 'NLS – SSM', 'Juvénile', 'Gold', 'Masculin', '');

  select count(*), count(distinct club) into n_lot, n_clubs from _nls_lot;
  if n_lot <> 107 or n_clubs <> 34 or (select count(*) from _nls_clubs) <> 34 then
    raise exception 'NEXUS: lot de % équipe(s) / % club(s), attendu 107 / 34', n_lot, n_clubs; end if;

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
    join public.teams t on t.school_id = c.school_id and t.sport_id = '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492'
     and t.name = l.name and t.age_group = l.age_group and t.division = l.division and t.gender = l.gender
     and t.season = '2026-2027' and t.league = 'No Limits Showcases' and t.zone = l.zone;

  with ins as (
    insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, league, zone, is_active)
    select c.school_id, '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492', l.name, l.age_group, l.division, l.gender, '2026-2027', 'No Limits Showcases', l.zone, true
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
   where league = 'No Limits Showcases' and season = '2026-2027' and sport_id = '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492';
  if n_ins <> 107 - n_deja or n_total <> 107 then
    raise exception 'NEXUS: garde échouée — insérées %, déjà présentes %, total NLS % (attendu 107)', n_ins, n_deja, n_total; end if;

  -- 4. journal
  select count(*) into n_ops0 from public.admin_operations;
  if n_ins + n_crees > 0 then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nom', nom) order by nom), '[]') into v_clubs from _nls_crees;
    insert into public.admin_operations (operation, motif, details, par)
    values ('NLS_EQUIPES_CREEES',
            'Import NLS Premier League S02 (basketball 2026-2027) depuis le PDF officiel révisé le 6 oct. 2026',
            jsonb_build_object('ligue', 'No Limits Showcases', 'saison', '2026-2027', 'source', 'data/nls/NLS_S02_equipes.csv',
                               'equipes', v_equipes, 'clubs_crees', v_clubs, 'deja_presentes', n_deja),
            v_bp);
  end if;
  select count(*) into n_ops1 from public.admin_operations;
  n_journal := (n_ins + n_crees > 0)::int;
  if n_ops1 - n_ops0 <> n_journal then
    raise exception 'NEXUS: journal +%, attendu %', n_ops1 - n_ops0, n_journal; end if;

  raise notice 'NLS : % club(s) créé(s), % équipe(s) insérée(s), % déjà présente(s), total NLS %', n_crees, n_ins, n_deja, n_total;
end $$;
