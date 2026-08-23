-- Messagerie admin — migration 2/3 : STRUCTURE COMPLÈTE.
-- Dépend de la migration 1 (valeurs d'enum ADMIN_USER et SERVICE).
-- La migration 3 promeut l'identité de service, une fois le compte auth créé.
-- État sûr entre les deux : send_admin_message REFUSE explicitement.

-- ═══════════════════════════════════════════════════════════════════
-- 1. IDENTITÉ DE SERVICE — la colonne marqueur et son exposition
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_service_identity boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS users_service_identity_uniq
  ON public.users (is_service_identity) WHERE is_service_identity;

COMMENT ON COLUMN public.users.is_service_identity IS
  'Identité de service « Équipe Nexus ». Une seule ligne (index unique partiel). '
  'Sert DEUX fois : elle rend la ligne lisible par tout compte authentifié '
  '(policy "service identity readable"), et elle est le SEUL expéditeur autorisé '
  'dans un fil ADMIN_USER (trigger trg_admin_thread_readonly). '
  'Immuable côté utilisateur : trg_service_identity_immutable.';

-- Exposition CIBLÉE : une seule ligne, jamais les autres comptes privilégiés.
-- Sans elle, le destinataire lirait zéro ligne et le fil afficherait le
-- fallback « Entraîneur » — une fausse identité, pire qu'un blanc.
DROP POLICY IF EXISTS "service identity readable" ON public.users;
CREATE POLICY "service identity readable"
  ON public.users FOR SELECT TO authenticated
  USING (is_service_identity);

-- ═══════════════════════════════════════════════════════════════════
-- 2. is_service_identity EST IMMUABLE côté utilisateur
-- ═══════════════════════════════════════════════════════════════════
-- La policy `users update own` ne protège que 5 colonnes via
-- user_privileged_cols_unchanged(role, status, is_platform_admin, context,
-- is_school_admin). is_service_identity n'en fait pas partie : sans ce
-- trigger, tout utilisateur pourrait se promouvoir identité de service,
-- donc écrire dans un fil ADMIN_USER et détourner l'expéditeur affiché.
-- Trigger plutôt qu'élargissement du garde-fou : changer la signature de
-- user_privileged_cols_unchanged imposerait de recréer une policy critique
-- de `users` — voir docs/security-users-school-id-privilege-escalation-20260821.md

CREATE OR REPLACE FUNCTION public.enforce_service_identity_immutable()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.is_service_identity IS DISTINCT FROM OLD.is_service_identity
     AND auth.uid() IS NOT NULL          -- NULL = migration / service_role
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: is_service_identity ne peut pas être modifié.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_identity_immutable ON public.users;
CREATE TRIGGER trg_service_identity_immutable
  BEFORE UPDATE OF is_service_identity ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_service_identity_immutable();

-- ═══════════════════════════════════════════════════════════════════
-- 3. LE FIL DE SERVICE — colonne, forme, unicité
-- ═══════════════════════════════════════════════════════════════════
-- admin_id porte l'identité de service : PAS de faux coach dans coach_id.
-- Le DESTINATAIRE, lui, va dans athlete_id / coach_id / recruiter_id —
-- trois des cinq colonnes que notify_on_message énumère, ce qui fait
-- partir le push sans toucher à ce trigger du chemin chaud.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS conversations_admin_id_idx
  ON public.conversations (admin_id) WHERE admin_id IS NOT NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_admin_id_only_admin_type;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_admin_id_only_admin_type
  CHECK (admin_id IS NULL OR conversation_type = 'ADMIN_USER');

-- Le CASE existant se termine par ELSE NULL::boolean, et NULL PASSE un
-- CHECK. Un type sans branche n'est donc validé par RIEN. Les six branches
-- ci-dessous sont recopiées à l'identique depuis pg_get_constraintdef ;
-- seule la branche ADMIN_USER est nouvelle.
ALTER TABLE public.conversations DROP CONSTRAINT conversations_participants_by_type;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_participants_by_type CHECK (
CASE conversation_type
    WHEN 'RECRUTEUR_COACH'::conversation_type THEN ((recruiter_id IS NOT NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'ATHLETE_COACH'::conversation_type THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'PARENT_COACH'::conversation_type THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (parent_id IS NOT NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'RECRUTEUR_ATHLETE'::conversation_type THEN ((recruiter_id IS NOT NULL) AND (coach_id IS NULL) AND (parent_id IS NULL) AND (coach_b_id IS NULL) AND (athlete_id IS NOT NULL))
    WHEN 'COACH_COACH'::conversation_type THEN ((recruiter_id IS NULL) AND (coach_id IS NOT NULL) AND (coach_b_id IS NOT NULL) AND (parent_id IS NULL) AND (coach_id <> coach_b_id))
    WHEN 'GROUP'::conversation_type THEN ((recruiter_id IS NULL) AND (coach_id IS NULL) AND (coach_b_id IS NULL) AND (parent_id IS NULL) AND (athlete_id IS NULL) AND (group_scope IS NOT NULL) AND (((group_scope = 'STAFF'::text) AND (group_school_id IS NOT NULL) AND (group_team_id IS NULL)) OR ((group_scope = 'TEAM'::text) AND (group_team_id IS NOT NULL) AND (group_school_id IS NULL)) OR ((group_scope = 'CUSTOM'::text) AND (group_school_id IS NOT NULL) AND (group_team_id IS NULL) AND (group_name IS NOT NULL))))
    WHEN 'ADMIN_USER'::conversation_type THEN ((admin_id IS NOT NULL) AND (coach_b_id IS NULL) AND (parent_id IS NULL) AND (group_scope IS NULL) AND (group_school_id IS NULL) AND (group_team_id IS NULL) AND (num_nonnulls(athlete_id, coach_id, recruiter_id) = 1))
    ELSE NULL::boolean
END);

-- Idempotence du find-or-create sous concurrence (deux admins simultanés).
CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_athlete_uniq
  ON public.conversations (admin_id, athlete_id)
  WHERE conversation_type = 'ADMIN_USER' AND athlete_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_coach_uniq
  ON public.conversations (admin_id, coach_id)
  WHERE conversation_type = 'ADMIN_USER' AND coach_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_admin_recruiter_uniq
  ON public.conversations (admin_id, recruiter_id)
  WHERE conversation_type = 'ADMIN_USER' AND recruiter_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 4. LECTURE SEULE (v1) — un TRIGGER, pas une absence de policy
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_admin_thread_readonly()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_type public.conversation_type;
BEGIN
  SELECT c.conversation_type INTO v_type
    FROM public.conversations c WHERE c.id = NEW.conversation_id;

  IF v_type IS DISTINCT FROM 'ADMIN_USER' THEN
    RETURN NEW;
  END IF;

  -- Pourquoi un TRIGGER et pas l'absence de policy : les policies RLS sont
  -- PERMISSIVES, donc OR'ées. `messages_insert` accepte déjà tout COACH dont
  -- l'uid figure en conversations.coach_id — et c'est exactement là qu'on loge
  -- le coach destinataire pour que notify_on_message le trouve. Ne pas ajouter
  -- de policy n'interdit donc RIEN ici. Idem pour un RECRUTEUR pro en
  -- recruiter_id.
  --
  -- v2 (ouverture de la réponse) : élargir CETTE condition, et rien d'autre.
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
     WHERE u.id = NEW.sender_id AND u.is_service_identity
  ) THEN
    RAISE EXCEPTION 'NEXUS: ce message ne peut pas recevoir de réponse.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_thread_readonly ON public.messages;
CREATE TRIGGER trg_admin_thread_readonly
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_thread_readonly();

-- ═══════════════════════════════════════════════════════════════════
-- 5. BLACK-OUT — l'exemption est ÉCRITE, pas subie
-- ═══════════════════════════════════════════════════════════════════
-- Corps identique à l'existant, à l'exception du bloc d'exemption.

CREATE OR REPLACE FUNCTION public.enforce_messaging_blackout()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_type    public.conversation_type;
  v_athlete uuid;
BEGIN
  IF TG_TABLE_NAME = 'conversations' THEN
    v_type := NEW.conversation_type;
    v_athlete := NEW.athlete_id;
  ELSE
    SELECT c.conversation_type, c.athlete_id
      INTO v_type, v_athlete
    FROM public.conversations c
    WHERE c.id = NEW.conversation_id;
  END IF;

  -- ── EXEMPTIONS EXPLICITES ────────────────────────────────────────
  -- Types HORS périmètre du black-out de la ligue, par décision produit.
  -- ADMIN_USER : messagerie de service de la plateforme (maintenance,
  -- information, support). Ce n'est pas du recrutement ; le black-out
  -- protège l'intégrité du recrutement, pas la communication de service.
  --
  -- Écrit ici DÉLIBÉRÉMENT plutôt qu'obtenu par le fait que le test
  -- ci-dessous ne vise que RECRUTEUR_ATHLETE : si le black-out est un jour
  -- élargi à d'autres types, cette exemption reste vraie et VISIBLE, au
  -- lieu de disparaître sans que personne ne le remarque.
  -- Voir CLAUDE.md, MIGRATION SAFETY CHECKLIST règle 11.
  IF v_type = ANY (ARRAY['ADMIN_USER']::public.conversation_type[]) THEN
    RETURN NEW;
  END IF;

  IF v_type = 'RECRUTEUR_ATHLETE' AND public.is_messaging_blacked_out(v_athlete) THEN
    RAISE EXCEPTION 'Période de black-out — la messagerie est suspendue par la ligue pour protéger l''intégrité du recrutement.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. VISIBILITÉ DU DESTINATAIRE
-- ═══════════════════════════════════════════════════════════════════
-- Le coach (coach_conversations_select) et le recruteur
-- (recruiter_conversations_select) sont déjà couverts, et leurs messages
-- par `messages participants` / `messages_select`. Seul l'athlète manque :
-- athlete_conversations_select est verrouillée sur ATHLETE_COACH.

DROP POLICY IF EXISTS "athlete_admin_conversations_select" ON public.conversations;
CREATE POLICY "athlete_admin_conversations_select"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    conversation_type = 'ADMIN_USER'
    AND EXISTS (SELECT 1 FROM public.athletes a
                 WHERE a.id = conversations.athlete_id
                   AND a.user_id = (SELECT auth.uid()))
  );

-- La branche athlète de is_conversation_participant est câblée sur deux
-- types. Sans ADMIN_USER : athlete_messages_select renvoie zéro message ET
-- mark_conversation_read lève « Non autorisé » — fil visible mais vide.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conv uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.athletes a ON a.id = c.athlete_id
    WHERE c.id = p_conv
      AND (
        p_uid = c.recruiter_id
        OR p_uid = c.coach_id
        OR p_uid = c.coach_b_id
        OR p_uid = c.parent_id
        OR p_uid = c.admin_id
        OR (c.conversation_type IN ('ATHLETE_COACH','RECRUTEUR_ATHLETE','ADMIN_USER')
            AND p_uid = a.user_id)
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. send_admin_message — RPC cloisonnée, gate is_admin() relu en base
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_admin_message(p_audience jsonb, p_content text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_service  uuid;
  v_kind     text := p_audience->>'kind';
  v_category text := coalesce(p_audience->>'category', 'service');
  v_ids      uuid[];
  v_bid      uuid;
  v_sent     int := 0;
  v_conv     uuid;
  r          record;
BEGIN
  ---- 1. GATE — relu en base, jamais depuis le payload ----------------
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'NEXUS: non authentifié.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  ---- 2. Contenu ------------------------------------------------------
  IF coalesce(btrim(p_content), '') = '' THEN
    RAISE EXCEPTION 'NEXUS: le message est vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(p_content) > 4000 THEN
    RAISE EXCEPTION 'NEXUS: message trop long (% caractères, maximum 4000).', length(p_content)
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 3. CATÉGORIE ----------------------------------------------------
  -- Portée dès la v1 pour arbitrer plus tard (notification des parents de
  -- mineurs) SANS migration : elle voyage dans broadcasts.audience, donc
  -- elle est atteignable depuis n'importe quel message via
  -- messages.broadcast_id -> broadcasts.audience->>'category'.
  IF v_category NOT IN ('service', 'individuel') THEN
    RAISE EXCEPTION 'NEXUS: catégorie inconnue « % » (attendu : service | individuel).', v_category
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 4. AUDIENCE — jamais d'échec silencieux -------------------------
  IF v_kind IS NULL OR v_kind NOT IN
     ('user','all_athletes','all_coaches','all_recruiters','everyone') THEN
    RAISE EXCEPTION 'NEXUS: audience inconnue « % ».', coalesce(v_kind, '(absente)')
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_kind = 'user' THEN
    SELECT array_agg(DISTINCT x::uuid) INTO v_ids
      FROM jsonb_array_elements_text(coalesce(p_audience->'ids', '[]'::jsonb)) AS x;
    IF v_ids IS NULL OR cardinality(v_ids) = 0 THEN
      RAISE EXCEPTION 'NEXUS: audience « user » sans destinataire.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  ---- 5. Identité de service — l'expéditeur AFFICHÉ -------------------
  SELECT id INTO v_service FROM public.users WHERE is_service_identity LIMIT 1;
  IF v_service IS NULL THEN
    RAISE EXCEPTION 'NEXUS: identité de service absente (users.is_service_identity).'
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 6. Audit : sender_id = l'ADMIN HUMAIN qui a appuyé sur envoyer.
  -- Les messages, eux, portent l'identité de service. Les deux informations
  -- sont conservées : qui a décidé, et qui s'affiche.
  INSERT INTO public.broadcasts (sender_id, audience, recipient_count)
  VALUES (v_actor, p_audience || jsonb_build_object('category', v_category), 0)
  RETURNING id INTO v_bid;

  ---- 7. Destinataires. Athlètes = athletes.status='ACTIF', PAS
  ----    users.role='ATHLETE' (aligné sur send_broadcast). Le JOIN sur
  ----    users.role rend les trois branches mutuellement exclusives, ce
  ----    qui garantit l'invariant v_sent = cardinality(v_ids) au §8.
  FOR r IN
    SELECT 'ATHLETE'::text AS target, a.id AS athlete_id, NULL::uuid AS user_id
      FROM public.athletes a
      JOIN public.users u ON u.id = a.user_id AND u.role = 'ATHLETE'
     WHERE a.status = 'ACTIF'
       AND (v_kind IN ('all_athletes','everyone') OR (v_kind = 'user' AND a.user_id = ANY(v_ids)))
    UNION ALL
    SELECT 'COACH', NULL, u.id FROM public.users u
     WHERE u.role = 'COACH' AND u.status = 'ACTIF'
       AND (v_kind IN ('all_coaches','everyone') OR (v_kind = 'user' AND u.id = ANY(v_ids)))
    UNION ALL
    SELECT 'RECRUTEUR', NULL, u.id FROM public.users u
     WHERE u.role = 'RECRUTEUR' AND u.status = 'ACTIF'
       AND (v_kind IN ('all_recruiters','everyone') OR (v_kind = 'user' AND u.id = ANY(v_ids)))
  LOOP
    v_conv := NULL;

    IF r.target = 'ATHLETE' THEN
      SELECT id INTO v_conv FROM public.conversations
       WHERE conversation_type = 'ADMIN_USER' AND admin_id = v_service AND athlete_id = r.athlete_id
       LIMIT 1;
      IF v_conv IS NULL THEN
        INSERT INTO public.conversations (conversation_type, admin_id, athlete_id, status, last_message_at)
        VALUES ('ADMIN_USER', v_service, r.athlete_id, 'ACTIVE', now()) RETURNING id INTO v_conv;
      END IF;

    ELSIF r.target = 'COACH' THEN
      SELECT id INTO v_conv FROM public.conversations
       WHERE conversation_type = 'ADMIN_USER' AND admin_id = v_service AND coach_id = r.user_id
       LIMIT 1;
      IF v_conv IS NULL THEN
        INSERT INTO public.conversations (conversation_type, admin_id, coach_id, status, last_message_at)
        VALUES ('ADMIN_USER', v_service, r.user_id, 'ACTIVE', now()) RETURNING id INTO v_conv;
      END IF;

    ELSE
      SELECT id INTO v_conv FROM public.conversations
       WHERE conversation_type = 'ADMIN_USER' AND admin_id = v_service AND recruiter_id = r.user_id
       LIMIT 1;
      IF v_conv IS NULL THEN
        INSERT INTO public.conversations (conversation_type, admin_id, recruiter_id, status, last_message_at)
        VALUES ('ADMIN_USER', v_service, r.user_id, 'ACTIVE', now()) RETURNING id INTO v_conv;
      END IF;
    END IF;

    -- sender_id = identité de service : c'est elle qui s'affiche, et c'est
    -- la seule que trg_admin_thread_readonly laisse écrire.
    INSERT INTO public.messages (conversation_id, sender_id, content, broadcast_id)
    VALUES (v_conv, v_service, p_content, v_bid);

    UPDATE public.conversations SET last_message_at = now() WHERE id = v_conv;
    v_sent := v_sent + 1;
  END LOOP;

  ---- 8. Le défaut de send_broadcast qu'on ne reproduit PAS ------------
  -- Un RAISE annule toute la transaction, ligne broadcasts comprise :
  -- zéro trace vaut mieux qu'une ligne d'audit à 0 qui ressemble à un succès.
  IF v_sent = 0 THEN
    RAISE EXCEPTION 'NEXUS: aucun destinataire pour cette audience — rien n''a été envoyé.'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_kind = 'user' AND v_sent <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'NEXUS: % destinataire(s) sur % introuvable(s) ou inactif(s) — rien n''a été envoyé.',
      cardinality(v_ids) - v_sent, cardinality(v_ids) USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.broadcasts SET recipient_count = v_sent WHERE id = v_bid;
  RETURN jsonb_build_object('broadcast_id', v_bid, 'sent', v_sent, 'category', v_category);
END;
$$;

REVOKE ALL ON FUNCTION public.send_admin_message(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_admin_message(jsonb, text) TO authenticated;
