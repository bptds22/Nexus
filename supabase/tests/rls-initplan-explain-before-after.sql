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
-- ============================================================================
\set ON_ERROR_STOP on
\timing off

-- Discover a representative SCHOOL athlete (the failing path: context=scolaire).
select format('{"sub":"%s","role":"authenticated","aud":"authenticated"}', u.id) as claims,
       u.id as athlete_uid
from users u
where u.role = 'ATHLETE' and u.context = 'scolaire'
  and exists (select 1 from athletes a where a.user_id = u.id and a.school_id is not null)
order by u.created_at
limit 1 \gset
\echo '================ school athlete uid:' :athlete_uid '================'

-- ---------------------------------------------------------------------------
-- (A) HEAVY query — the athlete profil first-paint (embeds users!coach +
--     full evaluations + schools + team_athletes). This is the 302ms one.
-- ---------------------------------------------------------------------------
\echo '---- (A) HEAVY athlete profil query ----'
begin;
  set local role authenticated;
  set local request.jwt.claims to :'claims';
  set local statement_timeout = '60s';
  explain (analyze, buffers, timing)
  select a.*,
    (select json_build_object('nom', s.nom) from sports s where s.id = a.sport_id)                          as sport,
    (select json_build_object('nom', p.nom, 'abr', p.abreviation) from positions p where p.id = a.position_id) as position,
    (select json_build_object('name', sc.name, 'type', sc.type) from schools sc where sc.id = a.school_id)   as school,
    (select json_agg(ta.team_id) from team_athletes ta where ta.athlete_id = a.id)                           as team_athletes,
    (select json_agg(e.*) from evaluations e where e.athlete_id = a.id)                                      as evaluations,
    (select json_build_object('fn', u.first_name, 'ln', u.last_name) from users u where u.id = a.coach_id)   as coach_embed
  from athletes a
  where a.user_id = (select auth.uid());
rollback;

-- ---------------------------------------------------------------------------
-- (B) LIGHT query — the trivial existence check that ALSO 500'd under load.
-- ---------------------------------------------------------------------------
\echo '---- (B) LIGHT select id query ----'
begin;
  set local role authenticated;
  set local request.jwt.claims to :'claims';
  set local statement_timeout = '60s';
  explain (analyze, buffers, timing)
  select id from athletes where user_id = (select auth.uid());
rollback;

-- ---------------------------------------------------------------------------
-- (C) users onboarding_complete — fired by app/athlete/layout.tsx gate.
-- ---------------------------------------------------------------------------
\echo '---- (C) users onboarding_complete ----'
begin;
  set local role authenticated;
  set local request.jwt.claims to :'claims';
  set local statement_timeout = '60s';
  explain (analyze, buffers, timing)
  select onboarding_complete from users where id = (select auth.uid());
rollback;
