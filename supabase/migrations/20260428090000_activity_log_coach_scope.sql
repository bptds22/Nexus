-- Replace school-scoped SELECT policy on recruiter_activity_log
-- with coach-scoped one. Surface 4 of 5 in the school-coach
-- revisit (now that the claim model is shipped, coaches see
-- activity ONLY for athletes they've claimed, not the whole
-- school's roster).
--
-- Before this migration: "Coaches read activity for their school
-- athletes" (created in 20260428040000) joined athletes to users
-- on school_id and let any coach at the school read activity for
-- any athlete at that school.
--
-- After: "Coaches read activity for their claimed athletes"
-- restricts the SELECT to athletes where athletes.coach_id =
-- auth.uid(). Matches the product rule "Coach portal = MY
-- claimed athletes everywhere except the team picker."
--
-- Idempotent: drops both old policy names (school-scoped and
-- claimed-scoped) before recreating, so re-applying after the
-- policy was already updated via Studio is a no-op.

DROP POLICY IF EXISTS "Coaches read activity for their school athletes"
  ON recruiter_activity_log;

DROP POLICY IF EXISTS "Coaches read activity for their claimed athletes"
  ON recruiter_activity_log;

CREATE POLICY "Coaches read activity for their claimed athletes"
  ON recruiter_activity_log
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT athletes.id
      FROM athletes
      WHERE athletes.coach_id = auth.uid()
    )
  );
