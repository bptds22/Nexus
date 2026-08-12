-- ============================================================================
-- REVERT KIT GENERATOR — emits an executable script that restores the CURRENT
-- (pre-migration) body of every policy on the 10 tables touched by
-- 20260727130000_rls_initplan_and_fk_indexes.sql, plus DROPs for the indexes
-- that migration creates.
--
-- RUN THIS BEFORE APPLYING THE MIGRATION (on local, and again on prod before
-- the prod apply — prod's bodies are the ones prod must be reverted to).
--
--   psql -U postgres -d postgres -At -f this_file > revert-rls-initplan.sql
--
-- The output is idempotent (DROP POLICY IF EXISTS + CREATE POLICY) and can be
-- applied with the usual UTF-8-safe path (docker cp + psql -f).
--
-- NOTE: no `\pset` / `\echo` here on purpose — psql echoes their banner
-- ("Pager usage is off.") into the redirected file, which then lands as line 1
-- of the generated script and makes it die at `ON_ERROR_STOP=1` with
-- `syntax error at or near "Pager"`. The generator must emit SQL and nothing
-- else. Generate with `psql -At -f`.
-- ============================================================================

select
  '-- Revert kit generated from live catalog. Restores pre-migration policy bodies.'
union all select ''
union all
select string_agg(stmt, E'\n' order by tablename, policyname)
from (
  select
    tablename,
    policyname,
    format(
      E'DROP POLICY IF EXISTS %I ON public.%I;\nCREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;\n',
      policyname, tablename,
      policyname, tablename,
      permissive,
      cmd,
      array_to_string(roles, ', '),
      case when qual       is not null then E'\n  USING (' || qual || ')'       else '' end,
      case when with_check is not null then E'\n  WITH CHECK (' || with_check || ')' else '' end
    ) as stmt
  from pg_policies
  where schemaname = 'public'
    and tablename in ('athlete_notifications','athletes','conversations','evaluations',
                      'messages','recruiter_activity_log','recruiter_favorites',
                      'recruiter_pipeline','schools','users')
) s
union all select ''
union all select '-- Indexes created by the migration (drop only if reverting them too):'
union all select 'DROP INDEX IF EXISTS public.idx_athletes_user_id;'
union all select 'DROP INDEX IF EXISTS public.idx_school_coaches_coach_id;'
union all select 'DROP INDEX IF EXISTS public.idx_conversations_coach_id;'
union all select 'DROP INDEX IF EXISTS public.idx_conversations_coach_b_id;'
union all select 'DROP INDEX IF EXISTS public.idx_conversations_recruiter_id;'
union all select 'DROP INDEX IF EXISTS public.idx_conversations_parent_id;'
union all select 'DROP INDEX IF EXISTS public.idx_messages_sender_id;'
union all select 'DROP INDEX IF EXISTS public.idx_recruiter_favorites_athlete_id;'
union all select 'DROP INDEX IF EXISTS public.idx_recruiter_pipeline_athlete_id;';
