-- ═══════════════════════════════════════════════════════════════
-- Partner welcome flow tracking columns (Phase 2.5)
-- ═══════════════════════════════════════════════════════════════
--
-- Three flags on media_partners that record completion of the
-- first-login gate at /partenaire/bienvenue:
--
--   • password_reset_completed_at — partner replaced the
--     admin-issued temp password with one of their own
--   • terms_accepted_at + terms_version — partner accepted the
--     Loi 25 / editorial-use terms; version tag lets us
--     re-prompt when the wording changes (start at 'v1')
--
-- Both must be non-NULL for the middleware (Phase 2.5 step 3)
-- to allow access to /partenaire/* routes other than
-- /partenaire/bienvenue itself.
--
-- Existing partners (created before this migration) get NULL
-- for all three columns automatically — that is the correct
-- behavior. Their next login bounces them through the welcome
-- flow.

ALTER TABLE public.media_partners
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_media_partners_welcome_pending
  ON media_partners(user_id)
  WHERE terms_accepted_at IS NULL OR password_reset_completed_at IS NULL;

COMMENT ON COLUMN media_partners.terms_accepted_at
  IS 'Timestamp when partner accepted Loi 25 terms during welcome flow';
COMMENT ON COLUMN media_partners.terms_version
  IS 'Version of terms accepted (for tracking when terms wording changes)';
COMMENT ON COLUMN media_partners.password_reset_completed_at
  IS 'Timestamp when partner replaced their admin-issued temp password';
