-- Étape 0 : compteurs des tables qu'un trigger pourrait toucher (notifications, courriels/pg_net,
-- rapprochements, journaux, athlètes, liens équipe), avant / après le lot 01. Table absente = « absente ».
-- Plus la séquence graphql.seq_schema_version (incrémentée par l'event trigger graphql_watch_* sur DDL).
create or replace function pg_temp.compte(t text) returns text language plpgsql as $$
declare n bigint;
begin
  if to_regclass(t) is null then return 'absente'; end if;
  execute format('select count(*) from %s', t) into n;
  return n::text;
end $$;
select t, pg_temp.compte(t) from unnest(array[
  'net.http_request_queue', 'net._http_response',
  'public.notifications_unite', 'public.admin_notifications', 'public.athlete_notifications',
  'public.coach_notifications', 'public.parent_notifications', 'public.recruiter_contact_notifications',
  'public.rapprochement_file', 'public.rapprochements',
  'public.recruiter_activity_log', 'public.activity_feed', 'public.cartes_prospect_journal',
  'public.rseq_sync_alerts', 'public.rseq_sync_changes',
  'public.athletes', 'public.team_athletes', 'public.team_coaches', 'public.team_invitations',
  'public.team_join_tokens', 'public.users'
]) t
union all select 'athletes md5', (select md5(coalesce(string_agg(a::text, '|' order by a.id), '')) from public.athletes a)
union all select 'users.primary_team_id non nul', (select count(*)::text from public.users where primary_team_id is not null)
union all select 'graphql.seq_schema_version', (select last_value::text from graphql.seq_schema_version)
order by 1;
