-- ═══════════════════════════════════════════════════════════════
-- Media Partners Phase 2 — Step 2: Newsroom event triggers
-- ═══════════════════════════════════════════════════════════════
--
-- Two triggers that write rows into newsroom_events when
-- editorially-meaningful events happen:
--
-- 1. COMMITMENT — fires on commitment_requests when status
--    transitions to 'CONFIRMED'. Reads commitment_requests.school_id
--    (renamed from spec's cegep_id — the schema uses a unified
--    schools table, not a separate cegep one).
--
-- 2. FIVE_STAR_SIGNUP — fires on evaluations INSERT when:
--      cote_globale >= 4.5
--      AND the prior MAX cote_globale for this athlete < 4.5
--    This catches both fresh signups (no prior evals) AND
--    existing athletes ascending to 5-star (prior evals existed
--    but never reached 4.5). More editorially meaningful for
--    partners than the original "first-eval-only" filter.
--
-- Both triggers gate on is_partner_eligible_athlete(athlete_id)
-- before emitting — non-eligible athletes never produce
-- newsroom rows in the first place.

-- ── 1. Commitment trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION emit_commitment_newsroom_event()
RETURNS TRIGGER AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
  v_sport_id UUID;
BEGIN
  -- Only on transition INTO 'CONFIRMED'
  IF NEW.status = 'CONFIRMED' AND (OLD.status IS NULL OR OLD.status != 'CONFIRMED') THEN
    -- Skip if athlete is not partner-eligible
    IF NOT is_partner_eligible_athlete(NEW.athlete_id) THEN
      RETURN NEW;
    END IF;

    -- Resolve display fields. School name comes from the
    -- commitment target (commitment_requests.school_id), sport
    -- comes from the athlete's primary sport.
    SELECT
      a.first_name || ' ' || a.last_name,
      a.sport_id,
      sch.name,
      s.nom
    INTO v_athlete_name, v_sport_id, v_school_name, v_sport_name
    FROM athletes a
    LEFT JOIN schools sch ON sch.id = NEW.school_id
    LEFT JOIN sports s ON s.id = a.sport_id
    WHERE a.id = NEW.athlete_id;

    INSERT INTO newsroom_events (
      event_type, athlete_id, school_id, sport_id,
      title, description, metadata, occurred_at
    ) VALUES (
      'COMMITMENT',
      NEW.athlete_id,
      NEW.school_id,
      v_sport_id,
      v_athlete_name || ' s''engage à ' || COALESCE(v_school_name, 'un CÉGEP'),
      'Engagement confirmé en ' || COALESCE(v_sport_name, 'sport-études'),
      jsonb_build_object(
        'school_id', NEW.school_id,
        'school_name', v_school_name,
        'sport_name', v_sport_name
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_commitment_newsroom_event ON commitment_requests;
CREATE TRIGGER trigger_commitment_newsroom_event
  AFTER INSERT OR UPDATE OF status ON commitment_requests
  FOR EACH ROW EXECUTE FUNCTION emit_commitment_newsroom_event();

-- ── 2. 5-star trigger (ascending threshold) ─────────────────
CREATE OR REPLACE FUNCTION emit_five_star_newsroom_event()
RETURNS TRIGGER AS $$
DECLARE
  v_prior_max NUMERIC;
  v_athlete_name TEXT;
  v_school_id UUID;
  v_school_name TEXT;
  v_sport_id UUID;
  v_sport_name TEXT;
BEGIN
  IF NEW.cote_globale IS NULL OR NEW.cote_globale < 4.5 THEN
    RETURN NEW;
  END IF;

  -- Prior max cote_globale across ALL evals for this athlete
  -- (excluding the row being inserted). If this is the first
  -- eval ever, MAX is NULL → COALESCE to 0. Crossing condition:
  -- prior_max < 4.5 AND new >= 4.5.
  SELECT COALESCE(MAX(e.cote_globale), 0)
  INTO v_prior_max
  FROM evaluations e
  WHERE e.athlete_id = NEW.athlete_id
    AND e.id != NEW.id
    AND e.created_at < NEW.created_at;

  IF v_prior_max >= 4.5 THEN
    -- Already passed the threshold previously — not news anymore.
    RETURN NEW;
  END IF;

  -- Eligibility gate
  IF NOT is_partner_eligible_athlete(NEW.athlete_id) THEN
    RETURN NEW;
  END IF;

  SELECT
    a.first_name || ' ' || a.last_name,
    a.school_id,
    sch.name,
    a.sport_id,
    s.nom
  INTO v_athlete_name, v_school_id, v_school_name, v_sport_id, v_sport_name
  FROM athletes a
  LEFT JOIN schools sch ON sch.id = a.school_id
  LEFT JOIN sports s ON s.id = a.sport_id
  WHERE a.id = NEW.athlete_id;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.athlete_id,
    v_school_id,
    v_sport_id,
    'Nouvelle 5 étoiles : ' || v_athlete_name,
    v_athlete_name || ' rejoint Nexus avec une cote initiale de ' || NEW.cote_globale,
    jsonb_build_object(
      'cote_globale', NEW.cote_globale,
      'prior_max', v_prior_max,
      'school_name', v_school_name,
      'sport_name', v_sport_name
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_five_star_newsroom_event ON evaluations;
CREATE TRIGGER trigger_five_star_newsroom_event
  AFTER INSERT ON evaluations
  FOR EACH ROW EXECUTE FUNCTION emit_five_star_newsroom_event();
