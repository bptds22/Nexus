-- Drop the legacy auto_link_athlete_to_coach trigger and function.
--
-- This trigger silently rolled back any attempt to set athletes.coach_id
-- to NULL by re-assigning a "default" coach at the same school. It
-- predates the school-coach linking model where:
--   - athletes.school_id  = visibility scope (all coaches at the school)
--   - athletes.coach_id   = ownership (NULL means "unclaimed in pool")
--
-- With the new claim/un-claim flow, NULL is a valid first-class state
-- (handled by the "coaches can claim unclaimed school athletes" RLS
-- policy in 20260428050000). The trigger directly conflicts with that
-- policy: an UPDATE setting coach_id = NULL would be silently reverted
-- by the trigger before the RLS WITH CHECK could even evaluate.
--
-- Removing both the BEFORE INSERT and BEFORE UPDATE bindings, plus the
-- underlying function. Use IF EXISTS so re-applying the migration on a
-- DB where it was already dropped (e.g. via Studio) is a no-op.

DROP TRIGGER IF EXISTS trigger_auto_link_athlete_coach ON athletes;
DROP FUNCTION IF EXISTS auto_link_athlete_to_coach();
