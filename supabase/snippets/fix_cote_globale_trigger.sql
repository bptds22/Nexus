-- Patch calc_cote_globale trigger to preserve an explicit cote_globale
-- passed on INSERT (previously only UPDATE branch preserved it, so
-- backfilling an evaluations row with just cote_globale got overwritten to NULL).

BEGIN;

-- Restore Cole's rating
UPDATE athletes SET cote_globale_entraineur = 5.00
 WHERE first_name = 'Cole' AND last_name = 'Caufield';

-- Trigger patch
CREATE OR REPLACE FUNCTION public.calc_cote_globale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_count INT := 0;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.cote_globale IS NOT NULL
     AND NEW.cote_globale IS DISTINCT FROM OLD.cote_globale THEN
    UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.cote_globale IS NOT NULL
     AND NEW.vitesse_explosivite IS NULL AND NEW.force_puissance IS NULL
     AND NEW.endurance_cardio IS NULL AND NEW.agilite_coordination IS NULL
     AND NEW.vision_du_jeu IS NULL AND NEW.sens_tactique IS NULL
     AND NEW.leadership IS NULL AND NEW.discipline IS NULL
     AND NEW.coachabilite IS NULL AND NEW.intelligence_jeu IS NULL
     AND NEW.competitivite IS NULL AND NEW.esprit_equipe IS NULL
     AND NEW.resilience IS NULL AND NEW.attitude_mentalite IS NULL THEN
    UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
    RETURN NEW;
  END IF;

  IF NEW.vitesse_explosivite  IS NOT NULL THEN v_sum := v_sum + NEW.vitesse_explosivite;  v_count := v_count + 1; END IF;
  IF NEW.force_puissance      IS NOT NULL THEN v_sum := v_sum + NEW.force_puissance;      v_count := v_count + 1; END IF;
  IF NEW.endurance_cardio     IS NOT NULL THEN v_sum := v_sum + NEW.endurance_cardio;     v_count := v_count + 1; END IF;
  IF NEW.agilite_coordination IS NOT NULL THEN v_sum := v_sum + NEW.agilite_coordination; v_count := v_count + 1; END IF;
  IF NEW.vision_du_jeu        IS NOT NULL THEN v_sum := v_sum + NEW.vision_du_jeu;        v_count := v_count + 1; END IF;
  IF NEW.sens_tactique        IS NOT NULL THEN v_sum := v_sum + NEW.sens_tactique;        v_count := v_count + 1; END IF;
  IF NEW.leadership           IS NOT NULL THEN v_sum := v_sum + NEW.leadership;           v_count := v_count + 1; END IF;
  IF NEW.discipline           IS NOT NULL THEN v_sum := v_sum + NEW.discipline;           v_count := v_count + 1; END IF;
  IF NEW.coachabilite         IS NOT NULL THEN v_sum := v_sum + NEW.coachabilite;         v_count := v_count + 1; END IF;
  IF NEW.intelligence_jeu     IS NOT NULL THEN v_sum := v_sum + NEW.intelligence_jeu;     v_count := v_count + 1; END IF;
  IF NEW.competitivite        IS NOT NULL THEN v_sum := v_sum + NEW.competitivite;        v_count := v_count + 1; END IF;
  IF NEW.esprit_equipe        IS NOT NULL THEN v_sum := v_sum + NEW.esprit_equipe;        v_count := v_count + 1; END IF;
  IF NEW.resilience           IS NOT NULL THEN v_sum := v_sum + NEW.resilience;           v_count := v_count + 1; END IF;
  IF NEW.attitude_mentalite   IS NOT NULL THEN v_sum := v_sum + NEW.attitude_mentalite;   v_count := v_count + 1; END IF;

  IF v_count > 0 THEN
    NEW.cote_globale := ROUND(v_sum / v_count, 1);
  ELSE
    NEW.cote_globale := NULL;
  END IF;

  UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
  RETURN NEW;
END;
$$;

-- Clear the bad row then backfill
DELETE FROM evaluations WHERE athlete_id IN (SELECT id FROM athletes WHERE first_name='Cole' AND last_name='Caufield');

INSERT INTO evaluations (coach_id, athlete_id, cote_globale)
SELECT a.coach_id, a.id, a.cote_globale_entraineur
FROM athletes a
LEFT JOIN evaluations e ON e.athlete_id = a.id AND e.coach_id = a.coach_id
WHERE a.cote_globale_entraineur IS NOT NULL
  AND e.athlete_id IS NULL
  AND a.coach_id IS NOT NULL
ON CONFLICT (coach_id, athlete_id) DO UPDATE
  SET cote_globale = EXCLUDED.cote_globale;

COMMIT;
