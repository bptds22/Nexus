-- ============================================================
-- supabase/seed/orphan_athletes_dev.sql
-- ⚠️ DEV ONLY — DO NOT RUN IN PRODUCTION ⚠️
--
-- Run locally:
--   docker exec -i supabase_db_Nexus psql -U postgres -d postgres \
--     < supabase/seed/orphan_athletes_dev.sql
--
-- Purpose: 8 diverse orphan athletes for /coach/decouvrir (5.5e-ii)
-- testing. Required for filter coverage (sport / position / promo /
-- verified / open_to_offers) and visual walks. Existing orphan
-- "Civil ATH" (id 2201a52c-...) is untouched — this seed adds to
-- the pool, doesn't replace anything.
--
-- Identification: every seeded row has notes_coach = 'SEED_DEV_ORPHAN'.
-- This is the only field used for cleanup — re-running the script
-- deletes ONLY rows with that marker, then re-inserts the 8.
--
-- Schema deviation noted: Hockey has no generic 'D' position; the DB
-- exposes LD (Défenseur gauche) and RD (Défenseur droit). The seed
-- uses LD for Liam Côté (closest fit to a generic "D" intent).
--
-- All 8 athletes are status='ACTIF' with school_id, league_team_id,
-- user_id, and coach_id all NULL — true orphans for Découvrir.
-- ============================================================

BEGIN;

-- Idempotent cleanup: only this seed's rows, identified by marker.
DELETE FROM athletes WHERE notes_coach = 'SEED_DEV_ORPHAN';

-- Insert 8 diverse orphan athletes. Sports/positions resolved via
-- name lookup rather than hardcoded UUIDs (resilient across envs).
WITH
  badminton_sport AS (SELECT id FROM sports WHERE nom = 'Badminton'),
  football_sport  AS (SELECT id FROM sports WHERE nom = 'Football'),
  hockey_sport    AS (SELECT id FROM sports WHERE nom = 'Hockey'),
  basketball_sport AS (SELECT id FROM sports WHERE nom = 'Basketball'),
  badminton_sgl AS (SELECT id FROM positions WHERE abreviation = 'SGL' AND sport_id = (SELECT id FROM badminton_sport)),
  badminton_dbl AS (SELECT id FROM positions WHERE abreviation = 'DBL' AND sport_id = (SELECT id FROM badminton_sport)),
  badminton_mix AS (SELECT id FROM positions WHERE abreviation = 'MIX' AND sport_id = (SELECT id FROM badminton_sport)),
  football_qb   AS (SELECT id FROM positions WHERE abreviation = 'QB'  AND sport_id = (SELECT id FROM football_sport)),
  football_wr   AS (SELECT id FROM positions WHERE abreviation = 'WR'  AND sport_id = (SELECT id FROM football_sport)),
  hockey_c      AS (SELECT id FROM positions WHERE abreviation = 'C'   AND sport_id = (SELECT id FROM hockey_sport)),
  hockey_ld     AS (SELECT id FROM positions WHERE abreviation = 'LD'  AND sport_id = (SELECT id FROM hockey_sport)),
  basketball_pg AS (SELECT id FROM positions WHERE abreviation = 'PG'  AND sport_id = (SELECT id FROM basketball_sport))
INSERT INTO athletes (
  first_name, last_name, sport_id, position_id,
  annee_diplomation, verified, open_to_offers, statut_recrutement_override,
  taille_pieds, taille_pouces, poids_lbs, cote_globale_entraineur,
  genre, date_naissance, status, notes_coach,
  school_id, league_team_id, user_id, coach_id
) VALUES
  ('Alex',    'Dubois',    (SELECT id FROM badminton_sport),  (SELECT id FROM badminton_sgl), 2026, true,  true,  'OUVERT',        5, 10, 155, 8.5, 'M', '2008-03-15', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Sophie',  'Martin',    (SELECT id FROM badminton_sport),  (SELECT id FROM badminton_dbl), 2027, true,  false, 'EN_DISCUSSION', 5,  6, 130, 7.5, 'F', '2009-07-22', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Lucas',   'Tremblay',  (SELECT id FROM badminton_sport),  (SELECT id FROM badminton_mix), 2028, false, true,  'OUVERT',        5,  8, 140, 6.5, 'M', '2010-01-10', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Emma',    'Roy',       (SELECT id FROM football_sport),   (SELECT id FROM football_qb),   2026, true,  true,  'OUVERT',        6,  0, 185, 9.0, 'M', '2008-09-30', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Noah',    'Gagnon',    (SELECT id FROM football_sport),   (SELECT id FROM football_wr),   2027, false, false, 'EN_DISCUSSION', 5, 11, 175, 7.0, 'M', '2009-04-18', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Lea',     'Bouchard',  (SELECT id FROM hockey_sport),     (SELECT id FROM hockey_c),      2028, true,  true,  'OUVERT',        5,  7, 145, 8.0, 'F', '2010-06-25', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Liam',    'Cote',      (SELECT id FROM hockey_sport),     (SELECT id FROM hockey_ld),     2026, false, true,  'OUVERT',        6,  2, 195, 7.5, 'M', '2008-11-12', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL),
  ('Mia',     'Pelletier', (SELECT id FROM basketball_sport), (SELECT id FROM basketball_pg), 2029, true,  false, 'EN_DISCUSSION', 5,  9, 140, 8.5, 'F', '2011-02-08', 'ACTIF', 'SEED_DEV_ORPHAN', NULL, NULL, NULL, NULL);

-- Verify
SELECT
  first_name, last_name,
  (SELECT nom FROM sports WHERE id = athletes.sport_id) AS sport,
  (SELECT abreviation FROM positions WHERE id = athletes.position_id) AS position,
  annee_diplomation, verified, open_to_offers, statut_recrutement_override
FROM athletes
WHERE notes_coach = 'SEED_DEV_ORPHAN'
ORDER BY first_name;

COMMIT;
