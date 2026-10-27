-- Preuve à blanc (LOCAL) : où une équipe is_active = false apparaît-elle ?
-- Une équipe sonde INACTIVE est créée sous « Lakeshore SC » (soccer, U15), avec un match civil ;
-- chaque forme de lecture du code est rejouée sous le rôle authenticated (RLS active), avec les
-- claims d'un vrai compte local. Tout est ANNULÉ à la fin : rien ne reste.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
begin;
create temp table sonde as
  select gen_random_uuid() as id, s.id as school_id, (select id from public.sports where nom = 'Soccer') as sport_id
    from public.schools s where s.name = 'Lakeshore SC' and s.type = 'LIGUE_CIVILE';
insert into public.teams (id, school_id, sport_id, name, age_group, division, gender, season, is_active, zone)
select id, school_id, sport_id, 'ZZ SONDE INACTIVE', 'U15', 'LDIR', 'Masculin', '2026-2027', false, '' from sonde;
insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom,
                          source_match_id, home_team_id)
select '2026-2027', 'regular', current_date + 7, 'ZZ SONDE INACTIVE', 'ADVERSAIRE', 'TEST SONDE', 'Soccer', 'SPORDLE',
       'sonde-inactive', id from sonde;
grant select on sonde to authenticated;

-- Lecteur : un recruteur local (les cartes / prospects) — la RLS « civil discoverable » vaut pour tout authentifié
select set_config('request.jwt.claims', json_build_object('sub', '9d70e6a3-66a2-4660-858e-9d1c8f8cda85', 'role', 'authenticated')::text, true);
set local role authenticated;

select 'A  sélecteur civil de l''athlète (onboarding web/mobile : school+sport+is_active) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.sport_id = z.sport_id
                              and t.is_active = true and t.id = z.id) then 'VISIBLE' else 'absente' end;
select 'B  UmbrellaStep (onboarding coach civil web : school+sport, sans is_active) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.sport_id = z.sport_id
                              and t.id = z.id) then 'VISIBLE' else 'absente' end;
select 'C  sélecteurs d''équipe des cartes recruteur / partenaire (CreerCarte, ModifierCarte, PanneauCarte, FormulaireCarte, CreerProspectMobile) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.sport_id = z.sport_id
                              and t.id = z.id) then 'VISIBLE' else 'absente' end;
select 'D  transferts coach (transferAthletes : school seul) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.id = z.id)
               then 'VISIBLE' else 'absente' end;
select 'E  grille de la page d''organisation (schoolPageData : school seul) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.id = z.id)
               then 'VISIBLE' else 'absente' end;
select 'F  page d''équipe par id (TeamPageMobile / loadForRender) : '
       || case when exists (select 1 from public.teams t, sonde z where t.id = z.id) then 'VISIBLE' else 'absente' end;
select 'G  RPC teams_par_ids (calendrier recruteur, équipes du coach) : '
       || case when exists (select 1 from public.teams_par_ids((select array_agg(id) from sonde)) r) then 'VISIBLE' else 'absente' end;
select 'H  match de l''équipe inactive lu directement (pages d''équipe, Game On : games + teams) : '
       || case when exists (select 1 from public.games g join public.teams t on t.id = g.home_team_id, sonde z
                             where t.id = z.id) then 'VISIBLE' else 'absente' end;
reset role;

-- Lecteur : un athlète local (aucune organisation commune avec la sonde)
select set_config('request.jwt.claims', json_build_object('sub', 'eeeeeeee-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select 'I  même lecture school+sport, compte athlète (RLS seule, sans filtre de code) : '
       || case when exists (select 1 from public.teams t, sonde z where t.school_id = z.school_id and t.sport_id = z.sport_id
                              and t.id = z.id) then 'VISIBLE' else 'absente' end;
reset role;

-- Code d'adhésion : resolve_team_join_token est le SEUL lecteur par code qui teste is_active
select 'J  resolve_team_join_token filtre is_active (corps de la fonction) : '
       || (select (prosrc ~* 't_active')::text from pg_proc where proname = 'resolve_team_join_token');
rollback;
select 'résidu : ' || (select count(*) from public.teams where name = 'ZZ SONDE INACTIVE') || ' équipe, '
       || (select count(*) from public.games where league_name = 'TEST SONDE') || ' match';
