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
--
-- ---------------------------------------------------------------------------
-- REVISIONS (CC-Windows, author of the 22 messaging migrations) — 2026-07-27:
--   (a) DETERMINISTIC representative-user discovery. The original used
--       `limit 1` with NO order by for the director and the parent, and a
--       created_at-only order (tie-prone) elsewhere. This migration CREATES
--       idx_school_coaches_coach_id/_school_id, which can change the chosen
--       scan and therefore the row returned -> a DIFFERENT director picked
--       after vs before -> a spurious diff and a false STOP. Every pick now
--       has a total order (uuid tiebreak).
--   (b) WIDER table set: team_athletes / team_coaches / teams / school_coaches
--       / parent_athletes / broadcasts / activities added. team_athletes and
--       school_coaches are ON the athlete hot path (team_athletes is a direct
--       embed of the heavy query; school_coaches enters it via the athletes
--       policy subquery) and were NOT covered by the original matrix.
--   (c) WRITE-PATH probes. The migration rewrites INSERT/UPDATE WITH CHECK
--       clauses; a read-only matrix cannot see a broken write predicate. The
--       probes below assert allow/deny on the paths those WITH CHECKs guard,
--       each inside begin/rollback so nothing is persisted.
-- ---------------------------------------------------------------------------
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- Discover one representative user per role (null-safe scalar subselects;
-- missing role -> zero-uuid sentinel so the block still runs and shows 0s).
-- Every pick carries a uuid tiebreak => total order => stable across runs
-- even when the planner switches scan method (see revision (a)).
\set Z '00000000-0000-0000-0000-000000000000'
select
  coalesce((select id::text from users u where u.role='ATHLETE' and u.context='scolaire'
              and exists(select 1 from athletes a where a.user_id=u.id and a.school_id is not null)
            order by u.created_at, u.id limit 1), :'Z') as u_ath_sco,
  coalesce((select id::text from users u where u.role='ATHLETE' and u.context='ligue_civile'
            order by u.created_at, u.id limit 1), :'Z') as u_ath_civ,
  -- COACH pick: the one who actually OWNS athletes. The naive
  -- "oldest COACH" pick landed on a coach with ZERO owned athletes, which
  -- made every coach-side write probe vacuous (an INSERT..SELECT over an
  -- empty source inserts nothing and trivially "succeeds").
  coalesce((select a.coach_id::text from athletes a
            join users u on u.id = a.coach_id and u.role='COACH'
            group by a.coach_id order by count(*) desc, a.coach_id limit 1), :'Z') as u_coach,
  coalesce((select sc.coach_id::text from school_coaches sc
            where sc.role in ('DIRECTEUR','DIRECTEUR_INTERIM')
            order by sc.coach_id limit 1), :'Z') as u_dir,
  -- RECRUTEUR pick: prefer one that actually has favorites (non-vacuous
  -- favoris-gated probes), else fall back to the oldest recruiter.
  coalesce((select f.recruiter_id::text from recruiter_favorites f
            group by f.recruiter_id order by count(*) desc, f.recruiter_id limit 1),
           (select id::text from users u where u.role='RECRUTEUR'
            order by u.created_at, u.id limit 1), :'Z') as u_rec,
  coalesce((select parent_id::text from conversations where parent_id is not null
            order by parent_id limit 1), :'Z') as u_parent
\gset

\echo '=== representative users ==='
\echo 'athlete_scolaire=' :u_ath_sco ' athlete_civil=' :u_ath_civ ' coach=' :u_coach
\echo 'director=' :u_dir ' recruiter=' :u_rec ' parent=' :u_parent

-- ===========================================================================
-- PART 1 — READ matrix. RLS-applied visibility counts across the hot tables.
-- (Each block impersonates one user; scalar subqueries hit RLS = the proof.)
-- ===========================================================================
\echo ''
\echo '################ PART 1 — READ VISIBILITY MATRIX ################'

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
    (select count(*) from schools)              as schools,
    (select count(*) from team_athletes)        as team_ath,
    (select count(*) from team_coaches)         as team_coa,
    (select count(*) from teams)                as teams,
    (select count(*) from school_coaches)       as sch_coa,
    (select count(*) from parent_athletes)      as par_ath,
    (select count(*) from broadcasts)           as bcasts,
    (select count(*) from activities)           as activs;
rollback;

\set claims '{"sub":"':u_ath_civ'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'athlete_civil' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools),
    (select count(*) from team_athletes), (select count(*) from team_coaches),
    (select count(*) from teams), (select count(*) from school_coaches),
    (select count(*) from parent_athletes), (select count(*) from broadcasts),
    (select count(*) from activities);
rollback;

\set claims '{"sub":"':u_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'coach' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools),
    (select count(*) from team_athletes), (select count(*) from team_coaches),
    (select count(*) from teams), (select count(*) from school_coaches),
    (select count(*) from parent_athletes), (select count(*) from broadcasts),
    (select count(*) from activities);
rollback;

\set claims '{"sub":"':u_dir'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'director' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools),
    (select count(*) from team_athletes), (select count(*) from team_coaches),
    (select count(*) from teams), (select count(*) from school_coaches),
    (select count(*) from parent_athletes), (select count(*) from broadcasts),
    (select count(*) from activities);
rollback;

\set claims '{"sub":"':u_rec'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'recruiter' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools),
    (select count(*) from team_athletes), (select count(*) from team_coaches),
    (select count(*) from teams), (select count(*) from school_coaches),
    (select count(*) from parent_athletes), (select count(*) from broadcasts),
    (select count(*) from activities);
rollback;

\set claims '{"sub":"':u_parent'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select 'parent' as role_label,
    (select count(*) from athletes), (select count(*) from users),
    (select count(*) from conversations), (select count(*) from messages),
    (select count(*) from evaluations), (select count(*) from recruiter_favorites),
    (select count(*) from recruiter_pipeline), (select count(*) from recruiter_activity_log),
    (select count(*) from athlete_notifications), (select count(*) from schools),
    (select count(*) from team_athletes), (select count(*) from team_coaches),
    (select count(*) from teams), (select count(*) from school_coaches),
    (select count(*) from parent_athletes), (select count(*) from broadcasts),
    (select count(*) from activities);
rollback;

-- ===========================================================================
-- PART 2 — WRITE-PATH probes (allow/deny). These exercise the WITH CHECK
-- clauses the migration rewrites, which the read matrix cannot see.
-- Each probe runs inside begin/rollback: nothing is persisted.
-- A probe prints t = the write was ACCEPTED, f = REJECTED by RLS.
-- Before/after must match cell for cell.
-- ===========================================================================
\echo ''
\echo '################ PART 2 — WRITE-PATH ALLOW/DENY PROBES ################'

-- Helper: run a write and report a THREE-state verdict.
--   ALLOW(n)  = statement succeeded, n rows actually written
--   DENY      = RLS refused it (42501 insufficient_privilege)
--   ERR-xxxxx = refused by something else (CHECK / FK / unique / trigger)
-- The row count matters: an UPDATE whose USING clause hides every row, or an
-- INSERT..SELECT over an empty source, SUCCEEDS while writing nothing. A
-- boolean would report that as "allowed" and the probe would be vacuous —
-- exactly the trap the first draft of this file fell into. ALLOW(0) is now
-- visible as such.
create or replace function pg_temp.probe(sql text) returns text
language plpgsql as $$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return 'ALLOW(' || n || ')';
exception
  when insufficient_privilege then return 'DENY';
  when others then return 'ERR-' || SQLSTATE;
end $$;

-- --- W1..W4: athletes UPDATE paths (coaches can update own athletes /
--             claim unclaimed / athletes update own profile) ---
\set claims '{"sub":"':u_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format('update athletes set notes_coach = notes_coach where coach_id = %L', :'u_coach')) as w1_coach_upd_own,
    pg_temp.probe('update athletes set notes_coach = notes_coach where coach_id is not null and coach_id <> '''|| :'u_coach' ||'''') as w2_coach_upd_other,
    pg_temp.probe(format('insert into athletes (first_name,last_name,coach_id,school_id,status) select ''ZZProbe'',''ZZProbe'',%L,school_id,''ACTIF'' from athletes where coach_id=%L limit 1', :'u_coach', :'u_coach')) as w3_coach_ins_own;
rollback;

\set claims '{"sub":"':u_ath_sco'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format('update athletes set bio = bio where user_id = %L', :'u_ath_sco')) as w4_ath_upd_own,
    pg_temp.probe(format('update athletes set bio = bio where user_id is distinct from %L', :'u_ath_sco')) as w5_ath_upd_other,
    pg_temp.probe(format('update users set first_name = first_name where id = %L', :'u_ath_sco')) as w6_ath_upd_own_user,
    pg_temp.probe(format('update users set first_name = first_name where id <> %L', :'u_ath_sco')) as w7_ath_upd_other_user;
rollback;

-- --- W8..W9: conversations INSERT, athlete side (athlete_conversations_insert)
-- Single-row VALUES form (not INSERT..SELECT): the statement always attempts
-- exactly one row, so a refusal is a REAL refusal and can never be an empty
-- source masquerading as success. Targets an ARBITRARY existing coach the
-- athlete is NOT attached to => must be refused.
\set claims '{"sub":"':u_ath_sco'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format($q$insert into conversations (conversation_type, athlete_id, coach_id)
      values ('ATHLETE_COACH'::conversation_type,
              (select a.id from athletes a where a.user_id = %L order by a.id limit 1),
              (select a.coach_id from athletes a where a.user_id = %L order by a.id limit 1))$q$,
      :'u_ath_sco', :'u_ath_sco')) as w8_ath_conv_own_coach,
    pg_temp.probe(format($q$insert into conversations (conversation_type, athlete_id, coach_id)
      values ('ATHLETE_COACH'::conversation_type,
              (select a.id from athletes a where a.user_id = %L order by a.id limit 1),
              %L::uuid)$q$, :'u_ath_sco', :'u_rec')) as w9_ath_conv_arbitrary;
rollback;

-- --- W10..W11: coach side. The generic coach insert must still EXCLUDE
-- COACH_COACH / RECRUTEUR_COACH / PARENT_COACH (the three re-tightenings +
-- the PARENT_COACH guard migration). W11 is the security probe: a coach
-- labelling an ARBITRARY user as the "parent" of one of his own athletes.
\set claims '{"sub":"':u_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format($q$insert into conversations (conversation_type, athlete_id, coach_id)
      values ('ATHLETE_COACH'::conversation_type,
              (select a.id from athletes a where a.coach_id = %L order by a.id limit 1),
              %L::uuid)$q$, :'u_coach', :'u_coach')) as w10_coach_conv_own_athlete,
    pg_temp.probe(format($q$insert into conversations (conversation_type, athlete_id, coach_id, parent_id)
      values ('PARENT_COACH'::conversation_type,
              (select a.id from athletes a where a.coach_id = %L order by a.id limit 1),
              %L::uuid, %L::uuid)$q$, :'u_coach', :'u_coach', :'u_rec')) as w11_coach_parent_arbitrary,
    pg_temp.probe(format($q$insert into conversations (conversation_type, athlete_id, coach_id, coach_b_id)
      values ('COACH_COACH'::conversation_type, null, %L::uuid,
              (select u.id from users u where u.role='COACH' and u.id <> %L order by u.id limit 1))$q$,
      :'u_coach', :'u_coach')) as w11b_coach_coach_generic;
rollback;

-- --- W12..W14: recruiter write paths (favorites / pipeline WITH CHECKs).
-- W13 is the impersonation probe: recruiter_id set to someone else => refused.
\set claims '{"sub":"':u_rec'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format($q$insert into recruiter_favorites (recruiter_id, athlete_id)
      values (%L::uuid, (select id from athletes order by id limit 1))$q$, :'u_rec')) as w12_rec_fav_self,
    pg_temp.probe(format($q$insert into recruiter_favorites (recruiter_id, athlete_id)
      values (%L::uuid, (select id from athletes order by id limit 1))$q$, :'u_coach')) as w13_rec_fav_impersonate,
    pg_temp.probe(format($q$insert into recruiter_pipeline (recruiter_id, athlete_id)
      values (%L::uuid, (select id from athletes order by id limit 1))$q$, :'u_rec')) as w14_rec_pipe_self;
rollback;

-- --- W15..W16: parent write path (parent_messages_insert WITH CHECK).
-- W16 targets a conversation the parent is NOT the parent_id of => refused.
\set claims '{"sub":"':u_parent'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    pg_temp.probe(format($q$insert into messages (conversation_id, sender_id, content)
      values ((select c.id from conversations c where c.parent_id = %L order by c.id limit 1),
              %L::uuid, 'zz probe')$q$, :'u_parent', :'u_parent')) as w15_parent_msg_own,
    pg_temp.probe(format($q$insert into messages (conversation_id, sender_id, content)
      values ((select c.id from conversations c where c.parent_id is distinct from %L order by c.id limit 1),
              %L::uuid, 'zz probe')$q$, :'u_parent', :'u_parent')) as w16_parent_msg_foreign;
rollback;
