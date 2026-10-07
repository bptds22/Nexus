-- Nettoyage du scénario LOCAL du lot 2 (scripts/lot2-tableau-blanc-scenario.sql).
-- Retire ce que Rémi (r3) et Robin (r1) ont écrit sur Liam pendant les preuves.
-- Le journal d'activité (recruiter_activity_log) garde ses lignes : trace locale.
\set ON_ERROR_STOP 1
begin;
delete from recruiter_list_members where list_id in (select id from recruiter_lists where name like 'Liste de Rémi — preuve lot 2');
delete from recruiter_lists where name like 'Liste de Rémi — preuve lot 2';
delete from recruiter_notes where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
  and recruiter_id in ('22222222-0000-0000-0000-00000000003a', '22222222-0000-0000-0000-00000000000a');
delete from recruiter_favorites where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
  and recruiter_id in ('22222222-0000-0000-0000-00000000003a', '22222222-0000-0000-0000-00000000000a');
delete from recruiter_pipeline where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
  and recruiter_id in ('22222222-0000-0000-0000-00000000003a', '22222222-0000-0000-0000-00000000000a');
delete from recruiter_athlete_grades where athlete_id = 'ffffffff-0000-0000-0000-000000000006'
  and recruiter_id in ('22222222-0000-0000-0000-00000000003a', '22222222-0000-0000-0000-00000000000a');
commit;
select (select count(*) from recruiter_pipeline where athlete_id = 'ffffffff-0000-0000-0000-000000000006') pipeline,
       (select count(*) from recruiter_favorites where athlete_id = 'ffffffff-0000-0000-0000-000000000006') favoris,
       (select count(*) from recruiter_lists where name like 'Liste de Rémi%') listes;
