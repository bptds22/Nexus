-- ═══════════════════════════════════════════════════════════════
-- Fix calc_cote_globale to preserve simple-mode direct writes on UPDATE.
--
-- The previous version asymmetrically preserved direct writes:
--   - INSERT: preserved when cote_globale is set AND all 14 traits NULL
--   - UPDATE: preserved only when cote_globale IS DISTINCT FROM OLD
--
-- That meant saving the same simple-mode rating twice fell into the
-- per-trait average branch on the second save. With all traits NULL
-- the v_count=0 branch sets NEW.cote_globale := NULL and cascades a
-- NULL to athletes.cote_globale_entraineur — wiping the rating.
--
-- This replays the function with a unified preservation rule that
-- works on both INSERT and UPDATE: if cote_globale is set AND all
-- 14 trait columns are NULL, preserve the direct write and cascade.
-- The trait-average branch only runs when at least one trait is set.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calc_cote_globale()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_count INT := 0;
BEGIN
  -- Unified simple-mode passthrough (replaces the old asymmetric
  -- INSERT-only branch + UPDATE-changed branch). Direct writes from
  -- the simple-mode star input arrive with cote_globale set and all
  -- per-trait columns NULL — preserve the value and cascade to the
  -- athletes denormalized column.
  IF NEW.cote_globale IS NOT NULL
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

  -- Detailed mode: derive cote_globale from per-trait average.
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
