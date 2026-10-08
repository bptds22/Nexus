-- Empreintes : équipes existantes, matchs hors colonnes de liaison, liaisons, admin_operations.
select 'equipes_total' k, count(*)::text v from public.teams
union all select 'equipes_existantes_md5', md5(string_agg(t::text, '|' order by t.id)) from public.teams t join public._preuve_existantes e using (id)
union all select 'matchs_total', count(*)::text from public.games
union all select 'matchs_hors_liaison_md5', md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from public.games g
union all select 'liaisons_md5', md5(string_agg(coalesce(g.home_team_id::text, '-') || coalesce(g.visitor_team_id::text, '-'), '|' order by g.id)) from public.games g
union all select 'cotes_null_avec_rseq', ((select count(*) from public.games where home_team_id is null and home_rseq_team_id is not null)
                                        + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id is not null))::text
union all select 'admin_operations', count(*)::text from public.admin_operations
order by 1;
