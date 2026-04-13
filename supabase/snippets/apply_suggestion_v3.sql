CREATE OR REPLACE FUNCTION public.apply_approved_suggestion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_coach_id UUID;
  v_rows_updated INT;
  v_is_detailed BOOLEAN;
BEGIN
  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
    SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
    IF v_coach_id IS NULL THEN v_coach_id := NEW.coach_id; END IF;

    CASE NEW.champ
      WHEN 'Taille' THEN
        UPDATE athletes SET taille_pieds = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 1), '')::int,
          taille_pouces = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 2), '')::int
          WHERE id = NEW.athlete_id;
      WHEN 'Poids' THEN UPDATE athletes SET poids_lbs = NULLIF(replace(NEW.valeur_proposee, ' lbs', ''), '')::numeric WHERE id = NEW.athlete_id;
      WHEN 'Envergure' THEN UPDATE athletes SET envergure = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Taille mains' THEN UPDATE athletes SET taille_mains = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Main dominante' THEN UPDATE athletes SET main_dominante = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Pied dominant' THEN UPDATE athletes SET pied_dominant = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN '40 yards' THEN UPDATE athletes SET test_40_verges = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut vertical' THEN UPDATE athletes SET saut_vertical = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut longueur' THEN UPDATE athletes SET saut_longueur = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Développé couché' THEN UPDATE athletes SET developpe_couche = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Navette' THEN UPDATE athletes SET navette_agilite = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Sprint 100m' THEN UPDATE athletes SET sprint_100m = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Numéro' THEN UPDATE athletes SET numero_jersey = replace(NEW.valeur_proposee, '#', '') WHERE id = NEW.athlete_id;

      WHEN 'Cote globale' THEN
        SELECT (leadership IS NOT NULL OR discipline IS NOT NULL OR coachabilite IS NOT NULL OR intelligence_jeu IS NOT NULL OR competitivite IS NOT NULL OR esprit_equipe IS NOT NULL OR resilience IS NOT NULL OR attitude_mentalite IS NOT NULL)
          INTO v_is_detailed FROM evaluations WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        IF v_is_detailed THEN
          RAISE EXCEPTION 'Impossible d''appliquer une cote globale plate : l''évaluation détaillée est active pour cet athlète.';
        END IF;
        UPDATE athletes SET cote_globale_entraineur = NEW.valeur_proposee::numeric WHERE id = NEW.athlete_id;
        UPDATE evaluations SET cote_globale = NEW.valeur_proposee::numeric WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN
          INSERT INTO evaluations (athlete_id, coach_id, cote_globale) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::numeric)
            ON CONFLICT (coach_id, athlete_id) DO UPDATE SET cote_globale = EXCLUDED.cote_globale;
        END IF;

      WHEN 'Leadership' THEN
        UPDATE evaluations SET leadership = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, leadership) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET leadership = EXCLUDED.leadership; END IF;
      WHEN 'Discipline' THEN
        UPDATE evaluations SET discipline = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, discipline) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET discipline = EXCLUDED.discipline; END IF;
      WHEN 'Coachabilité' THEN
        UPDATE evaluations SET coachabilite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, coachabilite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET coachabilite = EXCLUDED.coachabilite; END IF;
      WHEN 'Intelligence de jeu' THEN
        UPDATE evaluations SET intelligence_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, intelligence_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET intelligence_jeu = EXCLUDED.intelligence_jeu; END IF;
      WHEN 'Compétitivité' THEN
        UPDATE evaluations SET competitivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, competitivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET competitivite = EXCLUDED.competitivite; END IF;
      WHEN 'Esprit d''équipe' THEN
        UPDATE evaluations SET esprit_equipe = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, esprit_equipe) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET esprit_equipe = EXCLUDED.esprit_equipe; END IF;
      WHEN 'Résilience' THEN
        UPDATE evaluations SET resilience = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, resilience) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET resilience = EXCLUDED.resilience; END IF;
      WHEN 'Attitude / Mentalité' THEN
        UPDATE evaluations SET attitude_mentalite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, attitude_mentalite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET attitude_mentalite = EXCLUDED.attitude_mentalite; END IF;

      WHEN 'Distinctions' THEN
        UPDATE evaluations SET distinctions = NEW.valeur_proposee::jsonb WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, distinctions) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET distinctions = EXCLUDED.distinctions; END IF;

      WHEN 'Distinction personnalisée' THEN
        INSERT INTO custom_distinctions (athlete_id, coach_id, title) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee);

      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
  END IF;

  RETURN NEW;
END;
$$;
