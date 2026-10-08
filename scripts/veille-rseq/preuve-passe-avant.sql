-- Preuve 4, AVANT les passes (nexus_copie seulement) : instantané des côtés de match reliés aux équipes des lots.
drop table if exists public._preuve_lots_ids, public._preuve_cotes, public._preuve_delies;
create table public._preuve_lots_ids as
  select distinct (jsonb_array_elements_text(details->'rseq_team_ids'))::uuid as rseq_team_id
    from public.admin_operations where operation = 'EQUIPES_RSEQ_2026_CREEES';
create table public._preuve_cotes as
  select g.id as game_id, 'home' as cote, g.home_team_id as team_id, g.home_rseq_team_id as rseq_team_id
    from public.games g join public.teams t on t.id = g.home_team_id join public._preuve_lots_ids l on l.rseq_team_id = t.rseq_team_id
  union all
  select g.id, 'visitor', g.visitor_team_id, g.visitor_rseq_team_id
    from public.games g join public.teams t on t.id = g.visitor_team_id join public._preuve_lots_ids l on l.rseq_team_id = t.rseq_team_id;
-- Test de RELIAISON : 20 côtés domicile reliés à une équipe des lots, déliés exprès dans la COPIE.
-- La passe doit les relier de nouveau, par rseq_team_id, à la MÊME équipe.
create table public._preuve_delies as
  select c.game_id, c.team_id from public._preuve_cotes c join public.games g on g.id = c.game_id
   where c.cote = 'home' and g.season = '2026-2027' and g.sector = 'Secondaire'
   order by c.game_id limit 20;
update public.games g set home_team_id = null from public._preuve_delies d where g.id = d.game_id;
select 'équipes des lots' k, count(*)::text v from public._preuve_lots_ids
union all select 'côtés reliés aux équipes des lots (instantané)', count(*)::text from public._preuve_cotes
union all select 'côtés déliés exprès pour le test', count(*)::text from public._preuve_delies
union all select 'équipes au total', count(*)::text from public.teams
union all select 'rseq_team_id en double dans teams', (select count(*) from (select rseq_team_id from public.teams where rseq_team_id is not null group by 1 having count(*) > 1) x)::text
union all select 'matchs 2026 au total', count(*)::text from public.games where season = '2026-2027';
