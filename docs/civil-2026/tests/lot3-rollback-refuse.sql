-- Le rollback du lot 3 doit REFUSER dès qu'une ligne vise une équipe créée (ici : un match).
\set ON_ERROR_STOP on
begin;
insert into public.games (season, phase, game_date, home_name_raw, visitor_name_raw, league_name, sport, source_nom,
                          source_match_id, home_team_id)
select '2026-2027', 'regular', '2027-01-20', 'TEST LOT3 A', 'TEST LOT3 B', 'TEST LOT3', 'Soccer', 'SPORDLE', 'test-lot3',
       (jsonb_array_elements_text(o.details->'ids'))::uuid
  from public.admin_operations o where o.operation = 'CIVIL_EQUIPES_MOINS18_CREEES' order by o.le desc limit 1;
\ir ../lot3/2-rollback.sql
select 'NEXUS: ÉCHEC — le rollback est passé malgré un match';
rollback;
