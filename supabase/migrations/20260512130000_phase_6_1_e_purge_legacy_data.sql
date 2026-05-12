-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.e — Purge data des tables legacy
--
-- Context: 0 user prod, mock data only. On vide les 4 tables legacy
-- pour clean state. Les tables elles-mêmes restent (DROP en 6.3)
-- pour permettre à Phase 6.2 (code unification) de continuer sans
-- broken FK references dans le code legacy.
--
-- IMPORTANT : Bloc 1.c a laissé le legacy trigger
-- reset_athlete_anchor_on_team_remove attaché à league_team_athletes,
-- avec la function REPLACEd qui attend NEW.team_id (au lieu de
-- NEW.league_team_id). Un DELETE sur league_team_athletes errerait
-- au runtime. On DROP ce trigger AVANT le DELETE.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 0. Drop the legacy trigger on league_team_athletes
-- ────────────────────────────────────────────────────────────────
-- Function reset_athlete_anchor_on_team_remove() reste en place
-- (utilisée par le trigger actuel sur team_athletes). On supprime
-- juste le binding sur la legacy table.

DROP TRIGGER IF EXISTS reset_athlete_anchor_on_team_remove
  ON public.league_team_athletes;

-- ────────────────────────────────────────────────────────────────
-- 1. Reset les athletes anchored sur legacy league_teams
-- ────────────────────────────────────────────────────────────────
-- Inclut Alex original (7f7efb96) + MutTest (f86c0c61) anchored à
-- paTS active (85c90887) suite à la migration team de session.
-- Le seed 6.1.d a créé un Alex test distinct (00000000-...-001) qui
-- est anchored au nouveau modèle (schools LIGUE_CIVILE).

UPDATE athletes
SET league_team_id = NULL
WHERE league_team_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 2. Vider les 4 tables legacy (ordre inverse des FKs)
-- ────────────────────────────────────────────────────────────────

DELETE FROM league_team_athletes;
DELETE FROM league_coaches;
DELETE FROM league_teams;
DELETE FROM leagues;

-- ────────────────────────────────────────────────────────────────
-- 3. Sanity check intra-TX
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM leagues;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'leagues not empty: % rows remain', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM league_coaches;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'league_coaches not empty: % rows remain', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM league_teams;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'league_teams not empty: % rows remain', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM league_team_athletes;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'league_team_athletes not empty: % rows remain', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM athletes WHERE league_team_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION '% athletes still have league_team_id set', v_count;
  END IF;

  RAISE NOTICE 'Legacy tables purged successfully';
END $$;

COMMIT;
