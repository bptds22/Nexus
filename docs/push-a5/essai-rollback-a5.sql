-- Rollback A5 en local : migration, rollback, comparaison à l'état A4a. Transaction ANNULÉE.
--   docker cp ... rollback-corps.sql supabase_db_Nexus:/tmp/a5-rb.sql ; psql -f /tmp/essai-rollback-a5.sql
\set ON_ERROR_STOP 1
begin;
create temp table _avant as
  select p.proname, md5(p.prosrc) as m, p.proacl::text as acl from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'push%';
create temp table _check_avant as
  select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'athlete_notifications_type_check';
\i /tmp/a5.sql
select 'apres_migration', count(*) from pg_proc where proname = 'push_destination';
\i /tmp/a5-rb.sql
select 'fonctions_identiques_a_A4a', (select count(*) from _avant) as avant,
       (select count(*) from _avant a join pg_proc p on p.proname = a.proname and p.pronamespace = 'public'::regnamespace
         where md5(p.prosrc) = a.m and p.proacl::text is not distinct from a.acl) as identiques,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'push%') as maintenant;
select 'contrainte', (select d from _check_avant) = (select pg_get_constraintdef(oid) from pg_constraint where conname = 'athlete_notifications_type_check'),
       (select convalidated from pg_constraint where conname = 'athlete_notifications_type_check');
rollback;
