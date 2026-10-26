-- Le rollback du lot 2 doit REFUSER dès qu'une équipe vise une organisation créée.
-- Tout dans une transaction : l'erreur attendue l'annule, l'équipe de test ne reste pas.
\set ON_ERROR_STOP on
begin;
insert into public.teams (school_id, sport_id, name)
select (jsonb_array_elements_text(o.details->'nouvelles_ids'))::uuid, (select id from public.sports where nom = 'Soccer'), 'TEST LOT2'
  from public.admin_operations o where o.operation = 'CIVIL_ORGANISATIONS_CREEES' order by o.le desc limit 1;
\ir ../lot2/2-rollback.sql
select 'NEXUS: ÉCHEC — le rollback est passé malgré une équipe';
rollback;
