-- ═══════════════════════════════════════════════════════════════
-- Update partner_card_downloads.format CHECK constraint
-- ═══════════════════════════════════════════════════════════════
--
-- Phase 1 schema accepted format ∈ ('square', 'story', 'landscape')
-- as a placeholder. Phase 2 ships only two real formats:
--   • publication (1080×1350, 4:5 — Instagram feed)
--   • story       (1080×1920, 9:16 — Stories / Reels cover)
--
-- Drop the old constraint, install the new one. Local DB has
-- zero rows in partner_card_downloads so no data migration is
-- needed. In production, this would also be a no-op since the
-- old enum values were never used.

ALTER TABLE partner_card_downloads
  DROP CONSTRAINT IF EXISTS partner_card_downloads_format_check;

ALTER TABLE partner_card_downloads
  ADD CONSTRAINT partner_card_downloads_format_check
  CHECK (format IN ('publication', 'story'));
