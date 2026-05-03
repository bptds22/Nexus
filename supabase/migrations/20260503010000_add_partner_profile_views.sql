-- ═══════════════════════════════════════════════════════════════
-- Add partner_profile_views audit table.
--
-- Mirrors partner_card_downloads (same partner_id / athlete_id /
-- timestamp shape, no format column since profile views aren't
-- format-specific). Logs every time a partner opens an athlete's
-- profile page — admin/audit visibility into who looked at whom,
-- per Loi 25 transparency.
--
-- Insert path: /api/partner/profile-views/log (server-side route
-- validates approved-partner status + athlete eligibility, mirrors
-- /api/partner/cards/log-download).
--
-- RLS policies mirror partner_card_downloads exactly:
--   - Partners read own view history
--   - Partners log own views (must be APPROVED)
--   - Athletes read their own profile-view history
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS partner_profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES media_partners(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_profile_views_partner_id_idx ON partner_profile_views (partner_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS partner_profile_views_athlete_id_idx ON partner_profile_views (athlete_id, viewed_at DESC);

ALTER TABLE partner_profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners read own view history" ON partner_profile_views;
CREATE POLICY "Partners read own view history"
  ON partner_profile_views
  FOR SELECT
  USING (
    partner_id IN (
      SELECT id FROM media_partners WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners log own views" ON partner_profile_views;
CREATE POLICY "Partners log own views"
  ON partner_profile_views
  FOR INSERT
  WITH CHECK (
    partner_id IN (
      SELECT id FROM media_partners
      WHERE user_id = auth.uid() AND status = 'APPROVED'
    )
  );

DROP POLICY IF EXISTS "Athletes read their own profile views" ON partner_profile_views;
CREATE POLICY "Athletes read their own profile views"
  ON partner_profile_views
  FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE user_id = auth.uid()
    )
  );
