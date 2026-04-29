-- ═══════════════════════════════════════════════════════════════
-- Media Partners — Phase 1 schema
-- ═══════════════════════════════════════════════════════════════
--
-- Adds the 'PARTNER' role + media_partners table + athlete opt-in
-- columns + partner_card_downloads table + RLS policies.
--
-- Loi 25 critical: partners can ONLY see athletes who have
-- explicitly opted in via the new partner_visibility_opt_in
-- column. The opt-in is gated at the DB layer via RLS — never
-- just the UI. For minors (<18) parental consent is also
-- required (separate column), enforced in the app layer.
--
-- Also introduces is_platform_admin on users — a flag separate
-- from role. Bruno keeps role='COACH' (he coaches) but gets
-- is_platform_admin=true for partner creation and other
-- platform-wide admin operations. The API route at
-- /api/admin/partners/create gates on is_platform_admin().

-- moddatetime extension for the updated_at trigger below
CREATE EXTENSION IF NOT EXISTS moddatetime;

-- ── 1. Add PARTNER role ─────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PARTNER';

-- ── 2. is_platform_admin flag + helper ──────────────────────
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION is_platform_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE id = uid),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Bruno (founder/sole platform admin for closed beta)
UPDATE public.users
SET is_platform_admin = true
WHERE id = '51ec6dbe-ded9-4abb-a2e5-0b92d3409d87';

-- ── 3. media_partners table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  instagram_handle TEXT,
  facebook_url TEXT,
  tiktok_handle TEXT,
  description TEXT,
  audience_size INTEGER,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REVOKED')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  show_on_homepage BOOLEAN NOT NULL DEFAULT false,
  homepage_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_partners_status ON media_partners(status);
CREATE INDEX IF NOT EXISTS idx_media_partners_homepage
  ON media_partners(show_on_homepage, homepage_order)
  WHERE show_on_homepage = true;

-- ── 4. Athlete opt-in columns ───────────────────────────────
ALTER TABLE public.athletes
ADD COLUMN IF NOT EXISTS partner_visibility_opt_in BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS partner_visibility_opted_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS partner_visibility_parental_consent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_athletes_partner_opt_in
  ON athletes(partner_visibility_opt_in)
  WHERE partner_visibility_opt_in = true;

-- ── 5. partner_card_downloads (Phase 2 will write to this) ──
CREATE TABLE IF NOT EXISTS public.partner_card_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES media_partners(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('square', 'story', 'landscape')),
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_downloads_athlete
  ON partner_card_downloads(athlete_id, downloaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_downloads_partner
  ON partner_card_downloads(partner_id, downloaded_at DESC);

-- ── 6. Helper: is_approved_partner ──────────────────────────
CREATE OR REPLACE FUNCTION is_approved_partner(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM media_partners
    WHERE user_id = uid AND status = 'APPROVED'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── 7. RLS — media_partners ─────────────────────────────────
ALTER TABLE media_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners read own profile" ON media_partners;
CREATE POLICY "Partners read own profile"
  ON media_partners FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Public read approved homepage partners" ON media_partners;
CREATE POLICY "Public read approved homepage partners"
  ON media_partners FOR SELECT
  USING (status = 'APPROVED' AND show_on_homepage = true);

-- ── 8. RLS — partner_card_downloads ─────────────────────────
ALTER TABLE partner_card_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners log own downloads" ON partner_card_downloads;
CREATE POLICY "Partners log own downloads"
  ON partner_card_downloads FOR INSERT
  WITH CHECK (
    partner_id IN (
      SELECT id FROM media_partners
      WHERE user_id = auth.uid() AND status = 'APPROVED'
    )
  );

DROP POLICY IF EXISTS "Partners read own download history" ON partner_card_downloads;
CREATE POLICY "Partners read own download history"
  ON partner_card_downloads FOR SELECT
  USING (
    partner_id IN (SELECT id FROM media_partners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Athletes read their own card downloads" ON partner_card_downloads;
CREATE POLICY "Athletes read their own card downloads"
  ON partner_card_downloads FOR SELECT
  USING (
    athlete_id IN (SELECT id FROM athletes WHERE user_id = auth.uid())
  );

-- ── 9. RLS — athletes table partner read ────────────────────
DROP POLICY IF EXISTS "Approved partners read opted-in athletes" ON athletes;
CREATE POLICY "Approved partners read opted-in athletes"
  ON athletes FOR SELECT
  USING (
    partner_visibility_opt_in = true
    AND is_approved_partner(auth.uid())
  );

-- ── 10. updated_at trigger ──────────────────────────────────
DROP TRIGGER IF EXISTS set_media_partners_updated_at ON media_partners;
CREATE TRIGGER set_media_partners_updated_at
  BEFORE UPDATE ON media_partners
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
