-- Rollback de 20261008135031_journal_matchs_ajoutes (carte des matchs, lot B, 4/4).
-- À jouer AVANT le rollback de matchs_ajoutes (2/4), qui porte le trigger.
-- Les lignes MATCH_AJOUTE / MATCH_RETIRE du journal partent (l'ancienne
-- contrainte les refuserait) : relever le compte avant :
--   select action_type, count(*) from public.recruiter_activity_log
--    where action_type in ('MATCH_AJOUTE','MATCH_RETIRE') group by 1;
drop trigger if exists trg_log_match_ajoute on public.matchs_ajoutes;
drop function if exists public.log_match_ajoute();

delete from public.recruiter_activity_log where action_type in ('MATCH_AJOUTE', 'MATCH_RETIRE');

drop policy unite_journal_select on public.recruiter_activity_log;
create policy unite_journal_select on public.recruiter_activity_log
  for select to authenticated
  using (
    action_type = any (array[
      'PIPELINE_CHANGED', 'FAVORITED', 'UNFAVORITED', 'NOTE_ADDED', 'NOTE_UPDATED',
      'LIST_CREATED', 'LIST_NOTE_ADDED', 'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST'
    ]::text[])
    and public.acces_unite_pro(unite_cegep_id, unite_sport_id)
  );

alter table public.recruiter_activity_log
  drop constraint recruiter_activity_log_action_type_check;
alter table public.recruiter_activity_log
  add constraint recruiter_activity_log_action_type_check
  check (action_type = any (array[
    'NOTE_ADDED', 'NOTE_UPDATED', 'LIST_CREATED', 'LIST_NOTE_ADDED',
    'ATHLETE_ADDED_TO_LIST', 'ATHLETE_REMOVED_FROM_LIST', 'PIPELINE_CHANGED',
    'FAVORITED', 'UNFAVORITED', 'PROFILE_VIEWED', 'NEW_ATHLETE',
    'PROFILE_UPDATED', 'VIDEO_ADDED', 'ATHLETE_VERIFIED', 'STATS_UPDATED',
    'REVIEW_SUBMITTED', 'COACH_REPLY', 'ADMIN_BROADCAST'
  ]::text[]));

do $$
begin
  if to_regprocedure('public.log_match_ajoute()') is not null
     or pg_get_constraintdef((select oid from pg_constraint
                               where conname = 'recruiter_activity_log_action_type_check')) like '%MATCH_%'
     or exists (select 1 from pg_policy where polname = 'unite_journal_select'
                  and pg_get_expr(polqual, polrelid) like '%MATCH_%') then
    raise exception 'NEXUS: journal des matchs toujours présent après rollback';
  end if;
end $$;
