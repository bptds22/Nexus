-- ═══════════════════════════════════════════════════════════════
-- Rewire 5-star newsroom emission from evaluations INSERT-only
-- to athletes.cote_globale_entraineur threshold cross.
--
-- Previous architecture fired AFTER INSERT ON evaluations and
-- skipped the much more common UPDATE path (the modifier UPSERTs
-- per coach_id/athlete_id, so first save INSERTs but every
-- subsequent rating save UPDATEs the same row). Result: zero
-- FIVE_STAR_SIGNUP events ever emitted in the local DB despite
-- multiple eligible 5-star athletes existing.
--
-- New architecture mirrors the commitment-newsroom rewire
-- (3bd3f13): trigger on the canonical denormalized rating column
-- athletes.cote_globale_entraineur, fires when the value crosses
-- 4.5 from below (or on INSERT with the value already ≥ 4.5).
-- The c59b44b cascade in calc_cote_globale ensures
-- cote_globale_entraineur reliably tracks the eval's cote_globale,
-- so any save through the modifier reaches the trigger.
--
-- Three changes in one atomic file:
--   1. Drop legacy trigger on evaluations.
--   2. Replace emit_five_star_newsroom_event with a body that
--      reads NEW.cote_globale_entraineur and uses athlete row
--      shape directly. Uses TG_OP to avoid referencing OLD on
--      INSERT.
--   3. Bind new trigger to athletes
--      AFTER INSERT OR UPDATE OF cote_globale_entraineur.
--
-- Backfill of existing eligible 5-star athletes is run as a
-- separate one-shot SQL after this migration applies and after
-- the partner_visibility opt-in flip — it can't go inside the
-- migration because the eligibility helper would short-circuit
-- before opt-in is set.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Drop legacy trigger ────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_five_star_newsroom_event ON evaluations;

-- ─── 2. Replace function — athletes-row shape ──────────────────
CREATE OR REPLACE FUNCTION emit_five_star_newsroom_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
BEGIN
  -- Must be at threshold
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  -- Threshold cross from below: on UPDATE, OLD must be NULL or < 4.5.
  -- TG_OP guard avoids referencing OLD on INSERT.
  IF TG_OP = 'UPDATE'
     AND OLD.cote_globale_entraineur IS NOT NULL
     AND OLD.cote_globale_entraineur >= 4.5 THEN
    RETURN NEW;
  END IF;

  -- Eligibility guard (opt-in + parental consent + verified +
  -- not modified-since-verification + cote_globale not null)
  IF NOT is_partner_eligible_athlete(NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Resolve display fields. School + sport via FK lookups.
  SELECT sch.name, s.nom
    INTO v_school_name, v_sport_name
  FROM (SELECT 1) dummy
  LEFT JOIN schools sch ON sch.id = NEW.school_id
  LEFT JOIN sports s ON s.id = NEW.sport_id;

  v_athlete_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.id,
    NEW.school_id,
    NEW.sport_id,
    v_athlete_name || ' atteint 5 étoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 — ' || COALESCE(v_sport_name, 'sport-études'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- ─── 3. Bind new trigger to athletes ───────────────────────────
CREATE TRIGGER trigger_five_star_newsroom_event
AFTER INSERT OR UPDATE OF cote_globale_entraineur ON athletes
FOR EACH ROW
EXECUTE FUNCTION emit_five_star_newsroom_event();

COMMIT;
