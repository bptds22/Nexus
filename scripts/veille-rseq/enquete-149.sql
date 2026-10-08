-- Les « equipe changee (RSEQ) » de la passe collégiale : que valaient les identifiants avant, et les équipes ont-elles bougé ?
with ch as (
  select c.entite_id as game_id, c.avant, g.home_rseq_team_id as h_maint, g.visitor_rseq_team_id as v_maint,
         g.home_team_id, g.visitor_team_id, g.sector, g.league_name
    from public.rseq_sync_changes c join public.games g on g.id = c.entite_id
   where c.created_at > now() - interval '40 minutes' and c.resume like 'equipe changee%'
)
select sector,
       count(*) as matchs,
       count(*) filter (where (avant->>'home_rseq_team_id') is null or (avant->>'visitor_rseq_team_id') is null) as rseq_avant_null,
       count(*) filter (where (avant->>'home_team_id') is distinct from home_team_id::text or (avant->>'visitor_team_id') is distinct from visitor_team_id::text) as equipe_nexus_changee,
       count(*) filter (where (avant->>'home_rseq_team_id') = '00000000-0000-0000-0000-000000000000' or (avant->>'visitor_rseq_team_id') = '00000000-0000-0000-0000-000000000000') as avant_uuid_nul,
       min(league_name) as exemple_ligue
  from ch group by 1;
select (avant->>'home_rseq_team_id') as home_avant, h_maint as home_maintenant, (avant->>'visitor_rseq_team_id') as vis_avant, v_maint as vis_maintenant,
       (avant->>'home_team_id') is distinct from home_team_id::text as home_equipe_changee
  from (select c.avant, g.home_rseq_team_id as h_maint, g.visitor_rseq_team_id as v_maint, g.home_team_id
          from public.rseq_sync_changes c join public.games g on g.id = c.entite_id
         where c.created_at > now() - interval '40 minutes' and c.resume like 'equipe changee%' limit 4) x;
