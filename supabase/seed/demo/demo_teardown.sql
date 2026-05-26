-- =============================================================================
-- NEXUS DEMO TEARDOWN  —  demo_teardown.sql
-- =============================================================================
-- Reverses demo_seed.sql EXACTLY. After running, every key table's row count
-- returns to its pre-seed baseline (see demo_baseline.sql to capture/compare).
--
-- WHY THIS IS ORDERED, NOT A CASCADE (audited facts):
--   * auth.users / public.users -> athletes is SET NULL, NOT cascade. Deleting
--     users first would ORPHAN athletes AND destroy the email anchor (the tag
--     lives on users.email). So we STASH athlete ids FIRST.
--   * 4 child tables are NO ACTION (block athlete delete): recruiter_favorites,
--     recruiter_notes, recruiter_athlete_views, recruiter_pipeline. These must
--     be deleted BEFORE athletes or the delete fails.
--   * The other ~21 children are ON DELETE CASCADE => deleting athletes fans
--     them out automatically (team_athletes, evaluations, custom_distinctions,
--     conversations, notifications, etc.).
--   * coach_reviews is SET NULL (survives, pointer nulled) — but demo coach
--     reviews are tied to demo users, so we clean them explicitly.
--
-- ORDER: stash ids -> delete 4 NO-ACTION children -> delete subscriptions +
--        coach_badges + evaluations (by demo ids) -> delete athletes (CASCADE
--        fans the rest) -> delete users -> [optional] delete auth.users.
--
-- SAFETY: one transaction. Any error => nothing deletes. Run demo_baseline.sql
--         before AND after; success = counts match the "before" snapshot.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. STASH — resolve every demo id BEFORE deleting anything (SET NULL would
--    sever the link mid-teardown otherwise).
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _demo_users ON COMMIT DROP AS
SELECT id, email, role FROM users WHERE email LIKE 'demo+%@nexussports.ca';

CREATE TEMP TABLE _demo_athletes ON COMMIT DROP AS
SELECT a.id
FROM athletes a
JOIN _demo_users u ON u.id = a.user_id;

CREATE TEMP TABLE _demo_recruiters ON COMMIT DROP AS
SELECT id FROM _demo_users WHERE role = 'RECRUTEUR';

CREATE TEMP TABLE _demo_coaches ON COMMIT DROP AS
SELECT id FROM _demo_users WHERE role = 'COACH';

-- Report what we're about to remove (visible in psql output).
\echo '--- About to delete (counts) ---'
SELECT
  (SELECT count(*) FROM _demo_users)     AS demo_users,
  (SELECT count(*) FROM _demo_athletes)  AS demo_athletes,
  (SELECT count(*) FROM _demo_recruiters)AS demo_recruiters,
  (SELECT count(*) FROM _demo_coaches)   AS demo_coaches;

-- -----------------------------------------------------------------------------
-- 1. DELETE THE 4 NO-ACTION CHILDREN (these block athlete delete).
--    Match by BOTH athlete_id (demo athletes) AND recruiter_id (demo recruiters)
--    so we catch every row the seed created, regardless of direction.
-- -----------------------------------------------------------------------------
DELETE FROM recruiter_pipeline
WHERE athlete_id   IN (SELECT id FROM _demo_athletes)
   OR recruiter_id IN (SELECT id FROM _demo_recruiters);

DELETE FROM recruiter_favorites
WHERE athlete_id   IN (SELECT id FROM _demo_athletes)
   OR recruiter_id IN (SELECT id FROM _demo_recruiters);

-- recruiter_notes + recruiter_athlete_views: the seed doesn't create these, but
-- the beta WILL (friends taking notes / viewing). Clean defensively so teardown
-- is correct for BOTH the marketing seed and the post-beta state.
DELETE FROM recruiter_notes
WHERE athlete_id   IN (SELECT id FROM _demo_athletes)
   OR recruiter_id IN (SELECT id FROM _demo_recruiters);

DELETE FROM recruiter_athlete_views
WHERE athlete_id   IN (SELECT id FROM _demo_athletes)
   OR recruiter_id IN (SELECT id FROM _demo_recruiters);

-- -----------------------------------------------------------------------------
-- 2. DELETE child rows keyed on demo COACHES / RECRUITERS that don't cascade
--    from athlete deletion (coach_badges keyed on coach; evaluations cascade
--    from athlete but we also catch any keyed only on demo coach).
-- -----------------------------------------------------------------------------
DELETE FROM coach_badges WHERE coach_id IN (SELECT id FROM _demo_coaches);

DELETE FROM evaluations
WHERE athlete_id IN (SELECT id FROM _demo_athletes)
   OR coach_id   IN (SELECT id FROM _demo_coaches);

-- coach_reviews is SET NULL from athletes, but demo reviews tie to demo users.
DELETE FROM coach_reviews
WHERE coach_id   IN (SELECT id FROM _demo_coaches)
   OR athlete_id IN (SELECT id FROM _demo_athletes);

-- subscriptions: one per demo recruiter (and any other demo user we gave one).
DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM _demo_users);

-- -----------------------------------------------------------------------------
-- 3. DELETE ATHLETES — the ~21 CASCADE children fan out automatically here
--    (team_athletes, custom_distinctions, conversations, notifications, etc.).
-- -----------------------------------------------------------------------------
DELETE FROM athletes WHERE id IN (SELECT id FROM _demo_athletes);

-- -----------------------------------------------------------------------------
-- 4. DELETE USERS — now safe; nothing points at them with a blocking FK.
-- -----------------------------------------------------------------------------
DELETE FROM users WHERE id IN (SELECT id FROM _demo_users);

-- -----------------------------------------------------------------------------
-- 5. AUTH.USERS — only relevant for beta accounts (friends who self-registered)
--    and any demo users that also exist in auth.users. public.users does NOT
--    cascade to auth.users, so remove them explicitly by the same email anchor.
--    SAFE: the two admin accounts never match 'demo+%' so they are untouched.
--    If your environment manages auth.users separately (e.g. via Supabase
--    dashboard), you may run this block there instead.
-- -----------------------------------------------------------------------------
DELETE FROM auth.users WHERE email LIKE 'demo+%@nexussports.ca';

\echo '--- Teardown complete. Run demo_baseline.sql to confirm counts reverted. ---'

COMMIT;
