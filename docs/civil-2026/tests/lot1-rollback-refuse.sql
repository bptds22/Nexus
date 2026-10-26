-- Le rollback doit REFUSER quand une correspondance existe. Tout est dans une transaction :
-- l'erreur attendue l'annule, rien ne reste.
\set ON_ERROR_STOP on
begin;
insert into public.equipes_sources (source_nom, source_cle, team_id)
select 'SPORDLE', 'refus|test', id from public.teams limit 1;
\ir ../../../supabase/rollback/20261026210000_rollback_civil_sources_lot1.sql
select 'NEXUS: ÉCHEC — le rollback est passé malgré une correspondance';
rollback;
