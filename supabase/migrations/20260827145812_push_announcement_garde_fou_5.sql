-- ═══════════════════════════════════════════════════════════════════
-- ANNONCES PUSH — le garde-fou passe de « l'audience 'all' » à « plus
-- de 5 usagers, quelle que soit l'audience »
-- ═══════════════════════════════════════════════════════════════════
-- Correctif de 20260827143911_push_announcements.sql, même journée.
--
-- Le premier jet ne protégeait que `p_audience = 'all'`. C'était le
-- nom de l'audience qui déclenchait la confirmation, pas sa TAILLE —
-- or `athletes` touche 53 personnes aujourd'hui et partait sur un
-- simple appel. Le seuil déplace la garde là où est le risque.
--
-- Seuil : plus de 5 usagers résolus. En dessous, rien à confirmer —
-- `me` (1 usager) et un `user` ciblé (1 usager) restent donc libres
-- sans avoir besoin d'exception nommée. Au-dessus, la confirmation est
-- exigée y compris pour une liste `user` de 20 identifiants : c'est la
-- taille qui compte, pas l'étiquette.
--
-- Seul le §4 change. Le reste du corps est recopié à l'identique.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.send_push_announcement(
  p_title                text,
  p_body                 text,
  p_audience             text,
  p_user_ids             uuid[]  DEFAULT NULL,
  p_confirme_envoi_large boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor  uuid := auth.uid();
  v_secret text;
  v_url    text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-announcement';
  v_users  uuid[];
  v_tokens int;
  v_id     uuid;
  -- Le seuil vit ici, nommé, pour qu'on le change sans relire la condition.
  c_seuil  constant int := 5;
BEGIN
  ---- 1. GATE — relue en base, jamais depuis le payload ---------------
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'NEXUS: non authentifié.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  ---- 2. CONTENU ------------------------------------------------------
  IF coalesce(btrim(p_title), '') = '' THEN
    RAISE EXCEPTION 'NEXUS: le titre est vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(p_title) > 100 THEN
    RAISE EXCEPTION 'NEXUS: titre trop long (% caractères, maximum 100).', length(p_title)
      USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(btrim(p_body), '') = '' THEN
    RAISE EXCEPTION 'NEXUS: le texte est vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(p_body) > 300 THEN
    RAISE EXCEPTION 'NEXUS: texte trop long (% caractères, maximum 300).', length(p_body)
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 3. AUDIENCE — jamais d'échec silencieux -------------------------
  IF p_audience IS NULL OR p_audience NOT IN
     ('me','all','athletes','coachs','recruteurs','user') THEN
    RAISE EXCEPTION 'NEXUS: audience inconnue « % » (attendu : me | all | athletes | coachs | recruteurs | user).',
      coalesce(p_audience, '(absente)') USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience = 'user'
     AND (p_user_ids IS NULL OR cardinality(p_user_ids) = 0) THEN
    RAISE EXCEPTION 'NEXUS: audience « user » sans destinataire (p_user_ids vide).'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT array_agg(DISTINCT dt.user_id), count(*)::int
    INTO v_users, v_tokens
    FROM public.device_tokens dt
    JOIN public.users u ON u.id = dt.user_id
   WHERE u.status = 'ACTIF'
     AND CASE p_audience
           WHEN 'me'          THEN dt.user_id = v_actor
           WHEN 'all'         THEN u.role IN ('ATHLETE','COACH','RECRUTEUR')
           WHEN 'athletes'    THEN u.role = 'ATHLETE'
           WHEN 'coachs'      THEN u.role = 'COACH'
           WHEN 'recruteurs'  THEN u.role = 'RECRUTEUR'
           WHEN 'user'        THEN dt.user_id = ANY (p_user_ids)
         END;

  ---- 4. GARDE-FOU — sur la TAILLE, pas sur le nom de l'audience ------
  -- Le refus DIT le nombre : la seconde décision se prend sur un
  -- chiffre, pas sur une intuition. C'est l'écran de confirmation, en SQL.
  IF coalesce(cardinality(v_users), 0) > c_seuil AND NOT p_confirme_envoi_large THEN
    RAISE EXCEPTION 'NEXUS: envoi refusé — % usager(s) et % jeton(s) seraient touchés, au-delà du seuil de % sans confirmation. Relance avec p_confirme_envoi_large := true si c''est bien voulu.',
      cardinality(v_users), coalesce(v_tokens, 0), c_seuil
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 5. ZÉRO CIBLE = ÉCHEC BRUYANT -----------------------------------
  IF v_users IS NULL OR cardinality(v_users) = 0 THEN
    RAISE EXCEPTION 'NEXUS: aucun appareil pour cette audience — rien n''a été envoyé.'
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 6. LE BILAN AVANT L'ENVOI ---------------------------------------
  INSERT INTO public.push_announcements
    (sender_id, title, body, audience, targeted_users, targeted_tokens)
  VALUES
    (v_actor, btrim(p_title), btrim(p_body), p_audience,
     cardinality(v_users), coalesce(v_tokens, 0))
  RETURNING id INTO v_id;

  ---- 7. UN SEUL APPEL HTTP -------------------------------------------
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'PUSH_DISPATCH_SECRET' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'NEXUS: PUSH_DISPATCH_SECRET absent du Vault — envoi impossible.'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'announcement_id', v_id,
      'title',           btrim(p_title),
      'body',            btrim(p_body),
      'user_ids',        to_jsonb(v_users)
    ),
    timeout_milliseconds := 15000
  );

  RETURN jsonb_build_object(
    'announcement_id', v_id,
    'targeted_users',  cardinality(v_users),
    'targeted_tokens', coalesce(v_tokens, 0),
    'status',          'QUEUED'
  );
END;
$fn$;

COMMENT ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean) IS
  'Annonce push admin (canal hors messagerie). Audience : me | all | athletes | coachs | recruteurs | user. Au-delà de 5 usagers résolus, exige p_confirme_envoi_large := true. Bilan dans push_announcements.';
