-- profile_completion was silently stuck at 0 for any athlete row not saved
-- via the frontend's calculateProfileCompletion() write path (e.g., coach-
-- created athlete profiles). The DB-level trigger trg_profile_completion
-- existed and was correct (per migration 20260504050000_remove_auto_verification)
-- but was DISABLE TRIGGERd in baseline, leaving the column un-maintained.
--
-- Re-enable the canonical trigger. Leave the duplicate trigger_profile_completion
-- disabled (schema debt to clean up separately — same function, redundant).
-- Backfill via no-op update to force the trigger to fire on existing rows.

ALTER TABLE public.athletes ENABLE TRIGGER trg_profile_completion;

UPDATE public.athletes SET updated_at = updated_at;