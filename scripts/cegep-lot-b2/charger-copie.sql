-- Lot B2 cégep — charge dans la base jetable nexus_b2 la copie LECTURE SEULE des tables publiques RSEQ de la
-- prod (export REST GET du 2026-10-26, aucune table personnelle). Les comptes et données personnelles des preuves
-- sont des fixtures locales (fixtures-locales.sql). Triggers et FK coupés pendant le chargement : on copie un
-- état, on ne le rejoue pas.
\set ON_ERROR_STOP 1
set session_replication_role = replica;
truncate public.games, public.rseq_standings, public.rseq_sync_alerts, public.teams, public.schools, public.sports,
         public.rseq_watch_leagues, public.lieux_geocodes, public.rseq_ligues_publiees cascade;
create temp table raw (k text, j jsonb);
create temp table ligne (t text);
\copy ligne from '/tmp/copie/sports.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'sports', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/schools.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'schools', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/teams.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'teams', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/games.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'games', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/rseq_sync_alerts.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'rseq_sync_alerts', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/rseq_watch_leagues.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'rseq_watch_leagues', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/rseq_standings.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'rseq_standings', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/lieux_geocodes.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'lieux_geocodes', t::jsonb from ligne; truncate ligne;
\copy ligne from '/tmp/copie/rseq_ligues_publiees.ndjson' with (format csv, quote e'\x01', delimiter e'\x02')
insert into raw select 'rseq_ligues_publiees', t::jsonb from ligne; truncate ligne;

insert into public.sports               select (jsonb_populate_record(null::public.sports, j)).* from raw where k = 'sports';
insert into public.schools              select (jsonb_populate_record(null::public.schools, j)).* from raw where k = 'schools';
insert into public.teams                select (jsonb_populate_record(null::public.teams, j)).* from raw where k = 'teams';
insert into public.games                select (jsonb_populate_record(null::public.games, j)).* from raw where k = 'games';
insert into public.rseq_sync_alerts     select (jsonb_populate_record(null::public.rseq_sync_alerts, j)).* from raw where k = 'rseq_sync_alerts';
insert into public.rseq_watch_leagues   select (jsonb_populate_record(null::public.rseq_watch_leagues, j)).* from raw where k = 'rseq_watch_leagues';
insert into public.rseq_standings       select (jsonb_populate_record(null::public.rseq_standings, j)).* from raw where k = 'rseq_standings';
insert into public.lieux_geocodes       select (jsonb_populate_record(null::public.lieux_geocodes, j)).* from raw where k = 'lieux_geocodes';
insert into public.rseq_ligues_publiees select (jsonb_populate_record(null::public.rseq_ligues_publiees, j)).* from raw where k = 'rseq_ligues_publiees';
set session_replication_role = origin;
analyze public.sports; analyze public.schools; analyze public.teams; analyze public.games; analyze public.rseq_standings;
analyze public.rseq_sync_alerts;

select 'sports' t, count(*) from public.sports union all select 'schools', count(*) from public.schools
union all select 'teams', count(*) from public.teams union all select 'games', count(*) from public.games
union all select 'rseq_sync_alerts', count(*) from public.rseq_sync_alerts union all select 'rseq_standings', count(*) from public.rseq_standings
union all select 'rseq_watch_leagues', count(*) from public.rseq_watch_leagues union all select 'lieux_geocodes', count(*) from public.lieux_geocodes
union all select 'rseq_ligues_publiees', count(*) from public.rseq_ligues_publiees
union all select 'les 256 (CEGEP, age_group NULL)', count(*) from public.teams t join public.schools s on s.id = t.school_id
                                                     where s.type::text = 'CEGEP' and t.age_group is null;
select md5(string_agg(t.id::text, ',' order by t.id)) as empreinte_256
  from public.teams t join public.schools s on s.id = t.school_id where s.type::text = 'CEGEP' and t.age_group is null;
