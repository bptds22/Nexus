-- Fix first_coach_claim() trigger:
--   1. school_registry table was dropped — use schools (the single source of truth)
--   2. director_id column never existed — check for existing directors via
--      school_coaches rows with DIRECTEUR / DIRECTEUR_INTERIM role instead
--   3. Only promote when the incoming row is role=COACH. PENDING rows
--      should not auto-promote.
--   4. Use DIRECTEUR_INTERIM (already in coach_school_role enum) instead
--      of the outdated ADMIN_COACH_INTERIM value.
--
-- Business intent (unchanged): the first coach who claims a school and is
-- not blocked by an existing director is automatically given interim
-- director rights, so they can manage the school without waiting on
-- out-of-band onboarding. The interim status is renamable later when a
-- real director claims the school.

CREATE OR REPLACE FUNCTION public.first_coach_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_director_exists BOOLEAN;
  v_other_coach_count INTEGER;
BEGIN
  -- Only auto-promote when the incoming role is COACH.
  -- PENDING rows (awaiting approval) must not be auto-promoted.
  IF NEW.role <> 'COACH' THEN
    RETURN NEW;
  END IF;

  -- Does this school already have a director (real or interim)?
  SELECT EXISTS (
    SELECT 1 FROM school_coaches
    WHERE school_id = NEW.school_id
      AND role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
      AND id <> NEW.id
  ) INTO v_director_exists;

  -- How many other non-pending coaches are already on this school?
  SELECT count(*) INTO v_other_coach_count
  FROM school_coaches
  WHERE school_id = NEW.school_id
    AND role <> 'PENDING'
    AND id <> NEW.id;

  -- First coach claim: no director, no other coaches → promote to interim director
  IF NOT v_director_exists AND v_other_coach_count = 0 THEN
    NEW.role := 'DIRECTEUR_INTERIM';
  END IF;

  RETURN NEW;
END;
$$;
