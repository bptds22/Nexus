-- ═══════════════════════════════════════════════════════════════
-- Add school_name to trending_athletes_view
-- ═══════════════════════════════════════════════════════════════
--
-- Phase 2 step 1 created trending_athletes_view with sch.region
-- but not sch.name. The /partenaire/tendances page (step 4)
-- needs the school name to display on each athlete card.
-- Cheaper to expose it in the view than to add a second join
-- per page render.
--
-- CREATE OR REPLACE VIEW with a column appended at the end is
-- safe — Postgres allows adding columns without breaking
-- dependent objects.

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
  sch.name AS school_name,
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
