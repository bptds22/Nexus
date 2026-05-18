-- Fix 42501 recursion on UPDATE public.users.
-- backfill_athletes_on_coach_join() fires on every UPDATE when
-- role=COACH AND school_id IS NOT NULL. It runs UPDATE athletes which
-- evaluates athletes RLS, which sub-queries users; without SECURITY
-- DEFINER + row_security=off this aborts mid-statement with 42501.
-- Same pattern as the 4 functions fixed on 2026-05-16.

CREATE OR REPLACE FUNCTION public.backfill_athletes_on_coach_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $function$
BEGIN
  UPDATE athletes
  SET coach_id = NEW.id
  WHERE school_id = NEW.school_id AND coach_id IS NULL;
  RETURN NEW;
END;
$function$;