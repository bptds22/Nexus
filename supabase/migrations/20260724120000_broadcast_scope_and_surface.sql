-- ═══════════════════════════════════════════════════════════════════════
-- Diffusion (broadcast) — deux corrections de ciblage/remontée
--
-- (a) CIBLAGE ATHLÈTES : une diffusion d'un COACH (non-directeur) vers
--     « tous les athlètes » atteignait TOUS les athlètes de l'école — donc
--     les athlètes appartenant à d'AUTRES coachs. Un coach régulier ne doit
--     diffuser qu'à SES PROPRES athlètes (coach_id = expéditeur). Un
--     DIRECTEUR garde la portée école entière (school_id = école). Vaut pour
--     all_athletes / athletes(ids) / team.
--
-- (b) REMONTÉE : la diffusion RÉUTILISE les fils existants (find-or-create)
--     sans bumper last_message_at → chez le destinataire, le message de
--     diffusion restait enterré au bas de l'inbox (fil non remonté), d'où
--     « pas reçu ». On bump last_message_at = now() à CHAQUE message (fil neuf
--     OU réutilisé), pour les trois types.
--
-- CREATE OR REPLACE pur (aucune signature/table modifiée) → idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_broadcast(p_audience jsonb, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender      uuid := auth.uid();
  v_role        public.user_role;
  v_school      uuid;
  v_is_director boolean := false;
  v_kind        text := p_audience->>'kind';
  v_ids         uuid[];
  v_bid         uuid;
  v_sent        int := 0;
  v_conv        uuid;
  r             record;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(btrim(p_content), '') = '' THEN RAISE EXCEPTION 'empty content'; END IF;
  SELECT role, school_id INTO v_role, v_school FROM public.users WHERE id = v_sender;

  -- Directeur sportif de son école → portée école ; sinon coach régulier → ses athlètes.
  SELECT EXISTS (
    SELECT 1 FROM public.school_coaches sc
    WHERE sc.coach_id = v_sender AND sc.role IN ('DIRECTEUR','DIRECTEUR_INTERIM')
  ) INTO v_is_director;

  IF p_audience ? 'ids' THEN
    SELECT array_agg(x::uuid) INTO v_ids FROM jsonb_array_elements_text(p_audience->'ids') AS x;
  END IF;

  INSERT INTO public.broadcasts (sender_id, audience, recipient_count)
    VALUES (v_sender, p_audience, 0) RETURNING id INTO v_bid;

  -- ── COACH sender ──────────────────────────────────────────────────────
  IF v_role = 'COACH' THEN

    IF v_kind IN ('coaches', 'all_coaches') THEN
      FOR r IN
        SELECT DISTINCT sc.coach_id AS rid
        FROM public.school_coaches sc
        WHERE sc.school_id IN (SELECT school_id FROM public.school_coaches WHERE coach_id = v_sender)
          AND sc.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')
          AND sc.coach_id <> v_sender
          AND (v_kind = 'all_coaches' OR sc.coach_id = ANY(v_ids))
      LOOP
        SELECT id INTO v_conv FROM public.conversations
          WHERE conversation_type = 'COACH_COACH' AND athlete_id IS NULL
            AND ((coach_id = v_sender AND coach_b_id = r.rid) OR (coach_id = r.rid AND coach_b_id = v_sender))
          LIMIT 1;
        IF v_conv IS NULL THEN
          INSERT INTO public.conversations (conversation_type, coach_id, coach_b_id, status, last_message_at)
            VALUES ('COACH_COACH', v_sender, r.rid, 'ACTIVE', now()) RETURNING id INTO v_conv;
        END IF;
        INSERT INTO public.messages (conversation_id, sender_id, content, broadcast_id)
          VALUES (v_conv, v_sender, p_content, v_bid);
        UPDATE public.conversations SET last_message_at = now() WHERE id = v_conv;  -- (b) remontée
        v_sent := v_sent + 1;
      END LOOP;

    ELSIF v_kind IN ('athletes', 'all_athletes', 'team') THEN
      FOR r IN
        SELECT a.id AS aid
        FROM public.athletes a
        WHERE a.status = 'ACTIF'
          -- (a) portée : directeur = école entière ; coach régulier = SES athlètes
          AND (
            (v_is_director AND a.school_id = v_school)
            OR (NOT v_is_director AND a.coach_id = v_sender)
          )
          AND (
            v_kind = 'all_athletes'
            OR (v_kind = 'athletes' AND a.id = ANY(v_ids))
            OR (v_kind = 'team' AND a.id IN (
                  SELECT ta.athlete_id FROM public.team_athletes ta
                  WHERE ta.team_id = (p_audience->>'team_id')::uuid))
          )
      LOOP
        SELECT id INTO v_conv FROM public.conversations
          WHERE conversation_type = 'ATHLETE_COACH' AND coach_id = v_sender AND athlete_id = r.aid
          LIMIT 1;
        IF v_conv IS NULL THEN
          INSERT INTO public.conversations (conversation_type, coach_id, athlete_id, status, last_message_at)
            VALUES ('ATHLETE_COACH', v_sender, r.aid, 'ACTIVE', now()) RETURNING id INTO v_conv;
        END IF;
        INSERT INTO public.messages (conversation_id, sender_id, content, broadcast_id)
          VALUES (v_conv, v_sender, p_content, v_bid);
        UPDATE public.conversations SET last_message_at = now() WHERE id = v_conv;  -- (b) remontée
        v_sent := v_sent + 1;
      END LOOP;
    END IF;

  -- ── RECRUTEUR sender ─ (coachs des athlètes qu'il a favorisés) ─────────
  ELSIF v_role = 'RECRUTEUR' THEN
    IF v_kind IN ('favorited_coaches', 'coaches', 'all_coaches') THEN
      FOR r IN
        SELECT DISTINCT a.coach_id AS cid, a.id AS aid
        FROM public.recruiter_favorites f
        JOIN public.athletes a ON a.id = f.athlete_id
          AND a.coach_id IS NOT NULL AND a.status = 'ACTIF'
        WHERE f.recruiter_id = v_sender
          AND (v_kind <> 'coaches' OR a.coach_id = ANY(v_ids))   -- 'coaches' = sous-ensemble
      LOOP
        SELECT id INTO v_conv FROM public.conversations
          WHERE conversation_type = 'RECRUTEUR_COACH'
            AND recruiter_id = v_sender AND coach_id = r.cid AND athlete_id = r.aid
          LIMIT 1;
        IF v_conv IS NULL THEN
          INSERT INTO public.conversations (conversation_type, recruiter_id, coach_id, athlete_id, status, last_message_at)
            VALUES ('RECRUTEUR_COACH', v_sender, r.cid, r.aid, 'ACTIVE', now()) RETURNING id INTO v_conv;
        END IF;
        INSERT INTO public.messages (conversation_id, sender_id, content, broadcast_id)
          VALUES (v_conv, v_sender, p_content, v_bid);
        UPDATE public.conversations SET last_message_at = now() WHERE id = v_conv;  -- (b) remontée
        v_sent := v_sent + 1;
      END LOOP;
    END IF;
  END IF;

  UPDATE public.broadcasts SET recipient_count = v_sent WHERE id = v_bid;
  RETURN jsonb_build_object('broadcast_id', v_bid, 'sent', v_sent);
END;
$$;
REVOKE ALL ON FUNCTION public.send_broadcast(jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast(jsonb, text) TO authenticated;
