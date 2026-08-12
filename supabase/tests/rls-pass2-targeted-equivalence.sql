-- ============================================================================
-- PASS 2 — targeted allow/deny proof for the TWO policies it rewrites.
--
-- The per-role matrix proves aggregate visibility is unchanged; this proves the
-- specific grants those two policies exist to provide still work, and that the
-- corresponding denials still deny. Run before AND after 20260727140000 — the
-- output must be identical.
--
--   T1/T2  users."Users read conversation participants"
--          a coach in a RECRUTEUR_COACH thread must still see the recruiter's
--          user row (T1), and a user sharing NO conversation must stay hidden
--          via this policy (T2 — counted through the policy's own predicate).
--   T3/T4  athletes."coaches read own athletes"
--          a coach linked through school_coaches must still see that school's
--          athletes (T3); a coach with no link to a school must not gain
--          visibility of it through the school_coaches branch (T4).
-- ============================================================================
\set ON_ERROR_STOP on
\pset pager off

-- Pick a RECRUTEUR_COACH pair that actually exists.
select coalesce((select c.coach_id::text     from conversations c
                 where c.conversation_type='RECRUTEUR_COACH' and c.coach_id is not null
                   and c.recruiter_id is not null order by c.id limit 1),
                '00000000-0000-0000-0000-000000000000') as rc_coach,
       coalesce((select c.recruiter_id::text  from conversations c
                 where c.conversation_type='RECRUTEUR_COACH' and c.coach_id is not null
                   and c.recruiter_id is not null order by c.id limit 1),
                '00000000-0000-0000-0000-000000000000') as rc_recruiter
\gset

-- Pick a coach that is linked to a school via school_coaches, and that school.
select coalesce((select sc.coach_id::text  from school_coaches sc order by sc.coach_id, sc.school_id limit 1),
                '00000000-0000-0000-0000-000000000000') as staff_coach,
       coalesce((select sc.school_id::text from school_coaches sc order by sc.coach_id, sc.school_id limit 1),
                '00000000-0000-0000-0000-000000000000') as staff_school
\gset

\echo '=== fixtures ==='
\echo 'rc_coach=' :rc_coach ' rc_recruiter=' :rc_recruiter
\echo 'staff_coach=' :staff_coach ' staff_school=' :staff_school

-- T1 + T2 : the conversation-participant grant, seen from the coach's session.
\set claims '{"sub":"':rc_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    (select count(*) from users u where u.id = :'rc_recruiter'::uuid)  as t1_coach_sees_his_recruiter,
    (select count(*) from users u
      where u.id <> :'rc_coach'::uuid
        and u.role = 'RECRUTEUR'::user_role
        and not exists (select 1 from conversations c
                        where (c.coach_id = :'rc_coach'::uuid and c.recruiter_id = u.id)
                           or (c.recruiter_id = :'rc_coach'::uuid and c.coach_id = u.id)))
                                                                       as t2_unrelated_recruiters_visible;
rollback;

-- T1' : same grant seen from the recruiter's session (the reverse direction).
\set claims '{"sub":"':rc_recruiter'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select (select count(*) from users u where u.id = :'rc_coach'::uuid) as t1b_recruiter_sees_his_coach;
rollback;

-- T3 : the school_coaches branch — a linked coach sees that school's athletes.
\set claims '{"sub":"':staff_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    (select count(*) from athletes a where a.school_id = :'staff_school'::uuid) as t3_staff_coach_sees_school_athletes,
    (select count(*) from athletes a)                                          as t3b_staff_coach_total_athletes;
rollback;

-- T4 : a user with NO school_coaches link must gain nothing from that branch.
select coalesce((select u.id::text from users u
                 where u.role='COACH'
                   and not exists (select 1 from school_coaches sc where sc.coach_id = u.id)
                 order by u.id limit 1),
                '00000000-0000-0000-0000-000000000000') as unlinked_coach \gset
\echo 'unlinked_coach=' :unlinked_coach
\set claims '{"sub":"':unlinked_coach'","role":"authenticated","aud":"authenticated"}'
begin;
  set local role authenticated; set local request.jwt.claims to :'claims';
  select
    (select count(*) from athletes a where a.school_id = :'staff_school'::uuid) as t4_unlinked_sees_that_school,
    (select count(*) from athletes a)                                          as t4b_unlinked_total_athletes;
rollback;
