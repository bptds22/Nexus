-- Lecture seule : côtés de match reliés à une équipe dont le rseq_team_id diffère de games.*_rseq_team_id.
-- Sortie : un tableau JSON (une ligne) à donner à generer-reparation.mjs.
select coalesce(json_agg(x order by x.game_id, x.cote), '[]'::json) from (
  select g.id as game_id, 'home' as cote, g.rseq_game_id, g.rseq_league_id, g.league_name, g.home_name_raw as nom_raw,
         t.id as team_id, t.name as team_name, t.rseq_team_id as team_rseq, g.home_rseq_team_id as rseq_colonne
    from public.games g join public.teams t on t.id = g.home_team_id
   where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.home_rseq_team_id
  union all
  select g.id, 'visitor', g.rseq_game_id, g.rseq_league_id, g.league_name, g.visitor_name_raw,
         t.id, t.name, t.rseq_team_id, g.visitor_rseq_team_id
    from public.games g join public.teams t on t.id = g.visitor_team_id
   where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.visitor_rseq_team_id
) x;
