-- Monthly re-validation: athletes must re-confirm profile each month.
-- Adds last_profile_validation timestamp. Verified badge disables when
-- this is before the 1st of the current month AND we're past the 15th.

ALTER TABLE athletes ADD COLUMN IF NOT EXISTS last_profile_validation TIMESTAMPTZ;

-- Seed currently-verified athletes as just confirmed so they're not
-- immediately in a "due" state on migration day.
UPDATE athletes
SET last_profile_validation = NOW()
WHERE verified = true AND last_profile_validation IS NULL;
