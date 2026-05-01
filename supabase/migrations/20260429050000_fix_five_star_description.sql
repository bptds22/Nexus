-- ═══════════════════════════════════════════════════════════════
-- Fix five-star trigger copy: branch description for new vs.
-- ascending athletes.
-- ═══════════════════════════════════════════════════════════════
--
-- The threshold-crossing logic from 20260429040000 catches both
-- new-signup 5-star (no prior evals) AND existing athletes
-- ascending to 5-star. The description string was previously
-- hardcoded to "rejoint Nexus avec une cote initiale de" which
-- only fits the first case. Branch on v_prior_max:
--   prior_max = 0 → "rejoint Nexus avec une cote initiale de X"
--   prior_max > 0 → "atteint le niveau 5 étoiles avec une cote de X"
--
-- Also surfaces is_ascending in the metadata jsonb so UI can
-- vary presentation (icon, badge, copy) without needing a new
-- event_type enum value.

CREATE OR REPLACE FUNCTION emit_five_star_newsroom_event()
RETURNS TRIGGER AS $$
DECLARE
  v_prior_max NUMERIC;
  v_athlete_name TEXT;
  v_school_id UUID;
  v_school_name TEXT;
  v_sport_id UUID;
  v_sport_name TEXT;
  v_description TEXT;
  v_is_ascending BOOLEAN;
BEGIN
  IF NEW.cote_globale IS NULL OR NEW.cote_globale < 4.5 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(e.cote_globale), 0)
  INTO v_prior_max
  FROM evaluations e
  WHERE e.athlete_id = NEW.athlete_id
    AND e.id != NEW.id
    AND e.created_at < NEW.created_at;

  IF v_prior_max >= 4.5 THEN
    RETURN NEW;
  END IF;

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

  v_is_ascending := v_prior_max > 0;
  v_description := CASE
    WHEN v_is_ascending THEN
      v_athlete_name || ' atteint le niveau 5 étoiles avec une cote de ' || NEW.cote_globale
    ELSE
      v_athlete_name || ' rejoint Nexus avec une cote initiale de ' || NEW.cote_globale
  END;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.athlete_id,
    v_school_id,
    v_sport_id,
    'Nouvelle 5 étoiles : ' || v_athlete_name,
    v_description,
    jsonb_build_object(
      'cote_globale', NEW.cote_globale,
      'prior_max', v_prior_max,
      'is_ascending', v_is_ascending,
      'school_name', v_school_name,
      'sport_name', v_sport_name
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
