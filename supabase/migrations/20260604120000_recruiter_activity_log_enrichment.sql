-- ════════════════════════════════════════════════════════════════
-- Iter 7.30a — Enrichissement de recruiter_activity_log
-- ════════════════════════════════════════════════════════════════
--
-- Contexte (DIAG iter 7.29) :
--   Le CHECK constraint de recruiter_activity_log autorise 18 action_type
--   mais seulement 9 sont alimentés par des triggers. Les 9 manquants
--   couvrent toute l'activité Listes (sprints 7.15-7.28), le retrait
--   de favori, et les réponses des coachs aux messages. De plus le
--   trigger pipeline existant capte uniquement new_stage, pas before_stage,
--   ce qui empêche d'afficher "Identifié → Contacté" dans le feed.
--
-- Cette migration :
--   1. Ajoute 6 nouveaux triggers (UNFAVORITED, LIST_CREATED,
--      ATHLETE_ADDED_TO_LIST, ATHLETE_REMOVED_FROM_LIST, LIST_NOTE_ADDED,
--      COACH_REPLY) qui couvrent les sprints récents.
--   2. Modifie log_pipeline_change pour capturer OLD.stage dans
--      details.before_stage (NULL sur INSERT, OLD.stage sur UPDATE).
--   3. AUCUN changement au CHECK constraint (les 18 action_type sont
--      déjà autorisés depuis le baseline).
--   4. AUCUN touch aux triggers existants qui fonctionnent
--      (log_note_added, log_favorite_added, log_profile_view,
--      log_new_athlete, log_athlete_update, log_review_submitted).
--
-- Pattern technique :
--   - Copie EXACTE du pattern existant : LANGUAGE plpgsql SECURITY DEFINER,
--     INSERT ... SELECT avec jointure athletes pour first_name/last_name.
--   - Ajout explicite de SET search_path = public sur chaque nouvelle
--     fonction (best practice Supabase, absente sur les fonctions baseline
--     mais pas un risque rétroactif).
--   - Idempotent : DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
--   - INSERT ... SELECT avec JOIN : si la jointure ne trouve pas la row
--     (cascade DELETE en cours), le SELECT retourne 0 rows → INSERT no-op
--     → pas d'erreur. Évite de logger des entrées spam lors d'une
--     suppression en cascade (ex : supprimer une liste de 20 athlètes ne
--     génère pas 20 entrées ATHLETE_REMOVED_FROM_LIST individuelles).
--
-- TODOs CONNUS (HORS-SCOPE de cette migration) :
--   - log_new_athlete insère pour TOUS les recruteurs sans filtre
--     sport/intérêt → bruyant. Filtrage produit à concevoir
--     séparément (ex: ne logguer que pour les recruteurs ayant des
--     favoris ou un pipeline dans le même sport que l'athlète créé).
--   - PROFILE_UPDATED ne capture pas le champ modifié. Enrichissement
--     futur pourrait stocker {field_name, old_value, new_value} dans
--     details, en multipliant les entrées par champ touché.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Étape 1 : Audit data AVANT migration ─────────────────────────

DO $$
DECLARE
  v_trigger_count INTEGER;
  v_log_count INTEGER;
BEGIN
  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger
  WHERE tgname LIKE 'trg_log_%' AND NOT tgisinternal;
  RAISE NOTICE '[audit-7.30a] Triggers trg_log_* existants AVANT migration : %', v_trigger_count;

  SELECT count(*) INTO v_log_count
  FROM public.recruiter_activity_log;
  RAISE NOTICE '[audit-7.30a] Lignes dans recruiter_activity_log : %', v_log_count;

  RAISE NOTICE '[audit-7.30a] OK — migration peut continuer.';
END $$;

-- ── Étape 2 : log_pipeline_change MODIFIÉ (ajoute before_stage) ──

CREATE OR REPLACE FUNCTION public.log_pipeline_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'PIPELINE_CHANGED',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'new_stage', NEW.stage,
      -- Iter 7.30a — capture du before_stage pour afficher "X → Y" dans le feed.
      -- Sur AFTER INSERT, OLD.* est NULL → before_stage NULL (1ère entrée pipeline).
      -- Sur AFTER UPDATE, OLD.stage est la valeur avant changement.
      'before_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END
    )
  FROM public.athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_pipeline_change() OWNER TO postgres;

-- Le trigger trg_log_pipeline existant pointe déjà sur cette fonction → CREATE
-- OR REPLACE FUNCTION suffit, pas besoin de redéclarer le trigger.

-- ── Étape 3 : log_unfavorited (AFTER DELETE on recruiter_favorites) ──

CREATE OR REPLACE FUNCTION public.log_unfavorited() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT OLD.recruiter_id, OLD.athlete_id, 'UNFAVORITED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name)
  FROM public.athletes a WHERE a.id = OLD.athlete_id;
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.log_unfavorited() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_unfavorited ON public.recruiter_favorites;
CREATE TRIGGER trg_log_unfavorited
  AFTER DELETE ON public.recruiter_favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.log_unfavorited();

-- ── Étape 4 : log_list_created (AFTER INSERT on recruiter_lists) ──

CREATE OR REPLACE FUNCTION public.log_list_created() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  VALUES (NEW.recruiter_id, NULL, NEW.id, 'LIST_CREATED',
    jsonb_build_object('list_name', NEW.name));
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_list_created() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_list_created ON public.recruiter_lists;
CREATE TRIGGER trg_log_list_created
  AFTER INSERT ON public.recruiter_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.log_list_created();

-- ── Étape 5 : log_list_member_added (AFTER INSERT on recruiter_list_members) ──
-- recruiter_id récupéré via jointure recruiter_lists (la table member ne le contient pas).

CREATE OR REPLACE FUNCTION public.log_list_member_added() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT l.recruiter_id, NEW.athlete_id, NEW.list_id, 'ATHLETE_ADDED_TO_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    )
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = NEW.athlete_id
  WHERE l.id = NEW.list_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_list_member_added() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_list_member_added ON public.recruiter_list_members;
CREATE TRIGGER trg_log_list_member_added
  AFTER INSERT ON public.recruiter_list_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_list_member_added();

-- ── Étape 6 : log_list_member_removed (AFTER DELETE on recruiter_list_members) ──
-- Cas cascade DELETE de la liste parente : recruiter_lists row peut être en
-- cours de suppression dans la même transaction. La jointure renvoie alors 0
-- rows → INSERT no-op (comportement voulu, on évite de spammer N entrées
-- "athlète retiré" quand le user supprime la liste entière).

CREATE OR REPLACE FUNCTION public.log_list_member_removed() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT l.recruiter_id, OLD.athlete_id, OLD.list_id, 'ATHLETE_REMOVED_FROM_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    )
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = OLD.athlete_id
  WHERE l.id = OLD.list_id;
  RETURN OLD;
END;
$$;

ALTER FUNCTION public.log_list_member_removed() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_list_member_removed ON public.recruiter_list_members;
CREATE TRIGGER trg_log_list_member_removed
  AFTER DELETE ON public.recruiter_list_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_list_member_removed();

-- ── Étape 7 : log_list_note_added (AFTER INSERT on recruiter_list_notes) ──

CREATE OR REPLACE FUNCTION public.log_list_note_added() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT NEW.recruiter_id, NULL, NEW.list_id, 'LIST_NOTE_ADDED',
    jsonb_build_object('list_name', l.name)
  FROM public.recruiter_lists l
  WHERE l.id = NEW.list_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_list_note_added() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_list_note_added ON public.recruiter_list_notes;
CREATE TRIGGER trg_log_list_note_added
  AFTER INSERT ON public.recruiter_list_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_list_note_added();

-- ── Étape 8 : log_coach_reply (AFTER INSERT on messages) ──
-- Logge UNIQUEMENT si :
--   - le sender est le coach de la conversation (NEW.sender_id = c.coach_id)
--   - le sender n'est pas le recruteur (défensif contre coach == recruiter)
-- Le recruiter_id ciblé = c.recruiter_id (le destinataire). Athlete_id = c.athlete_id
-- (pour navigation vers le profil athlète depuis le feed).

CREATE OR REPLACE FUNCTION public.log_coach_reply() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT c.recruiter_id, c.athlete_id, 'COACH_REPLY',
    jsonb_build_object(
      'first_name', u.first_name,
      'last_name', u.last_name,
      'conversation_id', c.id
    )
  FROM public.conversations c
  LEFT JOIN public.users u ON u.id = NEW.sender_id
  WHERE c.id = NEW.conversation_id
    AND NEW.sender_id = c.coach_id
    AND NEW.sender_id <> c.recruiter_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_coach_reply() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_log_coach_reply ON public.messages;
CREATE TRIGGER trg_log_coach_reply
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_coach_reply();

-- ── Étape 9 : Sanity check final (fail-loud) ─────────────────────

DO $$
DECLARE
  v_required TEXT[] := ARRAY[
    'trg_log_unfavorited',
    'trg_log_list_created',
    'trg_log_list_member_added',
    'trg_log_list_member_removed',
    'trg_log_list_note_added',
    'trg_log_coach_reply'
  ];
  v_name TEXT;
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_name IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = v_name AND NOT tgisinternal
    ) THEN
      v_missing := array_append(v_missing, v_name);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION '[sanity-7.30a] Triggers manquants après migration : %', v_missing;
  END IF;

  -- Vérifie que log_pipeline_change a bien été remplacée (contient before_stage).
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'log_pipeline_change'
      AND pronamespace = 'public'::regnamespace
      AND prosrc LIKE '%before_stage%'
  ) THEN
    RAISE EXCEPTION '[sanity-7.30a] log_pipeline_change ne contient pas before_stage — CREATE OR REPLACE FUNCTION a échoué silencieusement.';
  END IF;

  RAISE NOTICE '[sanity-7.30a] OK — 6 nouveaux triggers en place, log_pipeline_change enrichi.';
END $$;

COMMIT;
