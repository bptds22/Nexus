-- ============================================================================
-- EQUIVALENCE PROOF — per-role RLS visibility matrix, before vs after the
-- auth_rls_initplan migration. The rewrite only changes auth.uid() ->
-- (select auth.uid()) (evaluation cadence), so EVERY cell must be IDENTICAL.
--
-- HOW TO USE (local, Windows CC):
--   1. BEFORE the migration:  psql -U postgres -d postgres -f this_file > before.txt
--   2. Apply 20260727130000_rls_initplan_and_fk_indexes.sql
--   3. AFTER:                 psql -U postgres -d postgres -f this_file > after.txt
--   4. diff before.txt after.txt   ->  MUST be empty. Any differing cell = STOP.
--
-- Covers the paths called out: athlete(scolaire+civil) / coach / director /
-- recruiter / parent, across the hot tables incl. the messaging cells.
-- Counts are RLS-applied row visibility per role = the allow/deny signal.
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- Discover one representative user per role (null-safe scalar subselects;
-- missing role -> zero-uuid sentinel so the block still runs and shows 0s).
\set Z '00000000-0000-0000-0000-000000000000'
select
  coalesce((select id::text from users u where u.role='ATHLETE' and u.context='scolaire'
              and exists(select 1 from athletes a where a.user_id=u.id and a.school_id is not null)
            order by u.created_at limit 1), :'Z') as u_ath_sco,
  coalesce((select id::text from users u where u.role='ATHLETE' and u.context='ligue_civile'
            order by u.created_at limit 1), :'Z') as u_ath_civ,
  coalesce((select id::text from users u where u.role='COACH' order by u.created_at limit 1), :'Z') as u_coach,
  coalesce((select sc.coach_id::text from school_coaches sc
            where sc.role in ('DIRECTEUR','DIRECTEUR_INTERIM') limit 1), :'Z') as u_dir,
  coalesce((select id::text from users u where u.role='RECRUTEUR' order by u.created_at limit 1), :'Z') as u_rec,
  coalesce((select parent_id::text from conversations where parent_id is not null limit 1), :'Z') as u_parent
\gset

\echo '=== representative users ==='
\echo 'athlete_scolaire=' :u_ath_sco ' athlete_civil=' :u_ath_civ ' coach=' :u_coach
\echo 'director=' :u_dir ' recruiter=' :u_rec ' parent=' :u_parent

-- Reusable matrix row: RLS-applied visibility counts across the hot tables.
-- (Each block impersonates one user; scalar subqueries hit RLS = the proof.)

\set claims '{"sub":"':u_ath_sco'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'athlete_scolaire' as role_label,
    (select count(*) from athletes)             as athletes,
    (select count(*) from users)                as users,
    (select count(*) from conversations)        as conversations,
    (select count(*) from messages)             as messages,
    (select count(*) from evaluations)          as evaluations,
    (select count(*) from recruiter_favorites)  as favorites,
    (select count(*) from recruiter_pipeline)   as pipeline,
    (select count(*) from recruiter_activity_log) as activity,
    (select count(*) from athlete_notifications) as notifs,
    (select count(*) from schools)              as schools;
rollback;

\set claims '{"sub":"':u_ath_civ'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'athlete_civil' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools);
rollback;

\set claims '{"sub":"':u_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'coach' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools);
rollback;

\set claims '{"sub":"':u_dir'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'director' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools);
rollback;

\set claims '{"sub":"':u_rec'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'recruiter' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools);
rollback;

\set claims '{"sub":"':u_parent'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'parent' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools);
rollback;

-- OPTIONAL write-path spot check (allow/deny must also be identical). Extend
-- with dry-run INSERTs wrapped in begin/rollback if you want write coverage;
-- the read matrix above is the primary before/after diff.
