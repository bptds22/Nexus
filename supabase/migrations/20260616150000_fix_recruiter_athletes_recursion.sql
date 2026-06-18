-- Fix: second recursion cycle in athletes SELECT (42P17)
--
-- ROOT CAUSE: The F1 recruiter policy does an inline EXISTS on users:
--   EXISTS(SELECT 1 FROM users WHERE id = auth.uid() AND role = 'RECRUTEUR')
-- The users table has a SELECT policy "Coaches lookup orphan athletes" that
-- does EXISTS(SELECT 1 FROM athletes WHERE ...) back → circular dependency.
--
-- athletes → users (inline EXISTS) → athletes (via "Coaches lookup orphan athletes") → 💥
--
-- FIX: Create is_recruiter() as SECURITY DEFINER with row_security=off
-- (mirrors the existing is_coach() / is_admin() pattern). SECURITY DEFINER
-- functions bypass nested RLS — no users policies are evaluated → no recursion.
--
-- The coach policy (coaches read own athletes) is unaffected — its paths all
-- use SECURITY DEFINER functions (is_coach, current_user_school_id) or
-- school_coaches (whose RLS doesn't reference athletes).

BEGIN;

-- ── Create is_recruiter() helper ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'RECRUTEUR'::user_role
  );
$$;

-- ── Replace recruiter policy: SD function instead of inline EXISTS ──────

DROP POLICY IF EXISTS "recruiters read active athletes" ON public.athletes;

CREATE POLICY "recruiters read active athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    status = 'ACTIF'::account_status
    AND is_recruiter()
  );

COMMIT;
