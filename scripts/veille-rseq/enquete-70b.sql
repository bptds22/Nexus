-- Hypothèse : le RSEQ a changé l'équipe de ces matchs ; la passe a suivi (team_id = équipe du nom servi),
-- mais games.home/visitor_rseq_team_id n'est jamais réécrit par rseq_sync_apply_games (absent de son DO UPDATE).
with chg as (
  select c.cote, c.team_id as avant, case c.cote when 'home' then g.home_team_id else g.visitor_team_id end as maintenant,
         case c.cote when 'home' then g.home_rseq_team_id else g.visitor_rseq_team_id end as rseq_colonne,
         case c.cote when 'home' then g.home_name_raw else g.visitor_name_raw end as nom_servi
    from public._preuve_cotes c join public.games g on g.id = c.game_id
   where not exists (select 1 from public._preuve_delies d where d.game_id = c.game_id and c.cote = 'home')
     and ((c.cote = 'home' and g.home_team_id is distinct from c.team_id) or (c.cote = 'visitor' and g.visitor_team_id is distinct from c.team_id))
)
select count(*) as cotes,
       count(*) filter (where tm.rseq_team_id is distinct from chg.rseq_colonne) as rseq_colonne_perimee,
       count(*) filter (where lower(tm.name) = lower(chg.nom_servi)) as equipe_actuelle_porte_le_nom_servi,
       count(*) filter (where ta.rseq_team_id = chg.rseq_colonne) as equipe_avant_portait_ce_rseq,
       count(*) filter (where tm.id is null) as maintenant_null
  from chg left join public.teams tm on tm.id = chg.maintenant left join public.teams ta on ta.id = chg.avant;
-- Le même défaut, déjà présent avant toute passe locale (instantané de la copie = prod du 2026-10-08) :
select count(*) as cotes_incoherents_aujourd_hui
  from (select g.home_team_id t, g.home_rseq_team_id r from public.games g where g.home_team_id is not null
        union all select g.visitor_team_id, g.visitor_rseq_team_id from public.games g where g.visitor_team_id is not null) x
  join public.teams t on t.id = x.t where t.rseq_team_id is not null and t.rseq_team_id is distinct from x.r;
