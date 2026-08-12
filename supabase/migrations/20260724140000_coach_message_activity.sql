-- ═══════════════════════════════════════════════════════════════════════
-- Notification tableau de bord — parité message coach↔coach (correctif #6)
--
-- Aujourd'hui log_coach_activity_message ne crée une activité NEW_MESSAGE
-- (fil « Activités » + badge sidebar du coach destinataire) QUE pour
-- RECRUTEUR_COACH (recruteur → coach). Un message COACH_COACH — direct OU
-- diffusion (« tous les entraîneurs ») — ne notifiait PAS le coach
-- destinataire → il ne « recevait » rien au tableau de bord (cf. #2b).
--
-- On ÉTEND le trigger : un message COACH_COACH crée une activité NEW_MESSAGE
-- pour le coach destinataire (le participant qui n'est PAS l'expéditeur), avec
-- le nom de l'expéditeur en metadata. Vaut pour direct + diffusion (le RPC de
-- diffusion insère des messages normaux → ce trigger AFTER INSERT s'applique).
-- RECRUTEUR_COACH inchangé. CREATE OR REPLACE pur, idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_coach_activity_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conv      RECORD;
  v_athlete   RECORD;
  v_recipient uuid;
  v_sender    RECORD;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  IF v_conv.conversation_type = 'RECRUTEUR_COACH'
     AND v_conv.coach_id IS NOT NULL
     AND NEW.sender_id != v_conv.coach_id THEN
    SELECT first_name, last_name INTO v_athlete
    FROM athletes WHERE id = v_conv.athlete_id;

    INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
    VALUES (
      'NEW_MESSAGE', NEW.sender_id, 'recruiter', v_conv.athlete_id, v_conv.coach_id,
      jsonb_build_object(
        'first_name', COALESCE(v_athlete.first_name, ''),
        'last_name', COALESCE(v_athlete.last_name, ''),
        'conversation_id', NEW.conversation_id,
        'preview', LEFT(NEW.content, 100)
      )
    );

  ELSIF v_conv.conversation_type = 'COACH_COACH' THEN
    -- Destinataire = le participant qui n'est PAS l'expéditeur.
    v_recipient := CASE WHEN NEW.sender_id = v_conv.coach_id
                        THEN v_conv.coach_b_id ELSE v_conv.coach_id END;
    IF v_recipient IS NOT NULL AND v_recipient <> NEW.sender_id THEN
      SELECT first_name, last_name INTO v_sender FROM users WHERE id = NEW.sender_id;
      INSERT INTO activities (type, actor_id, actor_role, coach_id, metadata)
      VALUES (
        'NEW_MESSAGE', NEW.sender_id, 'coach', v_recipient,
        jsonb_build_object(
          'first_name', COALESCE(v_sender.first_name, ''),
          'last_name', COALESCE(v_sender.last_name, ''),
          'conversation_id', NEW.conversation_id,
          'preview', LEFT(NEW.content, 100)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
