-- Athlete notification trigger for suggestion approvals/rejections
-- Formats titles cleanly for all suggestion types:
--   - Cote globale + 14 traits: "... mis à jour (4.5/5)"
--   - Distinctions: "... Distinctions mises à jour"
--   - Other fields (Taille, Poids, etc.): "... mis à jour"
-- Rejections: drop raw valeur_proposee (noisy for Distinctions JSON).

CREATE OR REPLACE FUNCTION public.notify_athlete_suggestion_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title TEXT;
  v_is_rating BOOLEAN;
BEGIN
  v_is_rating := NEW.champ IN (
    'Cote globale', 'Leadership', 'Discipline', 'Coachabilité',
    'Intelligence de jeu', 'Compétitivité', 'Esprit d''équipe',
    'Résilience', 'Attitude / Mentalité',
    'Vitesse / Explosivité', 'Force / Puissance', 'Endurance / Cardio',
    'Agilité / Coordination', 'Vision du jeu', 'Sens tactique'
  );

  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    IF NEW.champ = 'Distinctions' THEN
      v_title := 'Ton coach a approuvé ta suggestion : Distinctions mises à jour';
    ELSIF v_is_rating AND COALESCE(NEW.valeur_proposee, '') <> '' THEN
      v_title := 'Ton coach a approuvé ta suggestion : ' || NEW.champ
              || ' mis à jour (' || NEW.valeur_proposee || '/5)';
    ELSE
      v_title := 'Ton coach a approuvé ta suggestion : ' || COALESCE(NEW.champ, '')
              || ' mis à jour';
    END IF;

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_APPROVED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'valeur', NEW.valeur_proposee)
    );

  ELSIF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    v_title := 'Ton coach a rejeté ta suggestion : ' || COALESCE(NEW.champ, '');

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_REJECTED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'raison', NEW.raison_rejet)
    );
  END IF;

  RETURN NEW;
END;
$$;
