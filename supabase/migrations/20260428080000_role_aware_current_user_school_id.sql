-- Fix current_user_school_id() to handle athletes correctly.
--
-- Previously the function read users.school_id directly. For athletes,
-- users.school_id and athletes.school_id can be out of sync (the
-- athlete record is the source of truth for athlete school selection).
-- Without role-awareness, the function returned the stale users.school_id
-- value and the CoachPicker showed zero coaches even when athletes
-- were at a school with active coaches.
--
-- For athletes: read from athletes.school_id (source of truth).
-- For other roles (coach, recruiter, admin): read from users.school_id.

CREATE OR REPLACE FUNCTION current_user_school_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role text;
  v_school_id uuid;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role = 'ATHLETE' THEN
    SELECT school_id INTO v_school_id FROM athletes WHERE user_id = auth.uid();
  ELSE
    SELECT school_id INTO v_school_id FROM users WHERE id = auth.uid();
  END IF;
  RETURN v_school_id;
END;
$$;
