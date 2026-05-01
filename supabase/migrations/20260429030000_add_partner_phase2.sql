-- ═══════════════════════════════════════════════════════════════
-- Media Partners Phase 2 — Foundation
-- ═══════════════════════════════════════════════════════════════
--
-- Adds the canonical eligibility helper, the newsroom_events table,
-- and two read views (top_athletes_view + trending_athletes_view)
-- consumed by /partenaire/* pages in the next 7 commits.
--
-- Eligibility filter (canonical, used everywhere a partner sees an
-- athlete):
--   • partner_visibility_opt_in = true
--   • adult OR partner_visibility_parental_consent = true
--   • verified = true
--   • modified_since_verification = false
--   • cote_globale_entraineur IS NOT NULL  (coach-attested rating)
--
-- Column renames vs. spec (drift from spec → actual schema):
--   athletes.cote_globale          → cote_globale_entraineur
--   athletes.graduation_year       → annee_diplomation
--   athletes.region                → schools.region via LEFT JOIN
--   athletes.primary_sport_id      → sport_id
--   athletes.primary_position_id   → position_id
--
-- The schools join uses LEFT JOIN so athletes without a school
-- assigned are not silently dropped from the views — they appear
-- with NULL region and naturally fall out only when the partner
-- filters by region.

-- ── 1. Eligibility helper ───────────────────────────────────
CREATE OR REPLACE FUNCTION is_partner_eligible_athlete(p_athlete_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    a.partner_visibility_opt_in = true
    AND (
      EXTRACT(YEAR FROM AGE(a.date_naissance)) >= 18
      OR a.partner_visibility_parental_consent = true
    )
    AND a.verified = true
    AND a.modified_since_verification = false
    AND a.cote_globale_entraineur IS NOT NULL
  FROM public.athletes a
  WHERE a.id = p_athlete_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ── 2. newsroom_events table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.newsroom_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('COMMITMENT', 'FIVE_STAR_SIGNUP')),
  athlete_id UUID REFERENCES athletes(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  sport_id UUID REFERENCES sports(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsroom_events_occurred
  ON newsroom_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_athlete
  ON newsroom_events(athlete_id);
CREATE INDEX IF NOT EXISTS idx_newsroom_events_type
  ON newsroom_events(event_type);

-- ── 3. RLS — newsroom_events ────────────────────────────────
ALTER TABLE newsroom_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved partners read eligible newsroom events" ON newsroom_events;
CREATE POLICY "Approved partners read eligible newsroom events"
  ON newsroom_events FOR SELECT
  USING (
    is_approved_partner(auth.uid())
    AND (athlete_id IS NULL OR is_partner_eligible_athlete(athlete_id))
  );

DROP POLICY IF EXISTS "Platform admins read all newsroom events" ON newsroom_events;
CREATE POLICY "Platform admins read all newsroom events"
  ON newsroom_events FOR SELECT
  USING (is_platform_admin(auth.uid()));

-- ── 4. top_athletes_view (Top-X) ────────────────────────────
DROP VIEW IF EXISTS top_athletes_view;
CREATE VIEW top_athletes_view AS
SELECT
  a.id,
  a.first_name,
  a.last_name,
  a.cote_globale_entraineur,
  a.annee_diplomation,
  sch.region,
  a.sport_id,
  a.position_id,
  a.school_id,
  a.photo_url,
  s.nom AS sport_name,
  p.nom AS position_name,
  sch.name AS school_name
FROM athletes a
LEFT JOIN sports s ON s.id = a.sport_id
LEFT JOIN positions p ON p.id = a.position_id
LEFT JOIN schools sch ON sch.id = a.school_id
WHERE is_partner_eligible_athlete(a.id)
ORDER BY a.cote_globale_entraineur DESC;

GRANT SELECT ON top_athletes_view TO authenticated;

-- ── 5. trending_athletes_view (live, 7d window) ─────────────
DROP VIEW IF EXISTS trending_athletes_view;
CREATE VIEW trending_athletes_view AS
WITH recent_views AS (
  SELECT athlete_id, COUNT(*) AS views_last_7d
  FROM recruiter_athlete_views
  WHERE viewed_at >= NOW() - INTERVAL '7 days'
  GROUP BY athlete_id
),
prior_views AS (
  SELECT athlete_id, COUNT(*) AS views_prior_7d
  FROM recruiter_athlete_views
  WHERE viewed_at >= NOW() - INTERVAL '14 days'
    AND viewed_at < NOW() - INTERVAL '7 days'
  GROUP BY athlete_id
),
recent_favs AS (
  SELECT athlete_id, COUNT(*) AS favs_last_7d
  FROM recruiter_favorites
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY athlete_id
),
prior_favs AS (
  SELECT athlete_id, COUNT(*) AS favs_prior_7d
  FROM recruiter_favorites
  WHERE created_at >= NOW() - INTERVAL '14 days'
    AND created_at < NOW() - INTERVAL '7 days'
  GROUP BY athlete_id
)
SELECT
  a.id,
  a.first_name,
  a.last_name,
  a.photo_url,
  a.cote_globale_entraineur,
  sch.region,
  a.annee_diplomation,
  s.nom AS sport_name,
  COALESCE(rv.views_last_7d, 0) AS views_7d,
  COALESCE(pv.views_prior_7d, 0) AS views_prior_7d,
  COALESCE(rv.views_last_7d, 0) - COALESCE(pv.views_prior_7d, 0) AS views_delta,
  COALESCE(rfv.favs_last_7d, 0) AS favs_7d,
  COALESCE(pf.favs_prior_7d, 0) AS favs_prior_7d,
  COALESCE(rfv.favs_last_7d, 0) - COALESCE(pf.favs_prior_7d, 0) AS favs_delta
FROM athletes a
LEFT JOIN sports s ON s.id = a.sport_id
LEFT JOIN schools sch ON sch.id = a.school_id
LEFT JOIN recent_views rv ON rv.athlete_id = a.id
LEFT JOIN prior_views pv ON pv.athlete_id = a.id
LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
WHERE is_partner_eligible_athlete(a.id);

GRANT SELECT ON trending_athletes_view TO authenticated;
