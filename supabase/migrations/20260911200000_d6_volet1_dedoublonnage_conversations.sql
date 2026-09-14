-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — VOLET 1 : dédoublonnage des conversations RECRUTEUR_COACH
--
-- Quatre conversations portent le MÊME triplet
-- (recruiter a0000000-…-a1, coach a0000000-…-a3, athlete 1d06342e-…),
-- toutes de type RECRUTEUR_COACH, créées entre le 2026-08-05 et le 2026-08-18.
-- Option A validée par BP : on re-pointe les dépendances des trois cadettes
-- vers la survivante, puis on supprime les trois.
--
-- ── POURQUOI RE-POINTER AVANT DE SUPPRIMER, ET PAS L'INVERSE ──────────────
-- Les TROIS clés étrangères qui pointent `conversations` sont en
-- ON DELETE CASCADE :
--     messages.conversation_id
--     conversation_participants.conversation_id
--     recruiter_contact_notifications.conversation_id
-- Un DELETE sec sur les trois doublons emporterait donc leurs messages SANS
-- erreur et sans trace. Le re-pointage n'est pas une politesse, c'est ce qui
-- distingue une fusion d'une perte de données.
--
-- ── CE QUI NE SE DÉCLENCHERA PAS, ET C'EST VOULU ──────────────────────────
-- Tous les triggers à effet de bord de `messages` sont AFTER **INSERT** :
-- notify_on_message, message_insert_to_pipeline, log_coach_reply,
-- log_coach_activity_message, touch_conversation_last_message. Un UPDATE de
-- `conversation_id` n'en réveille aucun — donc aucune notification fantôme,
-- aucune écriture pipeline rejouée, aucune activité coach dupliquée.
-- Le seul trigger BEFORE UPDATE, `trg_message_content_immutable`, ne garde que
-- la colonne `content` : re-pointer passe.
--
-- ⚠️ COROLLAIRE : puisque `touch_conversation_last_message` ne se déclenche
-- pas, `conversations.last_message_at` de la survivante NE SE MET PAS À JOUR
-- toute seule. Or l'une des cadettes (8a156d7f) porte un message PLUS RÉCENT
-- que la survivante (21:47:45 contre 20:13:09). Sans le recalcul explicite
-- ci-dessous, la conversation fusionnée remonterait dans les listes avec une
-- date antérieure à son dernier message — elle se classerait au mauvais
-- endroit, et personne ne saurait pourquoi.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_survivante CONSTANT uuid := 'c92f4b5b-e5c8-4ee5-860d-2421aff9cfcb';
  v_doublons   CONSTANT uuid[] := ARRAY[
    'b8698abb-04f6-4601-bf34-957ba92a3832',
    'c67bae5b-14c3-4d71-89e8-78f1991c9bde',
    '8a156d7f-39a8-4b7c-b4cc-ed7d47571833'
  ]::uuid[];
  v_msg_avant  int;
  v_msg_apres  int;
  v_deplaces   int;
  v_collisions int;
  v_supprimees int;
BEGIN
  -- ── PRÉ-VOL : la survivante existe, les doublons aussi, et tous portent
  --    bien le MÊME triplet. Fusionner deux conversations qui ne parlent pas
  --    des mêmes personnes serait pire que le doublon.
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = v_survivante) THEN
    RAISE EXCEPTION 'NEXUS D6/1 : conversation survivante % introuvable — migration déjà passée, ou mauvais environnement.', v_survivante;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = ANY (v_doublons)
      AND (c.recruiter_id, c.coach_id, c.athlete_id, c.conversation_type)
          IS DISTINCT FROM
          (SELECT (s.recruiter_id, s.coach_id, s.athlete_id, s.conversation_type)
             FROM public.conversations s WHERE s.id = v_survivante)
  ) THEN
    RAISE EXCEPTION 'NEXUS D6/1 : un doublon ne partage pas le triplet de la survivante. Fusion refusée.';
  END IF;

  SELECT count(*) INTO v_msg_avant
    FROM public.messages WHERE conversation_id = ANY (v_doublons || v_survivante);

  -- ── 1. messages ─────────────────────────────────────────────────────────
  UPDATE public.messages SET conversation_id = v_survivante
   WHERE conversation_id = ANY (v_doublons);
  GET DIAGNOSTICS v_deplaces = ROW_COUNT;

  -- ── 2. conversation_participants ────────────────────────────────────────
  -- PK = (conversation_id, user_id). Si un même utilisateur participe à la
  -- fois à un doublon et à la survivante, l'UPDATE violerait la PK. On retire
  -- d'abord la ligne EN DOUBLE (celle du doublon), on déplace le reste.
  DELETE FROM public.conversation_participants p
   WHERE p.conversation_id = ANY (v_doublons)
     AND EXISTS (SELECT 1 FROM public.conversation_participants q
                  WHERE q.conversation_id = v_survivante AND q.user_id = p.user_id);
  GET DIAGNOSTICS v_collisions = ROW_COUNT;

  UPDATE public.conversation_participants SET conversation_id = v_survivante
   WHERE conversation_id = ANY (v_doublons);

  -- ── 3. recruiter_contact_notifications ──────────────────────────────────
  -- PK sur `id` seul : aucune collision possible, déplacement direct.
  UPDATE public.recruiter_contact_notifications SET conversation_id = v_survivante
   WHERE conversation_id = ANY (v_doublons);

  -- ── 4. last_message_at recalculé (cf. le ⚠️ de l'en-tête) ───────────────
  UPDATE public.conversations c
     SET last_message_at = GREATEST(
           c.last_message_at,
           COALESCE((SELECT max(m.created_at) FROM public.messages m
                      WHERE m.conversation_id = c.id), c.last_message_at))
   WHERE c.id = v_survivante;

  -- ── 5. suppression des trois cadettes ───────────────────────────────────
  DELETE FROM public.conversations WHERE id = ANY (v_doublons);
  GET DIAGNOSTICS v_supprimees = ROW_COUNT;

  SELECT count(*) INTO v_msg_apres
    FROM public.messages WHERE conversation_id = v_survivante;

  -- ── PREUVE EN LIGNE : aucun message perdu. Si le compte ne tombe pas
  --    juste, on lève et la transaction entière est annulée — y compris les
  --    DELETE. C'est la seule garantie qui vaille sur du CASCADE.
  IF v_msg_apres <> v_msg_avant THEN
    RAISE EXCEPTION 'NEXUS D6/1 : % messages avant, % après — la fusion a perdu des lignes. Annulé.',
      v_msg_avant, v_msg_apres;
  END IF;

  RAISE NOTICE 'D6/1 : % messages déplacés, % participants en collision retirés, % conversations supprimées, total messages % (inchangé).',
    v_deplaces, v_collisions, v_supprimees, v_msg_apres;
END $$;
