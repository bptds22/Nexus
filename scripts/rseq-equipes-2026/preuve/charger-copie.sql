-- Charge la copie des données prod (relevé 2026-10-08) dans la base jetable nexus_copie.
-- Triggers et FK désactivés pendant le chargement (session_replication_role = replica) : on copie un état, on ne le rejoue pas.
\set ON_ERROR_STOP on
set session_replication_role = replica;
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

insert into public.sports  select (jsonb_populate_record(null::public.sports,  j)).* from raw where k = 'sports';
insert into public.schools select (jsonb_populate_record(null::public.schools, j)).* from raw where k = 'schools';
insert into public.teams   select (jsonb_populate_record(null::public.teams,   j)).* from raw where k = 'teams';
insert into public.games   select (jsonb_populate_record(null::public.games,   j)).* from raw where k = 'games';
-- Le compte qui signe admin_operations dans les lots (même id qu'en prod).
insert into public.users (id, email, role, is_platform_admin)
values ('f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'bptds22@gmail.com', 'ADMIN', true);
set session_replication_role = origin;
analyze public.sports; analyze public.schools; analyze public.teams; analyze public.games;
select 'sports', count(*) from public.sports union all select 'schools', count(*) from public.schools
union all select 'teams', count(*) from public.teams union all select 'games', count(*) from public.games
union all select 'games 2026 côtés NULL avec rseq', (select count(*) from public.games where home_team_id is null and home_rseq_team_id is not null)
                                                  + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id is not null);
