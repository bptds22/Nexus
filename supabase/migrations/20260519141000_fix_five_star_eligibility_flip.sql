-- =============================================================================
-- Migration: Fix five-star newsroom event eligibility-flip bug
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New trigger function: emit on eligibility flip
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_five_star_on_eligibility_flip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
  v_was_eligible BOOLEAN;
  v_is_eligible BOOLEAN;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

  v_was_eligible :=
    COALESCE(OLD.partner_visibility_opt_in, false) = true
    AND (
      EXTRACT(YEAR FROM AGE(OLD.date_naissance)) >= 18
      OR COALESCE(OLD.partner_visibility_parental_consent, false) = true
    )
    AND COALESCE(OLD.verified, false) = true
    AND COALESCE(OLD.modified_since_verification, false) = false
    AND OLD.cote_globale_entraineur IS NOT NULL;

  v_is_eligible := is_partner_eligible_athlete(NEW.id);

  IF v_was_eligible OR NOT v_is_eligible THEN
    RETURN NEW;
  END IF;

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
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'eligibility_flip'
    ),
    NOW()
  );

  RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Trigger on eligibility-gating columns
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_five_star_eligibility_flip ON public.athletes;

CREATE TRIGGER trigger_five_star_eligibility_flip
AFTER UPDATE OF
  partner_visibility_opt_in,
  partner_visibility_parental_consent,
  verified,
  modified_since_verification,
  date_naissance
ON public.athletes
FOR EACH ROW
EXECUTE FUNCTION public.emit_five_star_on_eligibility_flip();

-- -----------------------------------------------------------------------------
-- 3. Idempotency safeguard on existing trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_five_star_newsroom_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.cote_globale_entraineur IS NOT NULL
     AND OLD.cote_globale_entraineur >= 4.5 THEN
    RETURN NEW;
  END IF;

  IF NOT is_partner_eligible_athlete(NEW.id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

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
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'rating_threshold_cross'
    ),
    NOW()
  );

  RETURN NEW;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 4. One-time backfill
-- -----------------------------------------------------------------------------
INSERT INTO newsroom_events (
  event_type, athlete_id, school_id, sport_id,
  title, description, metadata, occurred_at
)
SELECT
  'FIVE_STAR_SIGNUP',
  a.id,
  a.school_id,
  a.sport_id,
  a.first_name || ' ' || a.last_name || ' atteint 5 etoiles',
  'Cote globale ' || a.cote_globale_entraineur || ' / 5 - ' || COALESCE(s.nom, 'sport-etudes'),
  jsonb_build_object(
    'cote_globale', a.cote_globale_entraineur,
    'school_name', sch.name,
    'sport_name', s.nom,
    'emitted_via', 'backfill_migration'
  ),
  NOW()
FROM athletes a
LEFT JOIN schools sch ON sch.id = a.school_id
LEFT JOIN sports s ON s.id = a.sport_id
WHERE a.cote_globale_entraineur >= 4.5
  AND is_partner_eligible_athlete(a.id) = true
  AND NOT EXISTS (
    SELECT 1 FROM newsroom_events ne
    WHERE ne.athlete_id = a.id
      AND ne.event_type = 'FIVE_STAR_SIGNUP'
  );
