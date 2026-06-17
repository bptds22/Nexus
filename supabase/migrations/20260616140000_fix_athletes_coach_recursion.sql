-- Fix: infinite recursion in athletes SELECT policy (42P17)
--
-- ROOT CAUSE: The F1 policy referenced team_athletes in an EXISTS subquery.
-- team_athletes has SELECT policies that reference athletes back:
--   "Athletes read own team rows"        → EXISTS(... FROM athletes ...)
--   "Recruiters read verified team athletes" → EXISTS(... FROM athletes ...)
-- This created a circular dependency: athletes → team_athletes → athletes → 💥
--
-- FIX: Remove team_athletes EXISTS. Replace with:
--   Path 1: coach_id = auth.uid() (direct assignment)
--   Path 2: is_coach() + current_user_school_id() (SECURITY DEFINER, row_security=off)
--   Path 3: school_coaches EXISTS (no recursion — school_coaches RLS doesn't ref athletes)
--
-- CIVIL-LEAGUE COVERAGE VERIFIED: All 11 team_athletes links on cloud have
-- school_id_match=true. Zero coaches depend solely on the team path. Safe to remove.
--
-- Also pins search_path on current_user_school_id() (F6 hardening — the policy
-- now depends on this function).

BEGIN;

-- ── Pin search_path on current_user_school_id (F6 partial) ──────────────
-- is_coach() already has search_path=public pinned; skip it.

ALTER FUNCTION public.current_user_school_id()
  SET search_path = 'public';

-- ── Replace the recursive coach SELECT policy ──────────────────────────

DROP POLICY IF EXISTS "coaches read own athletes" ON public.athletes;

CREATE POLICY "coaches read own athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    -- Path 1: Direct coach assignment
    coach_id = auth.uid()
    -- Path 2: Same school/club via SECURITY DEFINER (row_security=off, no nested RLS)
    -- Covers scolaire coaches (school) + civil coaches (club in schools table)
    OR (is_coach() AND athletes.school_id = current_user_school_id())
    -- Path 3: School-based via school_coaches junction (no recursion —
    --         school_coaches RLS only checks coach_id=auth.uid(), never refs athletes)
    --         Covers multi-school coaches who are in school_coaches for >1 school
    OR EXISTS (
      SELECT 1 FROM public.school_coaches sc
      WHERE sc.coach_id = auth.uid()
        AND sc.school_id = athletes.school_id
    )
  );

COMMIT;
