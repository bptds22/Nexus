with app_ids as (select distinct (jsonb_array_elements_text(details->'rseq_team_ids'))::uuid r from admin_operations where operation='EQUIPES_RSEQ_2026_CREEES' and details->>'lot' = '09-ultimate-frisbee'),
pref(p) as (select unnest(string_to_array('', ',')))
select 'equipes_total' k, count(*)::text v from teams
union all select 'equipes_md5_hors_lots_crees', md5(string_agg(t::text, '|' order by t.id)) from teams t where t.id not in (select t2.id from teams t2 join (select (jsonb_array_elements_text(details->'rseq_team_ids'))::uuid r from admin_operations where operation='EQUIPES_RSEQ_2026_CREEES') a on a.r=t2.rseq_team_id)
union all select 'matchs_hors_liaison_md5', md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from games g
union all select 'admin_operations', count(*)::text from admin_operations
union all select 'notifications_unite', count(*)::text from notifications_unite
union all select 'rapprochement_file', count(*)::text from rapprochement_file
union all select 'rapprochements', count(*)::text from rapprochements
union all select 'net.http_request_queue', count(*)::text from net.http_request_queue
union all select 'team_athletes', count(*)::text from team_athletes
union all select 'team_coaches', count(*)::text from team_coaches
union all select 'athletes_md5', md5(string_agg(a::text, '|' order by a.id)) from athletes a
union all select 'app_equipes', count(*)::text from teams t join app_ids a on a.r=t.rseq_team_id where t.season='2026-2027'
union all select 'app_signature', md5(string_agg(t.rseq_team_id||'|'||t.school_id||'|'||t.sport_id||'|'||t.name||'|'||coalesce(t.age_group,'')||'|'||coalesce(t.division,'')||'|'||coalesce(t.gender,''), ';' order by t.rseq_team_id)) from teams t join app_ids a on a.r=t.rseq_team_id where t.season='2026-2027'
union all select 'app_dom', (select count(*) from games g join teams t on t.id=g.home_team_id join app_ids a on a.r=t.rseq_team_id)::text
union all select 'app_vis', (select count(*) from games g join teams t on t.id=g.visitor_team_id join app_ids a on a.r=t.rseq_team_id)::text
union all select 'app_null_restants', ((select count(*) from games where home_team_id is null and home_rseq_team_id in (select r from app_ids))+(select count(*) from games where visitor_team_id is null and visitor_rseq_team_id in (select r from app_ids)))::text
union all select 'app_ligne_ops', (select operation||' · '||(details->>'equipes')||' éq · '||(details->>'cotes_domicile')||' dom · '||(details->>'cotes_visiteur')||' vis · '||to_char(le at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')||' UTC · par '||left(par::text,8) from admin_operations where details->>'lot' = '09-ultimate-frisbee' order by le desc limit 1)
union all select 'avant_rseq_deja', (select count(*)::text from teams where left(md5(rseq_team_id::text),8) in (select p from pref))
union all select 'avant_dom_null', (select count(*) from games where home_team_id is null and left(md5(home_rseq_team_id::text),8) in (select p from pref))::text
union all select 'avant_vis_null', (select count(*) from games where visitor_team_id is null and left(md5(visitor_rseq_team_id::text),8) in (select p from pref))::text
order by 1;