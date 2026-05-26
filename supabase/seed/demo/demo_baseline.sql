-- =============================================================================
-- NEXUS DEMO BASELINE  —  demo_baseline.sql
-- =============================================================================
-- Run this THREE times and compare:
--   (1) BEFORE seeding   -> the "true zero/real" baseline
--   (2) AFTER seeding     -> proves the seed added what you expect
--   (3) AFTER teardown    -> MUST match (1) exactly. That equality IS the proof
--                            that the wipe was clean and complete.
--
-- Read-only. Safe to run anytime. Copy the output to a file/screenshot each run.
-- =============================================================================

\echo '================ NEXUS DATA BASELINE ================'
\echo 'Timestamp:'
SELECT now();

\echo ''
\echo '--- Global table counts (all rows, demo + real) ---'
SELECT 'users'                AS table_name, count(*) FROM users
UNION ALL SELECT 'athletes',              count(*) FROM athletes
UNION ALL SELECT 'subscriptions',         count(*) FROM subscriptions
UNION ALL SELECT 'evaluations',           count(*) FROM evaluations
UNION ALL SELECT 'coach_badges',          count(*) FROM coach_badges
UNION ALL SELECT 'recruiter_pipeline',    count(*) FROM recruiter_pipeline
UNION ALL SELECT 'recruiter_favorites',   count(*) FROM recruiter_favorites
UNION ALL SELECT 'recruiter_notes',       count(*) FROM recruiter_notes
UNION ALL SELECT 'recruiter_athlete_views',count(*) FROM recruiter_athlete_views
UNION ALL SELECT 'team_athletes',         count(*) FROM team_athletes
ORDER BY table_name;

\echo ''
\echo '--- Demo-tagged rows only (should be 0 before seed, 0 after teardown) ---'
SELECT 'demo users' AS what, count(*)
FROM users WHERE email LIKE 'demo+%@nexussports.ca'
UNION ALL
SELECT 'demo athletes', count(*)
FROM athletes a JOIN users u ON u.id = a.user_id
WHERE u.email LIKE 'demo+%@nexussports.ca'
UNION ALL
SELECT 'demo auth.users', count(*)
FROM auth.users WHERE email LIKE 'demo+%@nexussports.ca';

\echo '====================================================='
