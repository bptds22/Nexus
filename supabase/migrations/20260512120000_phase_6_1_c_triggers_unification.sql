-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.c — Triggers unification pour le modèle teams+team_athletes
--
-- Réécrit 2 functions+triggers du Flow A pour pointer vers les
-- tables unifiées (team_athletes + athletes.school_id) au lieu de
-- league_team_athletes + athletes.league_team_id.
--
-- ─ apply_team_invitation_acceptance ─
--   Now INSERTs team_athletes (junction unifiée), set
--   athletes.school_id depuis teams.school_id, set athletes.coach_id
--   depuis invited_by_coach_id (si pas déjà set).
--   Idempotent sur re-acceptance (OLD.status='ACCEPTED' → no-op).
--
-- ─ reset_athlete_anchor_on_team_remove ─
--   Attached to team_athletes AFTER DELETE.
--   Nouvelle sémantique :
--     - school type SECONDAIRE/CEGEP → ne touche pas school_id
--       (athlète garde son école même sans team)
--     - school type LIGUE_CIVILE → null-out school_id si pas
--       d'autres teams civiles, OU repoint vers la plus récente.
--
-- Anciens triggers sur league_team_athletes RESTENT EN PLACE per
-- spec (drop en Phase 6.3 via CASCADE quand on dropera la table).
-- Conséquence connue : la legacy trigger
-- reset_athlete_anchor_on_team_remove sur league_team_athletes
-- appelle la function REPLACEd qui attend NEW.team_id ; un DELETE
-- sur league_team_athletes errerait. Mitigé par : 0 user prod,
-- Bloc 2 va purger les 2 rows civiles, Phase 6.3 droppera la table.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. apply_team_invitation_acceptance — function + trigger
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_team_invitation_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_school_id uuid;
BEGIN
  IF NEW.status <> 'ACCEPTED' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'ACCEPTED' THEN
    -- Idempotent : déjà accepté, skip
    RETURN NEW;
  END IF;

  -- Résoudre school_id depuis teams (FK NOT NULL garantit non-null)
  SELECT school_id INTO v_team_school_id
  FROM teams
  WHERE id = NEW.team_id;

  IF v_team_school_id IS NULL THEN
    RAISE EXCEPTION 'Team % has NULL school_id — invalid state', NEW.team_id;
  END IF;

  -- (a) INSERT junction team_athletes (idempotent via ON CONFLICT)
  INSERT INTO team_athletes (team_id, athlete_id, joined_at)
  VALUES (NEW.team_id, NEW.athlete_id, now())
  ON CONFLICT (team_id, athlete_id) DO NOTHING;

  -- (b) UPDATE athletes : anchor school_id + propage coach_id si vide
  -- Note : on écrase school_id (invitation = transfert sémantique).
  -- coach_id : COALESCE pour préserver l'existant si déjà set.
  UPDATE athletes
  SET
    school_id = v_team_school_id,
    coach_id = COALESCE(athletes.coach_id, NEW.invited_by_coach_id)
  WHERE id = NEW.athlete_id;

  RETURN NEW;
END;
$$;

-- Drop both possible trigger names (defensive : 5.5e-iii-a created
-- it as apply_team_invitation_acceptance; spec wants _trigger suffix)
DROP TRIGGER IF EXISTS apply_team_invitation_acceptance ON public.team_invitations;
DROP TRIGGER IF EXISTS apply_team_invitation_acceptance_trigger ON public.team_invitations;

CREATE TRIGGER apply_team_invitation_acceptance_trigger
AFTER UPDATE OF status ON public.team_invitations
FOR EACH ROW
WHEN (NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED')
EXECUTE FUNCTION public.apply_team_invitation_acceptance();

-- ────────────────────────────────────────────────────────────────
-- 2. reset_athlete_anchor_on_team_remove — function + trigger
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reset_athlete_anchor_on_team_remove()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_school_type text;
  v_other_civil_count int;
  v_deleted_school_id uuid;
BEGIN
  -- Type de la school liée à la team supprimée
  SELECT s.type, s.id INTO v_team_school_type, v_deleted_school_id
  FROM schools s
  JOIN teams t ON t.school_id = s.id
  WHERE t.id = OLD.team_id;

  -- School n'existe plus (cascade en cours) → exit silently
  IF v_team_school_type IS NULL THEN
    RETURN OLD;
  END IF;

  -- SECONDAIRE/CEGEP : athlète garde son school_id (école persiste
  -- au-delà d'une team isolée). Exit.
  IF v_team_school_type IN ('SECONDAIRE', 'CEGEP') THEN
    RETURN OLD;
  END IF;

  -- LIGUE_CIVILE : compter les autres teams civiles de l'athlète
  SELECT COUNT(*) INTO v_other_civil_count
  FROM team_athletes ta
  JOIN teams t ON t.id = ta.team_id
  JOIN schools s ON s.id = t.school_id
  WHERE ta.athlete_id = OLD.athlete_id
    AND s.type = 'LIGUE_CIVILE'
    AND ta.team_id <> OLD.team_id;

  IF v_other_civil_count = 0 THEN
    -- Aucune autre team civile : null-out school_id si match
    UPDATE athletes
    SET school_id = NULL
    WHERE id = OLD.athlete_id
      AND school_id = v_deleted_school_id;
  ELSE
    -- Repoint vers la plus récente des autres teams civiles
    UPDATE athletes
    SET school_id = (
      SELECT t.school_id
      FROM team_athletes ta
      JOIN teams t ON t.id = ta.team_id
      JOIN schools s ON s.id = t.school_id
      WHERE ta.athlete_id = OLD.athlete_id
        AND s.type = 'LIGUE_CIVILE'
        AND ta.team_id <> OLD.team_id
      ORDER BY ta.joined_at DESC NULLS LAST
      LIMIT 1
    )
    WHERE id = OLD.athlete_id
      AND school_id = v_deleted_school_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Attacher le trigger sur team_athletes (nouvelle table unifiée)
-- Note : un trigger du même nom existe encore sur league_team_athletes
-- — Postgres scope les triggers par table, donc pas de conflit.
DROP TRIGGER IF EXISTS reset_athlete_anchor_on_team_remove ON public.team_athletes;

CREATE TRIGGER reset_athlete_anchor_on_team_remove
AFTER DELETE ON public.team_athletes
FOR EACH ROW
EXECUTE FUNCTION public.reset_athlete_anchor_on_team_remove();

-- ────────────────────────────────────────────────────────────────
-- Sanity check intra-TX
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Function apply_team_invitation_acceptance exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'apply_team_invitation_acceptance'
  ) THEN
    RAISE EXCEPTION 'Function apply_team_invitation_acceptance missing';
  END IF;

  -- Function reset_athlete_anchor_on_team_remove exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'reset_athlete_anchor_on_team_remove'
  ) THEN
    RAISE EXCEPTION 'Function reset_athlete_anchor_on_team_remove missing';
  END IF;

  -- New trigger attached to team_invitations
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'apply_team_invitation_acceptance_trigger'
      AND event_object_table = 'team_invitations'
  ) THEN
    RAISE EXCEPTION 'Trigger apply_team_invitation_acceptance_trigger missing on team_invitations';
  END IF;

  -- New trigger attached to team_athletes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'reset_athlete_anchor_on_team_remove'
      AND event_object_table = 'team_athletes'
  ) THEN
    RAISE EXCEPTION 'Trigger reset_athlete_anchor_on_team_remove missing on team_athletes';
  END IF;

  -- Old trigger on team_invitations should be gone
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'apply_team_invitation_acceptance'
      AND event_object_table = 'team_invitations'
  ) THEN
    RAISE EXCEPTION 'Old trigger apply_team_invitation_acceptance still on team_invitations';
  END IF;
END $$;

COMMIT;
