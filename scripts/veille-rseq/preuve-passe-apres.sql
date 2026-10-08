-- Preuve 4, APRÈS les passes : aucun côté de l'instantané délié ou modifié ; les 20 côtés déliés exprès sont
-- reliés de nouveau à la même équipe ; aucune équipe créée par la passe ; aucun rseq_team_id en double.
select k, v from (
select 1 o, 'côtés de l''instantané (hors 20 déliés) encore reliés à la MÊME équipe' k,
       count(*) filter (where (c.cote = 'home' and g.home_team_id = c.team_id) or (c.cote = 'visitor' and g.visitor_team_id = c.team_id))::text
       || ' / ' || count(*)::text v
  from public._preuve_cotes c join public.games g on g.id = c.game_id
 where not exists (select 1 from public._preuve_delies d where d.game_id = c.game_id and c.cote = 'home')
union all select 2, 'côtés de l''instantané déliés ou changés d''équipe',
       count(*)::text
  from public._preuve_cotes c left join public.games g on g.id = c.game_id
 where not exists (select 1 from public._preuve_delies d where d.game_id = c.game_id and c.cote = 'home')
   and (g.id is null or (c.cote = 'home' and g.home_team_id is distinct from c.team_id) or (c.cote = 'visitor' and g.visitor_team_id is distinct from c.team_id))
union all select 3, 'côtés déliés exprès, reliés de nouveau à la même équipe',
       count(*) filter (where g.home_team_id = d.team_id)::text || ' / ' || count(*)::text
  from public._preuve_delies d join public.games g on g.id = d.game_id
union all select 4, 'équipes au total', count(*)::text from public.teams
union all select 5, 'rseq_team_id en double dans teams', (select count(*) from (select rseq_team_id from public.teams where rseq_team_id is not null group by 1 having count(*) > 1) x)::text
union all select 6, 'côtés NULL portant le rseq d''une équipe des lots (doit être 0)',
       ((select count(*) from public.games g join public._preuve_lots_ids l on l.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null)
      + (select count(*) from public.games g join public._preuve_lots_ids l on l.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null))::text
union all select 7, 'côtés reliés aux équipes des lots, maintenant (≥ instantané si de nouveaux matchs sont publiés)',
       ((select count(*) from public.games g join public.teams t on t.id = g.home_team_id join public._preuve_lots_ids l on l.rseq_team_id = t.rseq_team_id)
      + (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id join public._preuve_lots_ids l on l.rseq_team_id = t.rseq_team_id))::text
union all select 8, 'matchs 2026 au total', count(*)::text from public.games where season = '2026-2027'
) x order by o;
