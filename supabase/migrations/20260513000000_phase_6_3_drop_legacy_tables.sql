-- Phase 6.3 — DROP legacy tables + school_coaches.team_name
--
-- Context: Phase 6 unification complete. Toutes les tables legacy ont
-- été vidées en Bloc 2 (6.1.e). Le code applicatif n'a plus aucune
-- dépendance (validé via repo-wide grep post-6.2.h).
--
-- Ce qu'on DROP :
--   - leagues (legacy parent)
--   - league_coaches (legacy join)
--   - league_teams (legacy join)
--   - league_team_athletes (legacy join)
--   - school_coaches.team_name (legacy column, refacto admin 6.1.x)
--   - FK athletes_league_team_id_fkey (column reste pour onboarding insert null)
--
-- athletes.league_team_id COLONNE preservée — 2 INSERT
-- app/athlete/onboarding/page.tsx:495,599 utilisent encore
-- `league_team_id: null`. À DROP plus tard quand onboarding sera
-- refacto (P3 deferred).

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- Safety check 1 : tables vides (RAISE EXCEPTION bloque la TX sinon)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_leagues_count INT;
  v_lc_count INT;
  v_lt_count INT;
  v_lta_count INT;
BEGIN
  SELECT COUNT(*) INTO v_leagues_count FROM leagues;
  SELECT COUNT(*) INTO v_lc_count FROM league_coaches;
  SELECT COUNT(*) INTO v_lt_count FROM league_teams;
  SELECT COUNT(*) INTO v_lta_count FROM league_team_athletes;

  IF v_leagues_count > 0 THEN
    RAISE EXCEPTION 'leagues table not empty (% rows). Aborting DROP.', v_leagues_count;
  END IF;

  IF v_lc_count > 0 THEN
    RAISE EXCEPTION 'league_coaches table not empty (% rows). Aborting DROP.', v_lc_count;
  END IF;

  IF v_lt_count > 0 THEN
    RAISE EXCEPTION 'league_teams table not empty (% rows). Aborting DROP.', v_lt_count;
  END IF;

  IF v_lta_count > 0 THEN
    RAISE EXCEPTION 'league_team_athletes table not empty (% rows). Aborting DROP.', v_lta_count;
  END IF;

  RAISE NOTICE 'All 4 legacy tables confirmed empty. Proceeding with DROP.';
END $$;

-- ────────────────────────────────────────────────────────────────
-- Safety check 2 : school_coaches.team_name aucune non-null value
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM school_coaches
  WHERE team_name IS NOT NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'school_coaches.team_name has % non-null values. Aborting.', v_count;
  END IF;

  RAISE NOTICE 'school_coaches.team_name has 0 non-null values. Safe to DROP.';
END $$;

-- ────────────────────────────────────────────────────────────────
-- Step 1 : DROP FK externe pointant vers league_teams
-- (athletes.league_team_id → league_teams.id — bloquerait DROP TABLE)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_league_team_id_fkey;

-- ────────────────────────────────────────────────────────────────
-- Step 2 : DROP tables legacy (ordre : enfants → parents)
-- CASCADE pour cleanup automatique des RLS policies + triggers + index
-- ────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS league_team_athletes CASCADE;
DROP TABLE IF EXISTS league_teams CASCADE;
DROP TABLE IF EXISTS league_coaches CASCADE;
DROP TABLE IF EXISTS leagues CASCADE;

-- ────────────────────────────────────────────────────────────────
-- Step 3 : DROP colonne legacy school_coaches.team_name
-- ────────────────────────────────────────────────────────────────
ALTER TABLE school_coaches DROP COLUMN IF EXISTS team_name;

-- ────────────────────────────────────────────────────────────────
-- Verification post-DROP (RAISE EXCEPTION rollback la TX si partial)
-- ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Tables ne doivent plus exister
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name IN ('leagues', 'league_coaches', 'league_teams', 'league_team_athletes')
      AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'One or more legacy tables still exist after DROP';
  END IF;

  -- Colonne ne doit plus exister
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_coaches'
      AND column_name = 'team_name'
      AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'school_coaches.team_name still exists after DROP';
  END IF;

  -- FK ne doit plus exister
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'athletes_league_team_id_fkey'
      AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION 'athletes_league_team_id_fkey still exists';
  END IF;

  RAISE NOTICE 'Phase 6.3 DROP complete : 4 tables + 1 column + 1 FK removed.';
END $$;

COMMIT;
