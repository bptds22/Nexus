-- Correction catégorie / division / zone des données CIVILES (BP 2026-10-09).
-- Exception à la règle du 2026-09-05 (« la normalisation est en lecture »), LIMITÉE aux
-- données civiles par décision BP. Prérequis : migration 20261010120000_civil_zone.
--
-- Ce qui est réécrit, et rien d'autre :
--   · teams.division / teams.zone des équipes civiles :
--       a) ligues LFMM, QBFL, QMFL, QMJFL — table de correspondance ci-dessous, identique
--          au classeur lib/civil/classementCivil.ts (test : lib/civil/__tests__) ;
--       b) hockey « M18 AAA » : « AAA Civil — Élite » → AAA ;
--       c) « Division N » saisi par un coach sur une équipe de club civil → DN.
--          Les deux équipes rattachées à l'« école » RSEQ sont EXCLUES (BP : on n'y touche pas).
--   · games.division / games.zone des matchs civils (source_nom LFMM/QBFL/QMFL/QMJFL), même table.
--   La catégorie ne change JAMAIS (vérifié : elle est déjà l'âge).
--
-- TRANSACTION GARDÉE. L'ensemble à réécrire est recompté groupe par groupe et comparé
-- COMPLÈTEMENT à la liste attendue (relevé prod 2026-10-09) ; tout écart → exception, rien
-- n'est écrit. Aucun doublon d'identité possible (vérifié avant ET après).
-- L'état AVANT de chaque ligne est gardé dans admin_operations.details : le rollback
-- (2-rollback.sql) le repose à l'identique.
begin;

do $$
declare
  admin uuid;
  vus text[];
  attendus text[] := array[
    -- ligue | catégorie | division AVANT | nb ÉQUIPES   (relevé prod 2026-10-09)
    'LFMM|Atome|Atome Nord|8', 'LFMM|Atome|Atome Sud|8',
    'LFMM|Bantam|Bantam — Division 1|8', 'LFMM|Bantam|Bantam — Division 2|5',
    'LFMM|Midget|Division 2|1',
    'LFMM|Midget|Midget — Division 1|9', 'LFMM|Midget|Midget — Division 2|4',
    'LFMM|Moustique|Moustique AAA — Division 1 Nord|8', 'LFMM|Moustique|Moustique AAA — Division 1 Sud|8',
    'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Nord|8', 'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Sud|10',
    'M18 AAA|M18|AAA Civil — Élite|15',
    '∅|Midget|Division 1|1'
  ];
  attendus_matchs text[] := array[
    -- ligue | catégorie | division AVANT | nb MATCHS
    'LFMM|Atome|Atome Nord|40', 'LFMM|Atome|Atome Sud|40',
    'LFMM|Bantam|Bantam — Division 1|32', 'LFMM|Bantam|Bantam — Division 2|20',
    'LFMM|Midget|Midget — Division 1|36', 'LFMM|Midget|Midget — Division 2|20',
    'LFMM|Moustique|Moustique AAA — Division 1 Nord|40', 'LFMM|Moustique|Moustique AAA — Division 1 Sud|40',
    'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Nord|40', 'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Sud|50'
  ];
  n_eq int; n_m int; d_avant int; d_apres int;
  avant_eq jsonb; avant_m jsonb;
begin
  select id into admin from public.users where email = 'bptds22@gmail.com';
  if admin is null then raise exception 'NEXUS: compte admin introuvable'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'teams' and column_name = 'zone') then
    raise exception 'NEXUS: migration 20261010120000_civil_zone absente';
  end if;

  -- La table de correspondance : division AVANT → (division, zone). La catégorie ne bouge pas.
  create temp table _carte(ligue text, division_avant text, division text, zone text) on commit drop;
  insert into _carte values
    ('LFMM', 'Atome Nord', '', 'Nord'),
    ('LFMM', 'Atome Sud', '', 'Sud'),
    ('LFMM', 'Bantam — Division 1', 'D1', ''),
    ('LFMM', 'Bantam — Division 2', 'D2', ''),
    ('LFMM', 'Midget — Division 1', 'D1', ''),
    ('LFMM', 'Midget — Division 2', 'D2', ''),
    ('LFMM', 'Division 2', 'D2', ''),
    ('LFMM', 'Moustique AAA — Division 1 Nord', 'AAA', 'Nord'),
    ('LFMM', 'Moustique AAA — Division 1 Sud', 'AAA', 'Sud'),
    ('LFMM', 'Pee-Wee AAA — Division 1 Nord', 'AAA', 'Nord'),
    ('LFMM', 'Pee-Wee AAA — Division 1 Sud', 'AAA', 'Sud'),
    ('M18 AAA', 'AAA Civil — Élite', 'AAA', ''),
    ('∅', 'Division 1', 'D1', ''), ('∅', 'Division 2', 'D2', ''),
    ('∅', 'Division 3', 'D3', ''), ('∅', 'Division 4', 'D4', '');

  -- Les équipes visées, et leur nouvel état.
  create temp table _eq on commit drop as
  select t.id, coalesce(t.league, '∅') as ligue, t.age_group, t.division as division_avant, t.zone as zone_avant,
         c.division, c.zone
    from public.teams t
    join public.schools s on s.id = t.school_id and s.type = 'LIGUE_CIVILE' and s.name <> 'RSEQ'
    join _carte c on c.ligue = coalesce(t.league, '∅') and c.division_avant = t.division
   where t.rseq_team_id is null
     and (t.league in ('LFMM', 'M18 AAA') or t.league is null);

  create temp table _m on commit drop as
  select g.id, g.league_name as ligue, g.category, g.division as division_avant, g.zone as zone_avant,
         c.division, c.zone
    from public.games g
    join _carte c on c.ligue = g.league_name and c.division_avant = g.division
   where g.rseq_game_id is null and g.source_nom = 'LFMM';

  -- GARDE 1 : l'ensemble, groupe par groupe, comparé COMPLÈTEMENT (jamais par inclusion).
  select array_agg(x order by x) into vus from (
    select ligue || '|' || age_group || '|' || division_avant || '|' || count(*) as x
      from _eq group by ligue, age_group, division_avant) z;
  if vus is distinct from (select array_agg(x order by x) from unnest(attendus) x) then
    raise exception 'NEXUS: équipes à corriger = %, attendu %', vus, attendus;
  end if;
  select array_agg(x order by x) into vus from (
    select ligue || '|' || category || '|' || division_avant || '|' || count(*) as x
      from _m group by ligue, category, division_avant) z;
  if vus is distinct from (select array_agg(x order by x) from unnest(attendus_matchs) x) then
    raise exception 'NEXUS: matchs à corriger = %, attendu %', vus, attendus_matchs;
  end if;
  -- GARDE 2 : plus AUCUN libellé civil fusionné hors de l'ensemble (sinon il resterait).
  if exists (select 1 from public.games g where g.rseq_game_id is null and g.source_nom = 'LFMM'
                and g.id not in (select id from _m)) then
    raise exception 'NEXUS: un match LFMM échappe à la table de correspondance';
  end if;
  if exists (select 1 from public.teams t where t.league = 'LFMM' and t.id not in (select id from _eq)) then
    raise exception 'NEXUS: une équipe LFMM échappe à la table de correspondance';
  end if;
  -- GARDE 3 : la nouvelle identité ne collisionne avec rien.
  if exists (
    select 1 from (
      select t.school_id, t.sport_id, t.name, t.age_group, coalesce(e.division, t.division) d,
             t.gender, t.season, t.league, coalesce(e.zone, t.zone) z
        from public.teams t left join _eq e on e.id = t.id) k
     group by school_id, sport_id, name, age_group, d, gender, season, league, z having count(*) > 1) then
    raise exception 'NEXUS: la correction créerait un doublon d''équipe (teams_identity_unique)';
  end if;
  select count(*) into d_avant from (
    select 1 from public.teams group by school_id, sport_id, lower(btrim(name)), season, league having count(*) > 1) x;

  select jsonb_agg(jsonb_build_object('id', id, 'division', division_avant, 'zone', zone_avant) order by id) into avant_eq from _eq;
  select jsonb_agg(jsonb_build_object('id', id, 'division', division_avant, 'zone', zone_avant) order by id) into avant_m from _m;

  update public.teams t set division = e.division, zone = e.zone
    from _eq e where t.id = e.id;
  get diagnostics n_eq = row_count;
  -- games.updated_at NON touché : il nourrit « Mis à jour le » de la source
  -- (20260917203126). Corriger un libellé n'est pas une donnée rafraîchie.
  update public.games g set division = m.division, zone = m.zone
    from _m m where g.id = m.id;
  get diagnostics n_m = row_count;
  if n_eq <> 93 then raise exception 'NEXUS: % équipes réécrites, attendu 93', n_eq; end if;
  if n_m <> 358 then raise exception 'NEXUS: % matchs réécrits, attendu 358', n_m; end if;

  -- APRÈS : plus aucun libellé fusionné, et les liens match → équipe intacts.
  if exists (select 1 from public.games where source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                and (division ~* 'division|nord|sud|atome|bantam|midget|moustique|pee-wee')) then
    raise exception 'NEXUS: un libellé fusionné subsiste dans games';
  end if;
  if exists (select 1 from public.games g join public.teams t on t.id in (g.home_team_id, g.visitor_team_id)
              where g.source_nom = 'LFMM' and (t.age_group, t.division, t.zone) is distinct from (g.category, g.division, g.zone)) then
    raise exception 'NEXUS: un match LFMM ne porte plus le groupe de ses équipes';
  end if;
  select count(*) into d_apres from (
    select 1 from public.teams group by school_id, sport_id, lower(btrim(name)), season, league having count(*) > 1) x;
  if d_apres <> d_avant then raise exception 'NEXUS: doublons de nom % → %', d_avant, d_apres; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ZONE_CORRIGEE',
          'Catégorie / division / zone des données civiles (GO BP 2026-10-09, exception limitée au civil)',
          jsonb_build_object('equipes', n_eq, 'matchs', n_m, 'avant_equipes', avant_eq, 'avant_matchs', avant_m,
                             'rollback', 'scripts/civil-zone/2-rollback.sql'),
          admin);
  raise notice 'NEXUS: % équipes, % matchs corrigés', n_eq, n_m;
end $$;

commit;
