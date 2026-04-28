-- Replace coach-scoped SELECT policy on recruiter_activity_log
-- with school-scoped one. Mirrors the athlete_suggestions
-- migration from 20260427130000.
--
-- Before: a coach could only read activity log entries for
-- athletes where athletes.coach_id = auth.uid(). After the
-- school-coach linking model decision, athletes.coach_id is
-- soft-deprecated and visibility scopes to school_id. All
-- coaches at the same school should see activity on the same
-- roster of athletes.
--
-- Both DROP POLICY IF EXISTS clauses are idempotent so the
-- migration can be re-applied safely (e.g. if the new policy
-- was created out-of-band via Studio before this file shipped).

DROP POLICY IF EXISTS "Coaches read activity for their athletes"
  ON recruiter_activity_log;

DROP POLICY IF EXISTS "Coaches read activity for their school athletes"
  ON recruiter_activity_log;

CREATE POLICY "Coaches read activity for their school athletes"
  ON recruiter_activity_log
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT a.id
      FROM athletes a
      JOIN users u ON u.school_id = a.school_id
      WHERE u.id = auth.uid()
    )
  );
