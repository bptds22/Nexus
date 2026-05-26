-- =============================================================================
-- NEXUS DEMO BATCH TEST TEARDOWN  —  demo_batch_test_teardown.sql
-- =============================================================================
-- Deletes ONLY the demo+test-% batch from demo_batch_test.sql, using the exact
-- same ordered logic as the full demo_teardown.sql. If baseline reverts after
-- this, the full teardown is proven sound.
--
-- Anchor here is the narrower 'demo+test-%' so it CANNOT touch the real 37-row
-- demo seed if both happen to be present.
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _u ON COMMIT DROP AS
SELECT id, role FROM users WHERE email LIKE 'demo+test-%@nexussports.ca';

CREATE TEMP TABLE _a ON COMMIT DROP AS
SELECT a.id FROM athletes a JOIN _u u ON u.id = a.user_id;

-- 4 NO-ACTION children first
DELETE FROM recruiter_pipeline      WHERE athlete_id IN (SELECT id FROM _a) OR recruiter_id IN (SELECT id FROM _u WHERE role='RECRUTEUR');
DELETE FROM recruiter_favorites     WHERE athlete_id IN (SELECT id FROM _a) OR recruiter_id IN (SELECT id FROM _u WHERE role='RECRUTEUR');
DELETE FROM recruiter_notes         WHERE athlete_id IN (SELECT id FROM _a) OR recruiter_id IN (SELECT id FROM _u WHERE role='RECRUTEUR');
DELETE FROM recruiter_athlete_views WHERE athlete_id IN (SELECT id FROM _a) OR recruiter_id IN (SELECT id FROM _u WHERE role='RECRUTEUR');

-- coach/eval/sub children
DELETE FROM evaluations   WHERE athlete_id IN (SELECT id FROM _a) OR coach_id IN (SELECT id FROM _u WHERE role='COACH');
DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM _u);

-- athletes (cascade fans the ~21), then users, then auth.users
DELETE FROM athletes  WHERE id IN (SELECT id FROM _a);
DELETE FROM users     WHERE id IN (SELECT id FROM _u);
DELETE FROM auth.users WHERE email LIKE 'demo+test-%@nexussports.ca';

\echo '--- Batch torn down. Run demo_baseline.sql; counts must match pre-batch. ---'
COMMIT;
