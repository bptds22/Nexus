-- Banc LOCAL du lot 1 civil : tout se passe dans UNE transaction annulée à la fin.
-- Chaque test lève « NEXUS: ÉCHEC … » s'il ne se comporte pas comme attendu.
\set ON_ERROR_STOP on
begin;

-- T1 · deux matchs SPORDLE, même clé naturelle (double programme), ids différents : admis
insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, category, division,
                          sport, source_nom, source_match_id)
values ('2026-2027', 'regular', '2027-01-10', 'TEST A', 'TEST B', 'TEST LOT1', 'U16', 'LDIR', 'Soccer', 'SPORDLE', 't1-1'),
       ('2026-2027', 'regular', '2027-01-10', 'TEST B', 'TEST A', 'TEST LOT1', 'U16', 'LDIR', 'Soccer', 'SPORDLE', 't1-2');
select 'T1 OK : double programme admis avec deux ids source';

do $t$ begin
  -- T2 · même id, même source : refusé
  begin
    insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom, source_match_id)
    values ('2026-2027', 'regular', '2027-01-11', 'X', 'Y', 'TEST LOT1', 'Soccer', 'SPORDLE', 't1-1');
    raise exception 'NEXUS: ÉCHEC T2 — id source en double admis';
  exception when unique_violation then raise notice 'T2 OK : id source en double refusé';
  end;

  -- T3 · même id sous une autre source : admis
  insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom, source_match_id)
  values ('2026-2027', 'regular', '2027-01-12', 'X', 'Y', 'TEST LOT1 MBL', 'Basketball', 'MBL', 't1-1');
  raise notice 'T3 OK : même id sous une autre source admis';

  -- T4 · civil SANS id source, clé naturelle en double : toujours refusé (protection d'avant intacte)
  insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, category, division, sport, source_nom)
  values ('2026-2027', 'regular', '2027-01-13', 'P', 'Q', 'TEST LOT1 NLS', 'Cadet', 'Gold', 'Basketball', 'NLS');
  begin
    insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, category, division, sport, source_nom)
    values ('2026-2027', 'regular', '2027-01-13', 'Q', 'P', 'TEST LOT1 NLS', 'Cadet', 'Gold', 'Basketball', 'NLS');
    raise exception 'NEXUS: ÉCHEC T4 — doublon civil sans id admis';
  exception when unique_violation then raise notice 'T4 OK : doublon civil sans id refusé';
  end;

  -- T5 · source inconnue : refusée
  begin
    insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom)
    values ('2026-2027', 'regular', '2027-01-14', 'X', 'Y', 'TEST LOT1', 'Soccer', 'XYZ');
    raise exception 'NEXUS: ÉCHEC T5 — source inconnue admise';
  exception when check_violation then raise notice 'T5 OK : source inconnue refusée';
  end;

  -- T6 · statut : REPORTE admis, autre valeur refusée
  update public.games set statut_source = 'REPORTE' where source_match_id = 't1-2';
  begin
    update public.games set statut_source = 'FOO' where source_match_id = 't1-2';
    raise exception 'NEXUS: ÉCHEC T6 — statut inconnu admis';
  exception when check_violation then raise notice 'T6 OK : REPORTE admis, statut inconnu refusé';
  end;

  -- T7 · id source sur un match RSEQ : refusé
  begin
    insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom, source_match_id)
    values ('2026-2027', 'regular', '2027-01-15', 'X', 'Y', 'TEST LOT1', 'Soccer', 'RSEQ', 't7');
    raise exception 'NEXUS: ÉCHEC T7 — id source sur RSEQ admis';
  exception when check_violation then raise notice 'T7 OK : id source refusé sur RSEQ';
  end;

  -- T8 · ON CONFLICT du script football : nouveau prédicat accepté, ancien refusé (d'où la mise à jour du script)
  insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, category, division, zone, sport, source_nom)
  values ('2026-2027', 'regular', '2027-01-13', 'Q', 'P', 'TEST LOT1 NLS', 'Cadet', 'Gold', '', 'Basketball', 'NLS')
  on conflict (league_name, season, category, division, zone, game_date,
               least(home_name_raw, visitor_name_raw), greatest(home_name_raw, visitor_name_raw))
    where rseq_game_id is null and source_match_id is null
  do nothing;
  begin
    insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, category, division, zone, sport, source_nom)
    values ('2026-2027', 'regular', '2027-01-13', 'Q', 'P', 'TEST LOT1 NLS', 'Cadet', 'Gold', '', 'Basketball', 'NLS')
    on conflict (league_name, season, category, division, zone, game_date,
                 least(home_name_raw, visitor_name_raw), greatest(home_name_raw, visitor_name_raw))
      where rseq_game_id is null
    do nothing;
    raise exception 'NEXUS: ÉCHEC T8 — l''ancien prédicat trouve encore un index';
  exception when invalid_column_reference then raise notice 'T8 OK : ON CONFLICT nouveau prédicat accepté, ancien refusé (42P10)';
  end;

  -- T9 · correspondances : unicité (source, clé), FK en cascade
  insert into public.equipes_sources (source_nom, source_cle, team_id)
  select 'SPORDLE', '999|test', id from public.teams limit 1;
  begin
    insert into public.equipes_sources (source_nom, source_cle, team_id)
    select 'SPORDLE', '999|test', id from public.teams limit 1;
    raise exception 'NEXUS: ÉCHEC T9 — correspondance en double admise';
  exception when unique_violation then null;
  end;
  insert into public.organisations_sources (source_nom, source_cle, school_id)
  select 'INVENTAIRE', 'test', id from public.schools where type = 'LIGUE_CIVILE' limit 1;
  if (select string_agg(confdeltype::text, ',' order by conrelid::regclass::text) from pg_constraint
       where contype = 'f' and conrelid in ('public.equipes_sources'::regclass, 'public.organisations_sources'::regclass)
         and confrelid in ('public.teams'::regclass, 'public.schools'::regclass)) is distinct from 'c,c' then
    raise exception 'NEXUS: ÉCHEC T9 — FK pas en cascade';
  end if;
  raise notice 'T9 OK : correspondances uniques, FK en cascade';
end $t$;

-- T10 · rôles : anon et authenticated n'ont AUCUN accès ; service_role lit
set local role authenticated;
do $t$ begin
  begin
    perform 1 from public.equipes_sources limit 1;
    raise exception 'NEXUS: ÉCHEC T10 — authenticated lit equipes_sources';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.organisations_sources limit 1;
    raise exception 'NEXUS: ÉCHEC T10 — authenticated lit organisations_sources';
  exception when insufficient_privilege then null;
  end;
end $t$;
reset role;
set local role anon;
do $t$ begin
  begin
    insert into public.equipes_sources (source_nom, source_cle, team_id) values ('SPORDLE', 'x', gen_random_uuid());
    raise exception 'NEXUS: ÉCHEC T10 — anon écrit equipes_sources';
  exception when insufficient_privilege then null;
  end;
end $t$;
reset role;
set local role service_role;
do $t$ begin
  if (select count(*) from public.equipes_sources where source_cle = '999|test') <> 1 then
    raise exception 'NEXUS: ÉCHEC T10 — service_role ne lit pas';
  end if;
  raise notice 'T10 OK : anon / authenticated refusés, service_role lit';
end $t$;
reset role;

select 'TESTS LOT 1 : 10 / 10 OK';
rollback;
select 'résidu après le banc : ' || (select count(*) from public.games where league_name like 'TEST LOT1%')
       || ' match(s), ' || (select count(*) from public.equipes_sources) || ' correspondance(s) équipe, '
       || (select count(*) from public.organisations_sources) || ' correspondance(s) organisation';
