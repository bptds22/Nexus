-- RLS policy: athletes (and other users at the same school) can read
-- coach rows for their school. Required for the CoachPicker component
-- on athlete onboarding step 1 and athlete settings to populate the
-- coach grid.
--
-- Without this, athletes querying users WHERE role='COACH' AND
-- school_id=$1 would get an empty result set under the default
-- self-only SELECT policy on users, and the picker would silently
-- show "Aucun coach inscrit à cette école" even when coaches exist.
--
-- Scope:
-- - Reader must have a school_id matching the row being read
--   (current_user_school_id() resolves to the caller's school)
-- - Row must be a COACH (not other coach-school members or admins)
-- - SELECT only — no write surface added
--
-- Idempotent: drops then recreates so re-applying on a DB where the
-- policy was already created via Studio is safe.

DROP POLICY IF EXISTS "users read coaches at their school" ON users;

CREATE POLICY "users read coaches at their school"
  ON users
  FOR SELECT
  USING (
    role = 'COACH'::user_role
    AND school_id = current_user_school_id()
  );
