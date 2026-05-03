-- ═══════════════════════════════════════════════════════════════
-- Repoint athlete-facing visibility views from the orphan
-- profile_views table to the canonical recruiter_athlete_views.
--
-- Background: at some point during the platform's evolution, view
-- tracking moved from `profile_views` to `recruiter_athlete_views`.
-- The recruiter side now writes only to `recruiter_athlete_views`
-- (see /recruteur/athletes/[id] page recordView). But three views
-- consumed by the athlete /ma-visibilite page still source from
-- the dead `profile_views` table:
--
--   athlete_visibility_stats   — KPI numbers (vues ce mois /
--                                recruteurs uniques / favoris)
--   athlete_view_details       — per-recruiter visit log used by
--                                the Pro CÉGEP cards section
--   athlete_views_weekly       — 8-week rolling chart
--
-- All three rows for current athletes return zero from these views
-- because profile_views is empty. Athlete dashboard works because
-- it queries recruiter_athlete_views directly. Recruiter and
-- partner profile views work because they also use the canonical
-- table.
--
-- Fix: swap `FROM profile_views pv` to `FROM recruiter_athlete_views
-- pv` in each of the three views. Column shape is preserved — both
-- tables have athlete_id, recruiter_id, viewed_at with compatible
-- types (recruiter_athlete_views' columns are stricter — NOT NULL
-- on recruiter_id where profile_views was nullable).
--
-- Orphan profile_views and athlete_views tables are deferred to
-- a separate cleanup migration; see post-launch-bugs.md P3.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW athlete_visibility_stats AS
SELECT athlete_id,
   count(*) FILTER (WHERE viewed_at >= date_trunc('month'::text, now())) AS views_this_month,
   count(*) FILTER (WHERE viewed_at >= (date_trunc('month'::text, now()) - '1 mon'::interval) AND viewed_at < date_trunc('month'::text, now())) AS views_last_month,
   count(DISTINCT recruiter_id) AS unique_recruiters_total,
   count(DISTINCT recruiter_id) FILTER (WHERE viewed_at >= date_trunc('month'::text, now())) AS unique_recruiters_this_month,
   (SELECT count(*) FROM recruiter_favorites rf WHERE rf.athlete_id = pv.athlete_id) AS total_favorites
FROM recruiter_athlete_views pv
GROUP BY athlete_id;

CREATE OR REPLACE VIEW athlete_view_details AS
SELECT pv.athlete_id,
   pv.recruiter_id,
   ((u.first_name || ' '::text) || u.last_name) AS recruiter_name,
   s.name AS cegep_name,
   s.region AS cegep_region,
   count(*) AS visit_count,
   max(pv.viewed_at) AS last_viewed_at,
   min(pv.viewed_at) AS first_viewed_at
FROM recruiter_athlete_views pv
JOIN users u ON u.id = pv.recruiter_id
LEFT JOIN schools s ON s.id = u.school_id
GROUP BY pv.athlete_id, pv.recruiter_id, u.first_name, u.last_name, s.name, s.region
ORDER BY max(pv.viewed_at) DESC;

CREATE OR REPLACE VIEW athlete_views_weekly AS
SELECT athlete_id,
   (date_trunc('week'::text, viewed_at))::date AS week_start,
   count(*) AS view_count
FROM recruiter_athlete_views pv
WHERE viewed_at >= (now() - '56 days'::interval)
GROUP BY athlete_id, (date_trunc('week'::text, viewed_at))
ORDER BY ((date_trunc('week'::text, viewed_at))::date);
