-- Les côtés de l'instantané qui ont changé d'équipe après la passe : pourquoi ?
with chg as (
  select c.*, g.home_team_id, g.visitor_team_id, g.home_rseq_team_id as h_rid, g.visitor_rseq_team_id as v_rid,
         g.home_name_raw, g.visitor_name_raw, g.league_name, g.game_date, g.phase, g.updated_at
    from public._preuve_cotes c join public.games g on g.id = c.game_id
   where not exists (select 1 from public._preuve_delies d where d.game_id = c.game_id and c.cote = 'home')
     and ((c.cote = 'home' and g.home_team_id is distinct from c.team_id) or (c.cote = 'visitor' and g.visitor_team_id is distinct from c.team_id))
)
select case when (cote = 'home' and h_rid is distinct from rseq_team_id) or (cote = 'visitor' and v_rid is distinct from rseq_team_id)
            then 'le RSEQ a changé l''équipe du match (rseq_team_id du côté différent)'
            else 'même rseq_team_id, équipe différente (?)' end as cause,
       case when (cote = 'home' and home_team_id is null) or (cote = 'visitor' and visitor_team_id is null) then 'côté maintenant NULL' else 'autre équipe' end as etat,
       count(*) as cotes, min(phase) as phase_min, max(phase) as phase_max, min(game_date) as de, max(game_date) as a
  from chg group by 1, 2 order by 3 desc;
-- Exemples
select c.cote, c.rseq_team_id::text as rseq_avant, case c.cote when 'home' then g.home_rseq_team_id else g.visitor_rseq_team_id end::text as rseq_maintenant,
       case c.cote when 'home' then g.home_name_raw else g.visitor_name_raw end as nom_maintenant, t.name as equipe_avant, g.league_name, g.phase, g.game_date
  from public._preuve_cotes c join public.games g on g.id = c.game_id join public.teams t on t.id = c.team_id
 where not exists (select 1 from public._preuve_delies d where d.game_id = c.game_id and c.cote = 'home')
   and ((c.cote = 'home' and g.home_team_id is distinct from c.team_id) or (c.cote = 'visitor' and g.visitor_team_id is distinct from c.team_id))
 order by g.game_date limit 8;
