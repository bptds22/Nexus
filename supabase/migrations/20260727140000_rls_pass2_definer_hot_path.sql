-- ============================================================================
-- RLS Pass 2 — de-subquery the athlete hot path (PLANNING-time fix)
--
-- WHY PASS 2 EXISTS AT ALL
-- Pass 1 (20260727130000) did what it promised and no more: it wrapped
-- auth.uid() in an initplan and added the missing FK indexes. Measured locally,
-- before -> after pass 1 on the heavy athlete profil query:
--     PLANNING   64.1 ms -> 69.8 ms  (warm median — NO improvement)
--     EXECUTION  23.6 ms -> 12.8 ms  (~2x better)
-- That is exactly the honest caveat pass 1 recorded for itself: initplan is an
-- EXECUTION fix. But prod dies on `statement_timeout`, which is charged on
-- planning + execution, and planning is ~80% of that total (302 ms of ~377 ms
-- on prod). Pass 1 alone therefore does NOT clear the athlete screen.
--
-- WHAT ACTUALLY COSTS THE PLANNING TIME (measured, not assumed)
-- NOT the 257 `multiple_permissive_policies` lints. Merging N permissive
-- policies into one OR'd policy yields the same expression tree, so it buys
-- little planning time — that lint is mostly an execution-side concern.
--
-- The real driver is INLINE SUBQUERIES inside hot-path policies. A subquery
-- over another table pulls that table AND ITS ENTIRE POLICY SET into the plan,
-- recursively:
--     users."Users read conversation participants"  -> conversations
--       -> conversations' 9 SELECT policies         -> athletes
--         -> athletes' 6 SELECT policies            -> school_coaches ...
-- That recursion is what produced a 147 KB plan with 528 subplans on prod.
-- A SECURITY DEFINER function is OPAQUE to the planner: it drags nothing in
-- and collapses the recursion. This is already CLAUDE.md rule 4 ("RLS via
-- SECURITY DEFINER helpers, never a raw users subquery inside a policy") —
-- these two policies predate/violate it.
--
-- MEASURED RESULT of this migration (local, warm median, heavy query):
--     PLANNING   69.8 ms -> 11.6 ms   (~6x)
--     EXECUTION  12.8 ms ->  8.7 ms
--     total      82.6 ms -> 20.3 ms   (~4x)
--
-- SCOPE — deliberately TWO policies. Per BP's rule the per-conversation-type
-- policies stay separate (the type discriminator is the security boundary);
-- this pass does not merge or delete a single policy. It only replaces two
-- inline subqueries with equivalent DEFINER calls.
--
-- DELIBERATELY NOT CONVERTED — users."Coaches lookup orphan athletes".
-- Its `EXISTS (SELECT 1 FROM athletes WHERE user_id = users.id AND school_id
-- IS NULL)` runs under the CALLER's RLS on athletes. An orphan athlete has
-- school_id NULL, so the coach's school branch cannot match it — today the
-- policy only fires for orphans the coach ALREADY owns, i.e. it is largely
-- dead. Converting it to DEFINER would let ANY coach read ANY orphan
-- athlete's user row: a genuine WIDENING of access, not a perf change. It
-- would have bought a further 11.6 ms -> 6.0 ms, and it is still not worth
-- smuggling a behaviour change into a perf pass. Flagged for BP as a separate
-- product/security decision (the policy's NAME says it intends to work; it
-- does not).
--
-- PROOF REQUIRED (same loop as pass 1):
--   * per-role equivalence matrix (reads + write probes) -> diff MUST be empty
--   * normalized policy-body snapshot -> MUST show exactly these 2 policies
--     changed and nothing else
--   * EXPLAIN before/after -> the numbers above
-- Prod on BP's explicit per-migration GO (ledger rule 9).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper 1 — replaces the two IN(conversations) subqueries on users.
-- Equivalence: the original read
--     id IN (SELECT recruiter_id FROM conversations WHERE coach_id = auth.uid())
--  OR id IN (SELECT coach_id     FROM conversations WHERE recruiter_id = auth.uid())
-- i.e. "there is a conversation pairing me with `target`, in either direction".
-- The inline form evaluated under the caller's RLS on conversations; that
-- filter is a no-op for exactly these rows, because the rows selected are the
-- ones where the caller IS the coach (coach_conversations_select) or IS the
-- recruiter (recruiter_conversations_select) — the caller can already read
-- precisely those. Hence DEFINER is faithful here, and the equivalence matrix
-- is what actually proves it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_shares_conversation(target_user uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE (c.coach_id     = (SELECT auth.uid()) AND c.recruiter_id = target_user)
       OR (c.recruiter_id = (SELECT auth.uid()) AND c.coach_id     = target_user)
  )
$$;

REVOKE ALL ON FUNCTION public.user_shares_conversation(uuid) FROM public;
-- anon MUST keep EXECUTE: the policy below is `TO public`, so anon evaluates
-- it. Without the grant an anonymous read of `users` would ERROR (permission
-- denied for function) instead of simply returning no row — a behaviour
-- change. It leaks nothing: for anon auth.uid() is NULL, so both branches are
-- false and the function is constant-false.
GRANT EXECUTE ON FUNCTION public.user_shares_conversation(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper 2 — replaces the EXISTS(school_coaches) subquery on athletes.
-- Equivalence: the subquery filters `sc.coach_id = auth.uid()`, and
-- school_coaches' own policy `coach_read_own` (coach_id = auth.uid()) already
-- grants the caller exactly those rows — so the caller-RLS pass was a no-op.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coach_staffs_school(target_school uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM school_coaches sc
    WHERE sc.coach_id = (SELECT auth.uid())
      AND sc.school_id = target_school
  )
$$;

REVOKE ALL ON FUNCTION public.coach_staffs_school(uuid) FROM public;
-- policy below is TO authenticated only, so anon never calls this one.
GRANT EXECUTE ON FUNCTION public.coach_staffs_school(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- users."Users read conversation participants"
-- Role (public), command (SELECT) and permissiveness are preserved exactly;
-- only the two IN-subqueries collapse into the helper.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read conversation participants" ON public.users;
CREATE POLICY "Users read conversation participants" ON public.users AS PERMISSIVE FOR SELECT TO public
  USING (((id = (select auth.uid())) OR public.user_shares_conversation(id)));

-- ---------------------------------------------------------------------------
-- athletes."coaches read own athletes"
-- The first two disjuncts are untouched; only the EXISTS(school_coaches)
-- collapses into the helper.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "coaches read own athletes" ON public.athletes;
CREATE POLICY "coaches read own athletes" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated
  USING (((coach_id = (select auth.uid()))
          OR (is_coach() AND (school_id = current_user_school_id()))
          OR public.coach_staffs_school(school_id)));
