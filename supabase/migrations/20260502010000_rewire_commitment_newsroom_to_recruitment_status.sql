-- ═══════════════════════════════════════════════════════════════
-- Rewire commitment newsroom emission from the dead
-- commitment_requests table to the canonical
-- athletes.recruitment_status column.
--
-- Background: Phase 2 wired emit_commitment_newsroom_event onto
-- commitment_requests UPDATE. Local DB has 0 rows there — the
-- table is unused. Real commitments flow:
--   recruiter_pipeline.stage = LETTRE_SIGNEE/ENGAGE
--     → sync_global_recruitment_status() cascade
--     → athletes.recruitment_status = 'RECRUTE'
-- The newsroom trigger should hook the canonical column.
--
-- This migration:
--   1. Drops the legacy trigger on commitment_requests.
--   2. Patches sync_global_recruitment_status() to also populate
--      athletes.committed_school_id from the recruiter whose
--      pipeline row produced the max stage. Without this, the
--      cascade leaves the school dangling — the newsroom event
--      title "X s'engage à Y" needs Y.
--   3. Replaces emit_commitment_newsroom_event() with a body that
--      reads athletes.recruitment_status / committed_school_id /
--      sport_id. Fires AFTER UPDATE OF recruitment_status when
--      transitioning into RECRUTE.
--   4. Backfills committed_school_id for any existing RECRUTE
--      athletes whose school is currently NULL — sourced from
--      the same pipeline row the cascade would have used. The
--      backfill UPDATE is on committed_school_id only, so the
--      new "AFTER UPDATE OF recruitment_status" trigger does NOT
--      fire (no spurious newsroom events for historical rows).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Drop legacy trigger ────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_commitment_newsroom_event ON commitment_requests;

-- ─── 2. Cascade now also writes committed_school_id ────────────
CREATE OR REPLACE FUNCTION sync_global_recruitment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_pipeline_stage TEXT;
  max_recruiter_id UUID;
  new_global_status recruitment_status;
  new_committed_school_id UUID;
BEGIN
  -- Tier guard: only Pro+ recruiters' pipeline writes propagate
  -- to the shared athletes.recruitment_status field.
  IF NOT public.user_has_pro(NEW.recruiter_id) THEN
    RETURN NEW;
  END IF;

  -- Compute the highest pipeline stage across ALL recruiters for
  -- this athlete, AND capture the recruiter_id of the row that
  -- produced it. Tiebreaker: most recent moved_at wins.
  SELECT stage, recruiter_id
    INTO max_pipeline_stage, max_recruiter_id
  FROM recruiter_pipeline
  WHERE athlete_id = NEW.athlete_id
  ORDER BY CASE stage
    WHEN 'IDENTIFIE'         THEN 1
    WHEN 'CONTACTE'          THEN 2
    WHEN 'EN_DISCUSSION'     THEN 3
    WHEN 'VISITE_PLANIFIEE'  THEN 4
    WHEN 'ENGAGE'            THEN 5
    WHEN 'LETTRE_SIGNEE'     THEN 6
    ELSE 0
  END DESC,
  moved_at DESC NULLS LAST
  LIMIT 1;

  IF max_pipeline_stage IN ('ENGAGE', 'LETTRE_SIGNEE') THEN
    new_global_status := 'RECRUTE';
    -- Source the committing CÉGEP from the recruiter whose row
    -- produced the max stage.
    SELECT school_id INTO new_committed_school_id
    FROM users
    WHERE id = max_recruiter_id;
  ELSIF max_pipeline_stage IN ('EN_DISCUSSION', 'VISITE_PLANIFIEE') THEN
    new_global_status := 'EN_PROCESSUS';
    new_committed_school_id := NULL;
  ELSE
    new_global_status := 'OUVERT';
    new_committed_school_id := NULL;
  END IF;

  -- Same precedence guard as before: only update if no manual
  -- override is set, or if the cascade is upgrading. This
  -- preserves coach/admin manual overrides at higher tiers.
  UPDATE athletes
  SET recruitment_status = new_global_status,
      committed_school_id = new_committed_school_id,
      recruitment_status_changed_at = now(),
      recruitment_status_changed_by = NULL
  WHERE id = NEW.athlete_id
    AND (
      recruitment_status_changed_by IS NULL
      OR
      CASE new_global_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
      >
      CASE recruitment_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
    );

  RETURN NEW;
END;
$$;

-- ─── 3. Newsroom emit function — new shape ─────────────────────
CREATE OR REPLACE FUNCTION emit_commitment_newsroom_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
BEGIN
  -- Only on transition INTO 'RECRUTE'
  IF NEW.recruitment_status = 'RECRUTE'
     AND (OLD.recruitment_status IS NULL OR OLD.recruitment_status IS DISTINCT FROM 'RECRUTE') THEN

    -- Skip if athlete is not partner-eligible
    IF NOT is_partner_eligible_athlete(NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Resolve display fields. School name comes from the
    -- committed_school_id populated by the cascade; sport name
    -- from the athlete's primary sport.
    SELECT
      NEW.first_name || ' ' || NEW.last_name,
      sch.name,
      s.nom
    INTO v_athlete_name, v_school_name, v_sport_name
    FROM (SELECT 1) dummy
    LEFT JOIN schools sch ON sch.id = NEW.committed_school_id
    LEFT JOIN sports s ON s.id = NEW.sport_id;

    INSERT INTO newsroom_events (
      event_type, athlete_id, school_id, sport_id,
      title, description, metadata, occurred_at
    ) VALUES (
      'COMMITMENT',
      NEW.id,
      NEW.committed_school_id,
      NEW.sport_id,
      v_athlete_name || ' s''engage à ' || COALESCE(v_school_name, 'un CÉGEP'),
      'Engagement confirmé en ' || COALESCE(v_sport_name, 'sport-études'),
      jsonb_build_object(
        'school_id', NEW.committed_school_id,
        'school_name', v_school_name,
        'sport_name', v_sport_name
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 4. Bind new trigger to the canonical surface ──────────────
CREATE TRIGGER trigger_commitment_newsroom_event
AFTER UPDATE OF recruitment_status ON athletes
FOR EACH ROW
EXECUTE FUNCTION emit_commitment_newsroom_event();

-- ─── 5. Backfill committed_school_id for existing RECRUTE rows ─
-- Only updates committed_school_id (NOT recruitment_status), so
-- the new trigger above does not fire.
UPDATE athletes
SET committed_school_id = (
  SELECT u.school_id
  FROM recruiter_pipeline rp
  JOIN users u ON u.id = rp.recruiter_id
  WHERE rp.athlete_id = athletes.id
    AND rp.stage IN ('LETTRE_SIGNEE', 'ENGAGE')
    AND public.user_has_pro(rp.recruiter_id)
  ORDER BY
    CASE rp.stage
      WHEN 'LETTRE_SIGNEE' THEN 6
      WHEN 'ENGAGE'        THEN 5
      ELSE 0
    END DESC,
    rp.moved_at DESC NULLS LAST
  LIMIT 1
)
WHERE recruitment_status = 'RECRUTE'
  AND committed_school_id IS NULL;

COMMIT;
