-- ═══════════════════════════════════════════════════════════════════════
-- P3 — Lot A (4/4) : pipeline auto-CONTACTE + notification premier contact
--
-- Décisions BP :
--   • Q4 = auto-CONTACTE sur contact direct : le 1er message du recruteur dans
--     un fil recruteur↔athlète fait avancer recruiter_pipeline à CONTACTE (comme
--     recruteur↔coach). On ÉTEND l'allowlist du trigger existant.
--   • Notifications : parent + coach reçoivent une notification au PREMIER
--     contact (création du fil), SANS accès au fil. Enregistrement assertable +
--     livraison best-effort via le plumbing existant (Vault + pg_net → send-push).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Pipeline → CONTACTE : allowlist étendue à RECRUTEUR_ATHLETE (contact direct).
CREATE OR REPLACE FUNCTION public.message_insert_to_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recruiter_id  uuid;
  v_athlete_id    uuid;
  v_existing_stage text;
BEGIN
  SELECT c.recruiter_id, c.athlete_id
    INTO v_recruiter_id, v_athlete_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
    AND c.conversation_type IN ('RECRUTEUR_COACH','RECRUTEUR_ATHLETE')  -- ← étendu P3
    AND c.recruiter_id = NEW.sender_id;

  IF v_recruiter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO v_existing_stage
  FROM public.recruiter_pipeline
  WHERE recruiter_id = v_recruiter_id AND athlete_id = v_athlete_id;

  IF v_existing_stage IS NULL THEN
    INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
    VALUES (v_recruiter_id, v_athlete_id, 'CONTACTE')
    ON CONFLICT (recruiter_id, athlete_id) DO NOTHING;
  ELSIF v_existing_stage = 'IDENTIFIE' THEN
    UPDATE public.recruiter_pipeline
    SET stage = 'CONTACTE', moved_at = now(), updated_at = now()
    WHERE recruiter_id = v_recruiter_id AND athlete_id = v_athlete_id AND stage = 'IDENTIFIE';
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Enregistrement de notification premier-contact (source de vérité + audit).
CREATE TABLE IF NOT EXISTS public.recruiter_contact_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  athlete_id      uuid,
  recruiter_id    uuid,
  notified_role   text NOT NULL CHECK (notified_role IN ('COACH','PARENT')),
  notified_ref    text,           -- user_id du coach (::text) ou parent_email
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recruiter_contact_notifications ENABLE ROW LEVEL SECURITY;
-- Admin lit tout (audit Loi 25) ; le coach lit ses propres notifications.
CREATE POLICY "rcn admin read" ON public.recruiter_contact_notifications
  FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "rcn coach read own" ON public.recruiter_contact_notifications
  FOR SELECT USING (notified_role = 'COACH' AND notified_ref = auth.uid()::text);
-- Écriture : uniquement via le trigger DEFINER ci-dessous (aucune policy INSERT).

-- 3. Trigger : au PREMIER contact (création du fil RA), notifie parent + coach.
CREATE OR REPLACE FUNCTION public.notify_first_recruiter_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_coach        uuid;
  v_parent_email text;
  v_secret       text;
  v_url          text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
BEGIN
  IF NEW.conversation_type <> 'RECRUTEUR_ATHLETE' THEN
    RETURN NEW;
  END IF;

  SELECT a.coach_id, nullif(a.parent_email, '')
    INTO v_coach, v_parent_email
  FROM public.athletes a WHERE a.id = NEW.athlete_id;

  -- Enregistrements (assertables + audit). Coach et/ou parent selon disponibilité.
  IF v_coach IS NOT NULL THEN
    INSERT INTO public.recruiter_contact_notifications (conversation_id, athlete_id, recruiter_id, notified_role, notified_ref)
    VALUES (NEW.id, NEW.athlete_id, NEW.recruiter_id, 'COACH', v_coach::text);
  END IF;
  IF v_parent_email IS NOT NULL THEN
    INSERT INTO public.recruiter_contact_notifications (conversation_id, athlete_id, recruiter_id, notified_role, notified_ref)
    VALUES (NEW.id, NEW.athlete_id, NEW.recruiter_id, 'PARENT', v_parent_email);
  END IF;

  -- Livraison best-effort (réutilise Vault + pg_net → send-push). Erreurs avalées.
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
    IF v_secret IS NOT NULL AND v_coach IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type','application/json','x-push-secret',v_secret),
        body := jsonb_build_object(
          'user_id', v_coach, 'title', 'Nexus',
          'body', 'Un recruteur a contacté votre athlète.',
          'data', jsonb_build_object('type','recruiter_contact','conversation_id', NEW.id))
      );
    END IF;
    -- Parent : email dédié via edge function (câblage ultérieur — l'enregistrement
    -- PARENT ci-dessus suffit pour l'audit + un futur worker d'envoi).
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_first_recruiter_contact: livraison échouée conv %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_first_recruiter_contact ON public.conversations;
CREATE TRIGGER trg_notify_first_recruiter_contact
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_first_recruiter_contact();
