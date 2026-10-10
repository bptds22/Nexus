-- Correction catégorie / division / zone des données CIVILES (BP 2026-10-09, règle révisée).
-- Exception à la règle du 2026-09-05 (« la normalisation est en lecture »), LIMITÉE aux
-- données civiles par décision BP. Prérequis : migration 20261010022425_civil_zone.
--
-- Règle : catégorie = le nom que la LIGUE donne à son groupe, calibre compris (« Pee-Wee AAA »,
-- « Bantam AAA », « Midget AAA » — la LFMM les nomme ainsi —, « Junior Majeur », « M18 AAA »,
-- « Atome ») ; division = D1…D4 ou vide ; zone (Nord/Sud) à part.
-- L'équipe de club SANS ligue (« ∅ », Midget « Division 1 », saison 2025-2026) n'a pas de
-- nom de ligue à suivre : elle garde « Midget ».
--
-- Ce qui est réécrit, et rien d'autre :
--   · teams.age_group / division / zone des équipes civiles :
--       a) ligues LFMM, QBFL, QMFL, QMJFL — table ci-dessous, identique au classeur
--          lib/civil/classementCivil.ts (test : lib/civil/__tests__/zoneSurfaces.test.ts) ;
--       b) hockey « M18 AAA » : M18 / « AAA Civil — Élite » → M18 AAA / vide ;
--       c) « Division N » saisi par un coach sur une équipe de club civil sans ligue → DN.
--          Les deux équipes rattachées à l'« école » RSEQ sont EXCLUES (BP : on n'y touche pas).
--   · games.category / division / zone des matchs civils (source_nom LFMM/QBFL/QMFL/QMJFL).
--
-- TRANSACTION GARDÉE. L'ensemble à réécrire est recompté groupe par groupe et comparé
-- COMPLÈTEMENT à la liste attendue (relevé prod 2026-10-09) ; tout écart → exception, rien
-- n'est écrit. Aucun doublon d'identité possible (vérifié avant ET après).
-- L'état AVANT de chaque ligne est gardé dans admin_operations.details : le rollback
-- (2-rollback.sql) le repose à l'identique. games.updated_at n'est PAS touché : il nourrit
-- « Mis à jour le » de la source (20260917203126) ; corriger un libellé n'est pas une
-- donnée rafraîchie.
begin;

do $$
declare
  admin uuid;
  vus text[];
  attendus text[] := array[
    -- ligue | catégorie AVANT | division AVANT | nb ÉQUIPES   (relevé prod 2026-10-09)
    'LFMM|Atome|Atome Nord|8', 'LFMM|Atome|Atome Sud|8',
    'LFMM|Bantam|Bantam — Division 1|8', 'LFMM|Bantam|Bantam — Division 2|5',
    'LFMM|Midget|Division 2|1',
    'LFMM|Midget|Midget — Division 1|9', 'LFMM|Midget|Midget — Division 2|4',
    'LFMM|Moustique|Moustique AAA — Division 1 Nord|8', 'LFMM|Moustique|Moustique AAA — Division 1 Sud|8',
    'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Nord|8', 'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Sud|10',
    'QBFL|Bantam|AAA|7', 'QMFL|Midget|AAA|12', 'QMJFL|Junior|Majeur|4',
    'M18 AAA|M18|AAA Civil — Élite|15',
    '∅|Midget|Division 1|1'
  ];
  attendus_matchs text[] := array[
    -- ligue | catégorie AVANT | division AVANT | nb MATCHS
    'LFMM|Atome|Atome Nord|40', 'LFMM|Atome|Atome Sud|40',
    'LFMM|Bantam|Bantam — Division 1|32', 'LFMM|Bantam|Bantam — Division 2|20',
    'LFMM|Midget|Midget — Division 1|36', 'LFMM|Midget|Midget — Division 2|20',
    'LFMM|Moustique|Moustique AAA — Division 1 Nord|40', 'LFMM|Moustique|Moustique AAA — Division 1 Sud|40',
    'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Nord|40', 'LFMM|Pee-Wee|Pee-Wee AAA — Division 1 Sud|50',
    'QBFL|Bantam|AAA|28', 'QMFL|Midget|AAA|48', 'QMJFL|Junior|Majeur|12'
  ];
  n_eq int; n_m int; d_avant int; d_apres int;
  avant_eq jsonb; avant_m jsonb;
begin
  select id into admin from public.users where email = 'bptds22@gmail.com';
  if admin is null then raise exception 'NEXUS: compte admin introuvable'; end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'teams' and column_name = 'zone') then
    raise exception 'NEXUS: migration 20261010022425_civil_zone absente';
  end if;

  -- La table de correspondance : (ligue, catégorie AVANT, division AVANT) → (catégorie, division, zone).
  create temp table _carte(ligue text, age_avant text, division_avant text, age text, division text, zone text) on commit drop;
  insert into _carte values
    ('LFMM', 'Atome', 'Atome Nord', 'Atome', '', 'Nord'),
    ('LFMM', 'Atome', 'Atome Sud', 'Atome', '', 'Sud'),
    ('LFMM', 'Bantam', 'Bantam — Division 1', 'Bantam AAA', 'D1', ''),
    ('LFMM', 'Bantam', 'Bantam — Division 2', 'Bantam AAA', 'D2', ''),
    ('LFMM', 'Midget', 'Midget — Division 1', 'Midget AAA', 'D1', ''),
    ('LFMM', 'Midget', 'Midget — Division 2', 'Midget AAA', 'D2', ''),
    ('LFMM', 'Midget', 'Division 2', 'Midget AAA', 'D2', ''),
    ('LFMM', 'Moustique', 'Moustique AAA — Division 1 Nord', 'Moustique AAA', 'D1', 'Nord'),
    ('LFMM', 'Moustique', 'Moustique AAA — Division 1 Sud', 'Moustique AAA', 'D1', 'Sud'),
    ('LFMM', 'Pee-Wee', 'Pee-Wee AAA — Division 1 Nord', 'Pee-Wee AAA', 'D1', 'Nord'),
    ('LFMM', 'Pee-Wee', 'Pee-Wee AAA — Division 1 Sud', 'Pee-Wee AAA', 'D1', 'Sud'),
    ('QBFL', 'Bantam', 'AAA', 'Bantam AAA', '', ''),
    ('QMFL', 'Midget', 'AAA', 'Midget AAA', '', ''),
    ('QMJFL', 'Junior', 'Majeur', 'Junior Majeur', '', ''),
    ('M18 AAA', 'M18', 'AAA Civil — Élite', 'M18 AAA', '', ''),
    ('∅', 'Midget', 'Division 1', 'Midget', 'D1', '');

  create temp table _eq on commit drop as
  select t.id, coalesce(t.league, '∅') as ligue, t.age_group as age_avant, t.division as division_avant,
         t.zone as zone_avant, c.age, c.division, c.zone
    from public.teams t
    join public.schools s on s.id = t.school_id and s.type = 'LIGUE_CIVILE' and s.name <> 'RSEQ'
    join _carte c on c.ligue = coalesce(t.league, '∅') and c.age_avant = t.age_group and c.division_avant = t.division
   where t.rseq_team_id is null
     and (t.league in ('LFMM', 'QBFL', 'QMFL', 'QMJFL', 'M18 AAA') or t.league is null);

  create temp table _m on commit drop as
  select g.id, g.league_name as ligue, g.category as age_avant, g.division as division_avant, g.zone as zone_avant,
         c.age, c.division, c.zone
    from public.games g
    join _carte c on c.ligue = g.league_name and c.age_avant = g.category and c.division_avant = g.division
   where g.rseq_game_id is null and g.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL');

  -- GARDE 1 : l'ensemble, groupe par groupe, comparé COMPLÈTEMENT (jamais par inclusion).
  select array_agg(x order by x) into vus from (
    select ligue || '|' || age_avant || '|' || division_avant || '|' || count(*) as x
      from _eq group by ligue, age_avant, division_avant) z;
  if vus is distinct from (select array_agg(x order by x) from unnest(attendus) x) then
    raise exception 'NEXUS: équipes à corriger = %, attendu %', vus, attendus;
  end if;
  select array_agg(x order by x) into vus from (
    select ligue || '|' || age_avant || '|' || division_avant || '|' || count(*) as x
      from _m group by ligue, age_avant, division_avant) z;
  if vus is distinct from (select array_agg(x order by x) from unnest(attendus_matchs) x) then
    raise exception 'NEXUS: matchs à corriger = %, attendu %', vus, attendus_matchs;
  end if;
  -- GARDE 2 : aucune ligne civile n'échappe à la table (sinon un libellé fusionné resterait).
  if exists (select 1 from public.games g where g.rseq_game_id is null
                and g.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL') and g.id not in (select id from _m)) then
    raise exception 'NEXUS: un match civil échappe à la table de correspondance';
  end if;
  if exists (select 1 from public.teams t where t.league in ('LFMM', 'QBFL', 'QMFL', 'QMJFL', 'M18 AAA')
                and t.id not in (select id from _eq)) then
    raise exception 'NEXUS: une équipe civile de ligue échappe à la table de correspondance';
  end if;
  -- GARDE 3 : la nouvelle identité ne collisionne avec rien — avec la RÈGLE DE LA CONTRAINTE :
  -- un UNIQUE Postgres tient deux NULL pour distincts, donc un groupe dont une colonne de clé
  -- est NULL ne collisionne jamais ; et seul compte un groupe qui touche une ligne corrigée.
  -- (Version précédente : GROUP BY sur tout teams → refus en prod le 2026-10-09 sur 82
  -- groupes RSEQ à league NULL déjà présents, hors correction ; rien n'avait été écrit.)
  if exists (
    select 1 from (
      select t.school_id, t.sport_id, t.name, coalesce(e.age, t.age_group) a, coalesce(e.division, t.division) d,
             t.gender, t.season, t.league, coalesce(e.zone, t.zone) z, e.id is not null as visee
        from public.teams t left join _eq e on e.id = t.id) k
     where a is not null and d is not null and gender is not null and season is not null and league is not null
     group by school_id, sport_id, name, a, d, gender, season, league, z having count(*) > 1 and bool_or(visee)) then
    raise exception 'NEXUS: la correction créerait un doublon d''équipe (teams_identity_unique)';
  end if;
  if exists (
    select 1 from (
      select g.league_name, g.season, coalesce(m.age, g.category) c, coalesce(m.division, g.division) d,
             coalesce(m.zone, g.zone) z, g.game_date,
             least(g.home_name_raw, g.visitor_name_raw) a, greatest(g.home_name_raw, g.visitor_name_raw) b,
             m.id is not null as visee
        from public.games g left join _m m on m.id = g.id where g.rseq_game_id is null) k
     where league_name is not null and season is not null and c is not null and d is not null and a is not null and b is not null
     group by league_name, season, c, d, z, game_date, a, b having count(*) > 1 and bool_or(visee)) then
    raise exception 'NEXUS: la correction créerait un doublon de match (games_identite_civile)';
  end if;
  select count(*) into d_avant from (
    select 1 from public.teams group by school_id, sport_id, lower(btrim(name)), season, league having count(*) > 1) x;

  select jsonb_agg(jsonb_build_object('id', id, 'age_group', age_avant, 'division', division_avant, 'zone', zone_avant) order by id)
    into avant_eq from _eq;
  select jsonb_agg(jsonb_build_object('id', id, 'category', age_avant, 'division', division_avant, 'zone', zone_avant) order by id)
    into avant_m from _m;

  update public.teams t set age_group = e.age, division = e.division, zone = e.zone
    from _eq e where t.id = e.id;
  get diagnostics n_eq = row_count;
  update public.games g set category = m.age, division = m.division, zone = m.zone
    from _m m where g.id = m.id;
  get diagnostics n_m = row_count;
  if n_eq <> 116 then raise exception 'NEXUS: % équipes réécrites, attendu 116', n_eq; end if;
  if n_m <> 446 then raise exception 'NEXUS: % matchs réécrits, attendu 446', n_m; end if;

  -- APRÈS : division = D1…D4 ou vide, et chaque match porte le groupe de ses équipes.
  if exists (select 1 from public.games where source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                and division not in ('', 'D1', 'D2', 'D3', 'D4')) then
    raise exception 'NEXUS: une division civile hors D1…D4 subsiste dans games';
  end if;
  if exists (select 1 from public.teams t join _eq e on e.id = t.id where t.division not in ('', 'D1', 'D2', 'D3', 'D4')) then
    raise exception 'NEXUS: une division civile hors D1…D4 subsiste dans teams';
  end if;
  if exists (select 1 from public.games g join public.teams t on t.id in (g.home_team_id, g.visitor_team_id)
              where g.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                and (t.age_group, t.division, t.zone) is distinct from (g.category, g.division, g.zone)) then
    raise exception 'NEXUS: un match civil ne porte plus le groupe de ses équipes';
  end if;
  select count(*) into d_apres from (
    select 1 from public.teams group by school_id, sport_id, lower(btrim(name)), season, league having count(*) > 1) x;
  if d_apres <> d_avant then raise exception 'NEXUS: doublons de nom % → %', d_avant, d_apres; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CIVIL_ZONE_CORRIGEE',
          'Catégorie (âge + calibre) / division / zone des données civiles (GO BP 2026-10-09, exception limitée au civil)',
          jsonb_build_object('equipes', n_eq, 'matchs', n_m, 'avant_equipes', avant_eq, 'avant_matchs', avant_m,
                             'rollback', 'scripts/civil-zone/2-rollback.sql'),
          admin);
  raise notice 'NEXUS: % équipes, % matchs corrigés', n_eq, n_m;
end $$;

commit;
