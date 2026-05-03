-- ═══════════════════════════════════════════════════════════════
-- Extend trending_athletes_view with sport_id + position_id so the
-- partner /tendances page can filter both panels (Plus de vues +
-- Plus de favoris) by the same cascading sport→position dropdown
-- UX used in /partenaire/newsroom and /partenaire/classements.
--
-- CREATE OR REPLACE VIEW preserves the existing 15 columns in
-- order (id, first_name, last_name, photo_url,
-- cote_globale_entraineur, region, school_name, annee_diplomation,
-- sport_name, views_7d, views_prior_7d, views_delta, favs_7d,
-- favs_prior_7d, favs_delta) and APPENDS sport_id + position_id at
-- the end. Existing consumers of the view keep working unchanged.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW trending_athletes_view AS
WITH recent_views AS (
  SELECT athlete_id, count(*) AS views_last_7d
  FROM recruiter_athlete_views
  WHERE viewed_at >= (now() - interval '7 days')
  GROUP BY athlete_id
), prior_views AS (
  SELECT athlete_id, count(*) AS views_prior_7d
  FROM recruiter_athlete_views
  WHERE viewed_at >= (now() - interval '14 days')
    AND viewed_at < (now() - interval '7 days')
  GROUP BY athlete_id
), recent_favs AS (
  SELECT athlete_id, count(*) AS favs_last_7d
  FROM recruiter_favorites
  WHERE created_at >= (now() - interval '7 days')
  GROUP BY athlete_id
), prior_favs AS (
  SELECT athlete_id, count(*) AS favs_prior_7d
  FROM recruiter_favorites
  WHERE created_at >= (now() - interval '14 days')
    AND created_at < (now() - interval '7 days')
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
  COALESCE(rv.views_last_7d, 0::bigint) AS views_7d,
  COALESCE(pv.views_prior_7d, 0::bigint) AS views_prior_7d,
  COALESCE(rv.views_last_7d, 0::bigint) - COALESCE(pv.views_prior_7d, 0::bigint) AS views_delta,
  COALESCE(rfv.favs_last_7d, 0::bigint) AS favs_7d,
  COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_prior_7d,
  COALESCE(rfv.favs_last_7d, 0::bigint) - COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_delta,
  a.sport_id,
  a.position_id
FROM athletes a
LEFT JOIN sports s ON s.id = a.sport_id
LEFT JOIN schools sch ON sch.id = a.school_id
LEFT JOIN recent_views rv ON rv.athlete_id = a.id
LEFT JOIN prior_views pv ON pv.athlete_id = a.id
LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
WHERE is_partner_eligible_athlete(a.id);
