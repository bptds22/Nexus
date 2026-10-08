#!/bin/bash
# Complément de preuve : garde « la veille a bougé » (6b) et cohérence des liaisons par rseq_team_id.
set -u
P="psql -U supabase_admin -d nexus_copie -v ON_ERROR_STOP=1 -X -q"
echo "-- cohérence : côtés reliés dont l'équipe porte un AUTRE rseq_team_id que le match (attendu 0)"
$P -tA <<'SQL'
select (select count(*) from public.games g join public.teams t on t.id = g.home_team_id
         where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.home_rseq_team_id)
     + (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id
         where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.visitor_rseq_team_id);
SQL
echo "-- liaisons exprimées en rseq_team_id (indépendantes des uuid d'équipe), md5 :"
$P -tA -c "select md5(string_agg(coalesce(th.rseq_team_id::text, g.home_team_id::text, '-') || coalesce(tv.rseq_team_id::text, g.visitor_team_id::text, '-'), '|' order by g.id)) from public.games g left join public.teams th on th.id = g.home_team_id left join public.teams tv on tv.id = g.visitor_team_id"
echo "-- 6b. rollback Football, puis un côté de match en plus (la veille a bougé) → refus attendu, puis ré-application"
$P -f /tmp/rseq/lots/01-football.rollback.sql 2>&1 | grep -E 'NOTICE|ERROR'
$P <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR|ROLLBACK|INSERT'
begin;
insert into public.games (rseq_game_id, season, sector, phase, sport, home_rseq_team_id, home_name_raw)
values (gen_random_uuid(), '2026-2027', 'Secondaire', 'regular', 'Football', '007c4209-29af-43c5-842d-0deeb2f274ef', 'preuve dérive');
\i /tmp/rseq/lots/01-football.sql
rollback;
SQL
$P -f /tmp/rseq/lots/01-football.sql 2>&1 | grep -E 'NOTICE|ERROR'
echo "-- liaisons en rseq_team_id après ce dernier cycle, md5 (doit égaler la ligne plus haut) :"
$P -tA -c "select md5(string_agg(coalesce(th.rseq_team_id::text, g.home_team_id::text, '-') || coalesce(tv.rseq_team_id::text, g.visitor_team_id::text, '-'), '|' order by g.id)) from public.games g left join public.teams th on th.id = g.home_team_id left join public.teams tv on tv.id = g.visitor_team_id"
