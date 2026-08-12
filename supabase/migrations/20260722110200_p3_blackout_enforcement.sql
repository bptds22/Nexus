-- ═══════════════════════════════════════════════════════════════════════
-- P3 — Lot A (3/4) : enforcement du black-out (trigger, DB-level)
--
-- Décision BP : black-out = MUTE DES DEUX CÔTÉS (recruteur ET athlète). Pendant
-- une plage active, ni la création d'un fil recruteur↔athlète ni l'envoi d'un
-- message (peu importe l'expéditeur) ne sont permis. Le fil EXISTANT continue
-- (il n'est pas archivé) — seul l'envoi est suspendu, il reprend après.
--
-- Enforcement par TRIGGER BEFORE INSERT (pas RLS) pour renvoyer un message
-- clair (bannière voix-ligue) plutôt qu'un 403 générique, et survivre aux
-- binaires figés (DB-level). Scopé RECRUTEUR_ATHLETE → P1 (recruteur↔coach,
-- athlète↔coach) INCHANGÉ. Un GLOBAL sert aussi de fenêtre de maintenance.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_messaging_blackout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type    public.conversation_type;
  v_athlete uuid;
BEGIN
  -- Résout (type, athlète) selon la table portant le trigger.
  IF TG_TABLE_NAME = 'conversations' THEN
    v_type := NEW.conversation_type;
    v_athlete := NEW.athlete_id;
  ELSE  -- messages
    SELECT c.conversation_type, c.athlete_id
      INTO v_type, v_athlete
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blackout_conversations ON public.conversations;
CREATE TRIGGER trg_blackout_conversations
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_messaging_blackout();

DROP TRIGGER IF EXISTS trg_blackout_messages ON public.messages;
CREATE TRIGGER trg_blackout_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_messaging_blackout();
