-- F1: Close anon access to athlete PII (Loi 25 critical)
--
-- PROBLEM: Three SELECT policies on athletes use roles={public} with no
-- auth.uid() guard, allowing unauthenticated (anon key) reads of ALL
-- active/verified athlete records — including minor PII (name, email,
-- phone, parent info, date of birth, photo).
--
-- POLICIES DROPPED:
--   "athletes read verified"       → qual: (verified=true) OR (coach_id=auth.uid())
--   "coaches can read own athletes" → qual: (coach_id=auth.uid()) OR (verified=true)
--   "recruiters can read active athletes" → qual: (status='ACTIF')
--
-- POLICIES KEPT (already anon-safe):
--   "admins read all"              → is_admin() returns false when auth.uid() is NULL
--   "Approved partners read opted-in athletes" → is_approved_partner(NULL) returns false
--   "athletes can read own profile" → user_id = auth.uid(), NULL≠NULL
--   "athletes can read own orphan match" → TO authenticated (not public)
--
-- REPLACEMENTS: Two authenticated-only policies matching the real access
-- paths verified against the live schema + app code (2026-06-16).
--
-- Coach access path (verified from app/coach/athletes/page.tsx):
--   Roster page queries .eq("school_id", coachSchoolId) — school_coaches
--   is the source of truth (one coach confirmed in 2 schools).
--   "À traiter" tab shows unclaimed athletes (coach_id IS NULL) at the
--   same school — so school_coaches match is needed, not just coach_id.
--   Civil league coaches access via team_coaches + team_athletes.
--
-- Recruiter access path: authenticated + role=RECRUTEUR + status=ACTIF.
--   The verified filter stays client-side (not an RLS gate).

BEGIN;

-- ── DROP the 3 vulnerable policies ──────────────────────────────────────

DROP POLICY IF EXISTS "athletes read verified"          ON public.athletes;
DROP POLICY IF EXISTS "coaches can read own athletes"   ON public.athletes;
DROP POLICY IF EXISTS "recruiters can read active athletes" ON public.athletes;

-- ── REPLACE: Coach access (authenticated only) ─────────────────────────

CREATE POLICY "coaches read own athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    -- Path 1: Direct coach assignment (athletes.coach_id)
    coach_id = auth.uid()
    -- Path 2: School-based (school_coaches junction — covers roster +
    --         "À traiter" tab + multi-school coaches + directors)
    OR EXISTS (
      SELECT 1 FROM public.school_coaches sc
      WHERE sc.coach_id = auth.uid()
        AND sc.school_id = athletes.school_id
    )
    -- Path 3: Team-based (civil league coaches via team_coaches/team_athletes)
    OR EXISTS (
      SELECT 1 FROM public.team_coaches tc
      JOIN public.team_athletes ta ON ta.team_id = tc.team_id
      WHERE tc.coach_id = auth.uid()
        AND ta.athlete_id = athletes.id
    )
  );

-- ── REPLACE: Recruiter access (authenticated + role check) ─────────────

CREATE POLICY "recruiters read active athletes"
  ON public.athletes
  FOR SELECT
  TO authenticated
  USING (
    status = 'ACTIF'::account_status
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'RECRUTEUR'::user_role
    )
  );

COMMIT;
