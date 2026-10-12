-- ============================================================================
-- NLS Premier League (No Limits Showcases) — basketball, saison 2026-2027 — ESSAI À BLANC — LOCAL SEULEMENT
-- Généré par scripts/plan-nls-basketball-teams.mjs depuis data/nls/NLS_S02_equipes.csv.
-- TEXTE À RELIRE — NE PAS APPLIQUER EN PROD SANS LE GO DE BP.
-- ============================================================================
-- Passage, relance, contrôle des doublons, rollback, puis ROLLBACK de tout :
-- rien ne reste en base, pas même la ligne de journal.
-- docker cp scripts/nls-basketball supabase_db_Nexus:/tmp/nls
-- docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -f /tmp/nls/0-essai-local.sql
\set ON_ERROR_STOP on
begin;
\echo '=== avant'
select (select count(*) from public.teams where league = 'No Limits Showcases' and season = '2026-2027') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;
\echo '=== passage 1 : attendu 107 équipes'
\i /tmp/nls/1-creer.sql
select (select count(*) from public.teams where league = 'No Limits Showcases' and season = '2026-2027') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;
\echo '=== relance : attendu 0 ajout, 0 club, 0 ligne de journal'
\i /tmp/nls/1-creer.sql
select (select count(*) from public.teams where league = 'No Limits Showcases' and season = '2026-2027') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;
\echo '=== doublons sur la clé d identité (attendu : aucune ligne)'
select school_id, name, age_group, division, gender, count(*) from public.teams
 where league = 'No Limits Showcases' group by 1, 2, 3, 4, 5 having count(*) > 1;
\echo '=== groupes'
select age_group, gender, nullif(division, '') as division, count(*) from public.teams
 where league = 'No Limits Showcases' group by 1, 2, 3 order by 1, 2, 3;
\echo '=== rollback : attendu 0 équipe NLS, clubs civils revenus au compte d avant'
\i /tmp/nls/2-rollback.sql
select (select count(*) from public.teams where league = 'No Limits Showcases' and season = '2026-2027') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;
rollback;
\echo '=== après ROLLBACK de la transaction d essai'
select (select count(*) from public.teams where league = 'No Limits Showcases' and season = '2026-2027') as equipes_nls,
       (select count(*) from public.schools where type = 'LIGUE_CIVILE') as clubs_civils,
       (select count(*) from public.admin_operations where operation like 'NLS_%') as journal_nls;
