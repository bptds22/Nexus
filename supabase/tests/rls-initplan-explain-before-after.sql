-- ============================================================================
-- PERF PROOF — EXPLAIN before/after the RLS auth_rls_initplan migration.
--
-- HOW TO USE (local, Windows CC):
--   1. On the CURRENT schema (BEFORE the migration), run:
--        psql -U postgres -d postgres -f supabase/tests/rls-initplan-explain-before-after.sql > before.txt
--   2. Apply 20260727130000_rls_initplan_and_fk_indexes.sql.
--   3. Run the SAME command -> after.txt
--   4. Compare the "Planning Time" / "Execution Time" lines.
--
-- BASELINE MEASURED ON PROD (2026-07-27):
--   heavy athlete profil query : Planning 302 ms / Execution 75 ms  (plan 147 KB;
--                                school_coaches x37, conversations x14 in the plan)
--   light `select id`          : Planning  21 ms / Execution  ~4 ms
--   Under the dashboard's concurrent burst these tipped over statement_timeout
--   -> 500 (`canceling statement due to statement timeout`, prod pg log).
-- GOAL: planning of the heavy query drops materially; equivalence proof stays green.
--
-- ---------------------------------------------------------------------------
-- REVISION (CC-Windows) — 2026-07-27: REPEATED-RUN measurement.
-- The original took ONE EXPLAIN per query. Planning time is dominated by
-- catalog/relcache warmth: the first plan in a fresh session pays for loading
-- every policy of every table dragged into the plan, later ones do not. A
-- single shot therefore measures cache state as much as it measures the fix,
-- and the whole pass-1-vs-pass-2 verdict hangs on these numbers.
-- Each query now runs N=5 times in one session; we report EVERY run plus the
-- cold (run 1) and warm (median of 2..5) figures. Compare cold-to-cold and
-- warm-to-warm across before/after — never a cold against a warm.
-- ---------------------------------------------------------------------------
-- ============================================================================
\set ON_ERROR_STOP on
\timing off
\pset pager off

-- Discover a representative SCHOOL athlete (the failing path: context=scolaire).
-- Deterministic total order (uuid tiebreak) so before/after pick the same user
-- even if the planner switches scan method after the new indexes land.
select format('{"sub":"%s","role":"authenticated","aud":"authenticated"}', u.id) as claims,
       u.id as athlete_uid
from users u
where u.role = 'ATHLETE' and u.context = 'scolaire'
  and exists (select 1 from athletes a where a.user_id = u.id and a.school_id is not null)
order by u.created_at, u.id
limit 1 \gset
\echo '================ school athlete uid:' :athlete_uid '================'

-- Results sink. Created as postgres, written while impersonating authenticated.
drop table if exists perf_results;
create table perf_results (q text, run int, planning numeric, exec numeric);
grant insert, select on perf_results to authenticated;

-- Harness: run `explain (analyze, format json)` N times, record the summary
-- numbers only. Runs under the CALLER's role, so RLS is fully in the plan.
create or replace function pg_perf_probe(label text, sql text, n int)
returns void language plpgsql as $$
declare p json; i int;
begin
  for i in 1..n loop
    execute 'explain (analyze, buffers, format json) ' || sql into p;
    insert into perf_results(q, run, planning, exec)
    values (label, i, (p->0->>'Planning Time')::numeric, (p->0->>'Execution Time')::numeric);
  end loop;
end $$;
grant execute on function pg_perf_probe(text, text, int) to authenticated;

begin;
  set local role authenticated;
  set local request.jwt.claims to :'claims';
  set local statement_timeout = '120s';

  -- (A) HEAVY — athlete profil first-paint (embeds users!coach + full
  --     evaluations + schools + team_athletes). This is the 302ms one on prod.
  select pg_perf_probe('A_heavy_profil', $q$
    select a.*,
      (select json_build_object('nom', s.nom) from sports s where s.id = a.sport_id)                            as sport,
      (select json_build_object('nom', p.nom, 'abr', p.abreviation) from positions p where p.id = a.position_id) as position,
      (select json_build_object('name', sc.name, 'type', sc.type) from schools sc where sc.id = a.school_id)     as school,
      (select json_agg(ta.team_id) from team_athletes ta where ta.athlete_id = a.id)                             as team_athletes,
      (select json_agg(e.*) from evaluations e where e.athlete_id = a.id)                                        as evaluations,
      (select json_build_object('fn', u.first_name, 'ln', u.last_name) from users u where u.id = a.coach_id)     as coach_embed
    from athletes a
    where a.user_id = (select auth.uid())
  $q$, 5);

  -- (B) LIGHT — the trivial existence check that ALSO 500'd under load.
  select pg_perf_probe('B_light_select_id',
    'select id from athletes where user_id = (select auth.uid())', 5);

  -- (C) users onboarding_complete — fired by app/athlete/layout.tsx gate.
  select pg_perf_probe('C_users_onboarding',
    'select onboarding_complete from users where id = (select auth.uid())', 5);
commit;

\echo ''
\echo '################ PER-RUN TIMINGS (ms) ################'
select q, run, planning, exec from perf_results order by q, run;

\echo ''
\echo '################ SUMMARY — cold (run 1) vs warm (median runs 2-5) ################'
select q,
       max(planning) filter (where run = 1)                              as cold_planning,
       round((percentile_cont(0.5) within group (order by planning)
             filter (where run > 1))::numeric, 3)                        as warm_planning_median,
       max(exec) filter (where run = 1)                                  as cold_exec,
       round((percentile_cont(0.5) within group (order by exec)
             filter (where run > 1))::numeric, 3)                        as warm_exec_median
from perf_results group by q order by q;

-- Keep one full annotated plan of the heavy query for the record (plan shape,
-- seq-scan vs index, subplan count) — the numbers above say how fast, this
-- says why.
\echo ''
\echo '################ FULL PLAN — heavy query (for the record) ################'
begin;
  set local role authenticated;
  set local request.jwt.claims to :'claims';
  set local statement_timeout = '120s';
  explain (analyze, buffers, timing)
  select a.*,
    (select json_build_object('nom', s.nom) from sports s where s.id = a.sport_id)                            as sport,
    (select json_build_object('nom', p.nom, 'abr', p.abreviation) from positions p where p.id = a.position_id) as position,
    (select json_build_object('name', sc.name, 'type', sc.type) from schools sc where sc.id = a.school_id)     as school,
    (select json_agg(ta.team_id) from team_athletes ta where ta.athlete_id = a.id)                             as team_athletes,
    (select json_agg(e.*) from evaluations e where e.athlete_id = a.id)                                        as evaluations,
    (select json_build_object('fn', u.first_name, 'ln', u.last_name) from users u where u.id = a.coach_id)     as coach_embed
  from athletes a
  where a.user_id = (select auth.uid());
rollback;
