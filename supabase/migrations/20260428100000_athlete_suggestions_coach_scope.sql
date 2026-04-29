-- Replace school-scoped policies on athlete_suggestions with
-- coach-scoped equivalents. Surface 5 of 5 in the school-coach
-- revisit (last surface — claim model is now the source of
-- truth for coach visibility everywhere).
--
-- Before: 20260427130000 created
-- "Coaches can read suggestions for their school athletes"
-- (SELECT, school-scoped). An UPDATE policy was also added
-- out-of-band (likely via Studio) that mirrored the school
-- scope.
--
-- After: both SELECT and UPDATE narrow to athletes the coach
-- has claimed (athletes.coach_id = auth.uid()). Coaches at the
-- same school no longer see/approve other coaches' pending
-- suggestions.
--
-- The athlete-side policies ("Athletes can read own suggestions"
-- + "Athletes insert own suggestions") are untouched — athletes
-- still read/insert via their own user_id mapping.
--
-- Idempotent: drops every historical and current policy name
-- before recreating. Re-applying after the DB was already
-- updated via Studio is a no-op.

-- Old historical name (pre-school-scope migration)
DROP POLICY IF EXISTS "Coaches can read their athletes suggestions"
  ON public.athlete_suggestions;

-- School-scoped names from 20260427130000
DROP POLICY IF EXISTS "Coaches can read suggestions for their school athletes"
  ON public.athlete_suggestions;

DROP POLICY IF EXISTS "Coaches update suggestions for their school athletes"
  ON public.athlete_suggestions;

-- Coach-claimed names (current DB state)
DROP POLICY IF EXISTS "Coaches can read suggestions for their claimed athletes"
  ON public.athlete_suggestions;

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes"
  ON public.athlete_suggestions;

CREATE POLICY "Coaches can read suggestions for their claimed athletes"
  ON public.athlete_suggestions
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT athletes.id
      FROM public.athletes
      WHERE athletes.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches update suggestions for their claimed athletes"
  ON public.athlete_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    athlete_id IN (
      SELECT athletes.id
      FROM public.athletes
      WHERE athletes.coach_id = auth.uid()
    )
  );
