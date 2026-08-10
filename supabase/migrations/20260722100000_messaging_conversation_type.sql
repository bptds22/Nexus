-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie P1 — Lot A (1/3) : modèle multi-type + garde des triggers recruteur
--
-- Décision archi (BP, verrouillée) : ÉTENDRE, pas paralléliser. On ajoute un
-- discriminateur `conversation_type` sur `conversations`, on rend `recruiter_id`
-- NULLABLE (athlete↔coach n'a pas de recruteur) et on réserve `parent_id` pour
-- P2. L'ancre reste `athlete_id` (toujours exactement un athlète-sujet, NOT NULL).
--
-- SÛRETÉ (expand-then-contract) : 100 % ADDITIF. Aucune colonne supprimée,
-- aucune contrainte durcie sur les lignes existantes, `DEFAULT 'RECRUTEUR_COACH'`
-- backfille implicitement. Les binaires mobiles figés (recruteur↔coach)
-- fournissent toujours recruiter_id+coach_id → aucun app cassé.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Enum. Les 4 valeurs sont déclarées d'emblée (P2/P3 réservés) pour que le
--    modèle accepte les phases futures SANS nouvelle migration d'enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
    CREATE TYPE public.conversation_type AS ENUM (
      'RECRUTEUR_COACH',   -- P0 existant (défaut)
      'ATHLETE_COACH',     -- P1 (ce chantier)
      'PARENT_COACH',      -- P2 réservé — bloqué sur le portail parental
      'RECRUTEUR_ATHLETE'  -- P3 réservé — blackout admin, chantier ultérieur
    );
  END IF;
END $$;

-- 2. Colonne discriminante. DEFAULT → backfill implicite ; NOT NULL sûr.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS conversation_type public.conversation_type
    NOT NULL DEFAULT 'RECRUTEUR_COACH';

-- 3. recruiter_id : NOT NULL → NULLABLE. Additif au sens binaire (les inserts
--    existants fournissent toujours recruiter_id).
ALTER TABLE public.conversations
  ALTER COLUMN recruiter_id DROP NOT NULL;

-- 4. parent_id réservé (P2). Nullable, FK users. AUCUNE logique branchée dessus
--    en P1 — présence seule pour éviter une future migration contract-breaking.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.users(id) ON DELETE RESTRICT;

-- 5. Intégrité par type : chaque type exige les bonnes colonnes de participants.
--    NOT VALID puis VALIDATE : ne verrouille pas en écriture longue ; toutes les
--    lignes existantes sont RECRUTEUR_COACH (recruiter+coach non-null) → valide.
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_participants_by_type CHECK (
    CASE conversation_type
      WHEN 'RECRUTEUR_COACH'   THEN recruiter_id IS NOT NULL AND coach_id IS NOT NULL AND parent_id IS NULL
      WHEN 'ATHLETE_COACH'     THEN recruiter_id IS NULL     AND coach_id IS NOT NULL AND parent_id IS NULL
      WHEN 'PARENT_COACH'      THEN recruiter_id IS NULL     AND coach_id IS NOT NULL AND parent_id IS NOT NULL
      WHEN 'RECRUTEUR_ATHLETE' THEN recruiter_id IS NOT NULL AND coach_id IS NULL     AND parent_id IS NULL
    END
  ) NOT VALID;
ALTER TABLE public.conversations VALIDATE CONSTRAINT conversations_participants_by_type;

-- 6. Dé-doublonnage athlete↔coach : une seule conversation par (athlète, coach).
--    NB : il n'existe AUCUN unique sur le triple recruteur aujourd'hui (le
--    find-or-create recruteur reste applicatif — on ne le touche pas). Pour
--    ATHLETE_COACH on pose un unique PARTIEL, sans impact sur RECRUTEUR_COACH.
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_athlete_coach
  ON public.conversations (athlete_id, coach_id)
  WHERE conversation_type = 'ATHLETE_COACH';

-- ═══════════════════════════════════════════════════════════════════════
-- 7. GARDES DES TRIGGERS RECRUTEUR
--    Les 3 triggers recruteur infèrent le rôle POSITIONNELLEMENT (sender vs
--    recruiter_id/coach_id). Avec recruiter_id NULL ils seraient déjà inertes,
--    mais on refuse de dépendre d'un NULL positionnel : on ajoute un contrôle
--    EXPLICITE `conversation_type = 'RECRUTEUR_COACH'` (allowlist → tout type
--    futur est inerte par défaut).
--    `notify_on_message` n'est PAS modifié : il éventaile déjà vers coach_id +
--    athlete.user_id en ignorant un participant NULL → correct pour athlete↔coach.
-- ═══════════════════════════════════════════════════════════════════════

-- 7a. Pipeline → CONTACTE (ne doit toucher le pipeline que pour RECRUTEUR_COACH).
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
  -- Résout la conversation UNIQUEMENT si (a) le sender est le recruteur ET
  -- (b) la conversation est de type recruteur↔coach.
  SELECT c.recruiter_id, c.athlete_id
    INTO v_recruiter_id, v_athlete_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
    AND c.conversation_type = 'RECRUTEUR_COACH'   -- ← garde explicite (nouveau)
    AND c.recruiter_id = NEW.sender_id;

  IF v_recruiter_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO v_existing_stage
  FROM public.recruiter_pipeline
  WHERE recruiter_id = v_recruiter_id
    AND athlete_id = v_athlete_id;

  IF v_existing_stage IS NULL THEN
    INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
    VALUES (v_recruiter_id, v_athlete_id, 'CONTACTE')
    ON CONFLICT (recruiter_id, athlete_id) DO NOTHING;
  ELSIF v_existing_stage = 'IDENTIFIE' THEN
    UPDATE public.recruiter_pipeline
    SET stage = 'CONTACTE', moved_at = now(), updated_at = now()
    WHERE recruiter_id = v_recruiter_id
      AND athlete_id = v_athlete_id
      AND stage = 'IDENTIFIE';
  END IF;

  RETURN NEW;
END;
$function$;

-- 7b. Activité coach « NEW_MESSAGE » (hardcode actor_role='recruiter' → un
--     athlète serait mal étiqueté). Garde de type ajoutée.
CREATE OR REPLACE FUNCTION public.log_coach_activity_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv RECORD;
  v_athlete RECORD;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  IF v_conv.conversation_type = 'RECRUTEUR_COACH'          -- ← garde explicite (nouveau)
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
  END IF;
  RETURN NEW;
END;
$$;

-- 7c. Log « COACH_REPLY » vers recruiter_activity_log. Garde de type ajoutée
--     (recruiter_id NULL le rendait déjà inerte, mais on rend la garde explicite).
CREATE OR REPLACE FUNCTION public.log_coach_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT c.recruiter_id, c.athlete_id, 'COACH_REPLY',
    jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name, 'conversation_id', c.id)
  FROM public.conversations c
  LEFT JOIN public.users u ON u.id = NEW.sender_id
  WHERE c.id = NEW.conversation_id
    AND c.conversation_type = 'RECRUTEUR_COACH'   -- ← garde explicite (nouveau)
    AND NEW.sender_id = c.coach_id
    AND NEW.sender_id <> c.recruiter_id;
  RETURN NEW;
END;
$$;
