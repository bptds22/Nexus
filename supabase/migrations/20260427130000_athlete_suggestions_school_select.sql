-- ═══════════════════════════════════════════════════════════════
-- athlete_suggestions: coach SELECT scope by school, not coach_id
-- ═══════════════════════════════════════════════════════════════
--
-- Tonight's coach roster fix moved /coach/athletes from
-- "athletes where coach_id = me" to "athletes where school_id =
-- my_school". The athlete_suggestions SELECT policy still gates
-- by coach_id, so the À TRAITER suggestions tab silently returns
-- 0 rows for coaches who aren't the explicit coach_id of an
-- athlete — even when that athlete is at their school.
--
-- This migration replaces the SELECT policy with a school-scoped
-- equivalent. UPDATE policy and athlete-side SELECT policy are
-- intentionally left alone:
--   - UPDATE = any authenticated user, fine for now
--   - "Athletes can read own suggestions" still correct

DROP POLICY IF EXISTS "Coaches can read their athletes suggestions"
  ON public.athlete_suggestions;

CREATE POLICY "Coaches can read suggestions for their school athletes"
  ON public.athlete_suggestions
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT a.id
      FROM public.athletes a
      WHERE a.school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = auth.uid()
      )
    )
  );

-- ── Verify ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Coaches can read suggestions for their school athletes'
      AND polrelid = 'public.athlete_suggestions'::regclass
  ) THEN
    RAISE EXCEPTION 'New school-based SELECT policy not created';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Coaches can read their athletes suggestions'
      AND polrelid = 'public.athlete_suggestions'::regclass
  ) THEN
    RAISE EXCEPTION 'Old coach_id-based policy still exists';
  END IF;
END $$;
