-- Fix RLS infinite recursion (42P17) on the coach recruiter-directory policy.
--
-- ─── Context ───────────────────────────────────────────────────────
-- The previous migration 20260614200000_coaches_read_recruiter_directory
-- created :
--
--   CREATE POLICY "coaches read recruiter directory"
--   ON public.users
--   FOR SELECT TO authenticated
--   USING (
--     role = 'RECRUTEUR'
--     AND EXISTS (
--       SELECT 1 FROM public.users me
--       WHERE me.id = auth.uid() AND me.role = 'COACH'
--     )
--   );
--
-- The inline EXISTS subquery queries public.users from inside a
-- public.users policy → Postgres re-applies the same set of users
-- policies to evaluate the subquery → infinite recursion (42P17) the
-- first time a coach hits the directory query.
--
-- The canonical fix in this repo is the SECURITY DEFINER helper
-- pattern already used by `is_admin()` (baseline), `is_coach()`
-- (20260512150000_phase_6_2_c1_athlete_email_lookup_policy), and
-- `current_user_school_id()` (20260428065000). The helper runs with
-- `row_security = off` so the inner SELECT bypasses users RLS → no
-- recursion possible.
--
-- ─── Reuse, don't duplicate ────────────────────────────────────────
-- `public.is_coach()` already exists with the exact required shape
-- (SECURITY DEFINER + STABLE + search_path=public + row_security=off
-- + GRANT EXECUTE TO authenticated). We REUSE it instead of adding a
-- second helper. The 20260512150000 migration is the source of truth ;
-- if it ever changes, this policy follows the same definition.
--
-- ─── Audit of other public.users policies for the same bug ─────────
-- All current SELECT/UPDATE/INSERT policies on public.users :
--
--   users read own                          → id = auth.uid()           — no subquery
--   users update own                        → id = auth.uid()           — no subquery
--   Users read conversation participants    → FROM conversations         — cross-table, safe
--   admins read all                         → is_admin()                 — SD helper, safe
--   admins update all                       → is_admin()                 — SD helper, safe
--   users read coaches at their school      → current_user_school_id()   — SD helper, safe
--   Coaches lookup athletes by email        → is_coach()                 — SD helper, safe
--   Coaches lookup orphan athletes          → is_coach() + EXISTS FROM
--                                              athlete_suggestions       — cross-table, safe
--   Service role can insert users           → INSERT only                — safe
--   coaches read recruiter directory        → inline SELECT FROM
--                                              public.users me           — ← RECURSIVE (this fix)
--
-- `coaches read recruiter directory` is the only recursive policy.
-- The companion coach policy added the same week —
-- `coach_conversations_insert` (20260614100000) — has an inline
-- `EXISTS FROM public.athletes WHERE a.coach_id = auth.uid()` clause,
-- but that's a CROSS-TABLE subquery from a conversations policy,
-- which does NOT recurse and is correct as-is. No other policy in the
-- repo subqueries its own table inline.

BEGIN;

-- (1) Replace the recursive policy with a SD-helper-based version.
DROP POLICY IF EXISTS "coaches read recruiter directory" ON public.users;

CREATE POLICY "coaches read recruiter directory"
ON public.users
FOR SELECT
TO authenticated
USING (
  role = 'RECRUTEUR'
  AND public.is_coach()
);

-- (2) Sanity check — fail-loud if the helper has been dropped or the
-- policy didn't land. Same pattern used by 20260512150000.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_coach' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION
      'public.is_coach() helper is missing — required by "coaches read recruiter directory" policy. Was 20260512150000_phase_6_2_c1_athlete_email_lookup_policy.sql rolled back ?';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'coaches read recruiter directory'
  ) THEN
    RAISE EXCEPTION 'Policy "coaches read recruiter directory" not created';
  END IF;
END $$;

COMMIT;
