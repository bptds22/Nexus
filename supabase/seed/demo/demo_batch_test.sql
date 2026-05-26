-- =============================================================================
-- NEXUS DEMO BATCH TEST  —  demo_batch_test.sql
-- =============================================================================
-- PURPOSE: prove the seed/teardown LOGIC reverts cleanly on a TINY batch (2
-- athletes + 1 recruiter) BEFORE running the full 37-account seed. This is the
-- non-negotiable "test teardown on a small batch first" step.
--
-- Uses the SAME email anchor (demo+%) and the SAME mechanics as the real pair,
-- so if this reverts to baseline, the full pair will too.
--
-- RUN SEQUENCE:
--   1. psql -f demo_baseline.sql              > before.txt
--   2. psql -f demo_batch_test.sql            (seeds 2 ath + 1 rec + 1 pipe + 1 fav)
--   3. psql -f demo_baseline.sql              > after_seed.txt   (counts went up)
--   4. psql -f demo_batch_test_teardown.sql   (deletes exactly the batch)
--   5. psql -f demo_baseline.sql              > after_teardown.txt
--   6. diff before.txt after_teardown.txt     => MUST be identical (bar timestamp)
-- =============================================================================

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT (SELECT id FROM sports WHERE nom ILIKE 'football' AND nom NOT ILIKE '%flag%' LIMIT 1) AS football_sport_id;

-- 1 recruiter + 2 athletes, all under the anchor (note the TEST tag in localpart).
-- TRIGGER-NATIVE PATTERN (confirmed from handle_new_auth_user):
-- Inserting auth.users with role/first_name/last_name packed into
-- raw_user_meta_data => the trigger auto-creates the public.users row, fully
-- populated. So we insert ONLY auth.users. No public.users insert/update.
CREATE TEMP TABLE _batch_users (id uuid, email text, role text, fn text, ln text) ON COMMIT DROP;
INSERT INTO _batch_users VALUES
  (gen_random_uuid(), 'demo+test-rec01@nexussports.ca', 'RECRUTEUR', 'Test', 'Recruteur'),
  (gen_random_uuid(), 'demo+test-ath01@nexussports.ca', 'ATHLETE',   'Test', 'Athlete1'),
  (gen_random_uuid(), 'demo+test-ath02@nexussports.ca', 'ATHLETE',   'Test', 'Athlete2');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, created_at, updated_at, raw_user_meta_data
)
SELECT
  id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  email, now(), now(),
  jsonb_build_object('role', role, 'first_name', fn, 'last_name', ln)
FROM _batch_users;
-- public.users now exists for all 3 (created by on_auth_user_created trigger).

INSERT INTO subscriptions (user_id, tier, status)
SELECT id, 'all_star', 'active' FROM users WHERE email = 'demo+test-rec01@nexussports.ca'
ON CONFLICT (user_id) DO UPDATE SET tier='all_star', status='active', updated_at=now();

INSERT INTO athletes (id, user_id, sport_id, first_name, last_name, parcours_readiness, created_at)
SELECT gen_random_uuid(), id, (SELECT football_sport_id FROM _cfg), first_name, last_name, '{}'::jsonb, now()
FROM users WHERE email LIKE 'demo+test-ath%@nexussports.ca';

-- one pipeline row (fires the cascade) + one favorite (the NO-ACTION children)
INSERT INTO recruiter_pipeline (id, recruiter_id, athlete_id, stage, moved_at, created_at)
SELECT gen_random_uuid(), r.id, a.id, 'ENGAGE', now(), now()
FROM users r
JOIN users au ON au.email = 'demo+test-ath01@nexussports.ca'
JOIN athletes a ON a.user_id = au.id
WHERE r.email = 'demo+test-rec01@nexussports.ca';

INSERT INTO recruiter_favorites (id, recruiter_id, athlete_id, created_at)
SELECT gen_random_uuid(), r.id, a.id, now()
FROM users r
JOIN users au ON au.email = 'demo+test-ath02@nexussports.ca'
JOIN athletes a ON a.user_id = au.id
WHERE r.email = 'demo+test-rec01@nexussports.ca';

\echo '--- Batch seeded. Verify cascade set ath01 status to RECRUTE: ---'
SELECT u.email, a.recruitment_status
FROM athletes a JOIN users u ON u.id = a.user_id
WHERE u.email LIKE 'demo+test-ath%@nexussports.ca';

COMMIT;
