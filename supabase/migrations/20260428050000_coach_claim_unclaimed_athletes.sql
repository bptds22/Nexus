-- Allow coaches to claim unclaimed athletes at their school.
-- A claim sets athletes.coach_id from NULL to the claimer's
-- user_id. Once claimed, the existing "coaches can update
-- own athletes" policy takes over for further edits.
--
-- Security boundaries:
-- - USING restricts the rows a coach can target: only NULL
--   coach_id rows at their school
-- - WITH CHECK restricts the new value: must be auth.uid()
--   (no claim-for-others)
--
-- Un-claim is intentionally NOT enabled in this migration.
-- The existing "coaches can update own athletes" policy
-- (with_check: null) would technically allow setting
-- coach_id back to NULL, but the UI doesn't expose un-claim
-- in this commit. A future commit will handle un-claim plus
-- the question of team_athletes membership cleanup.

DROP POLICY IF EXISTS "coaches can claim unclaimed school athletes"
  ON athletes;

CREATE POLICY "coaches can claim unclaimed school athletes"
  ON athletes
  FOR UPDATE
  USING (
    coach_id IS NULL
    AND school_id IN (
      SELECT school_id FROM users
      WHERE id = auth.uid() AND role = 'COACH'
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
  );
