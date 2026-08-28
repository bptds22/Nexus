-- ═══════════════════════════════════════════════════════════════════
-- ANNONCES PUSH — le bilan cesse de mentir, et la reprise devient
-- possible
-- ═══════════════════════════════════════════════════════════════════
-- Correctif de 20260827145812_push_announcement_garde_fou_5.sql.
--
-- CE QUI S'EST PASSÉ LE 2026-08-28. L'annonce `all` 9025aebc visait
-- 69 usagers et 109 jetons. Les journaux edge montrent exactement
-- 30 appels à `send-push` sur la fenêtre, tous en HTTP 200 : les
-- 39 autres n'ont pas échoué, ils n'ont JAMAIS été émis. Le bilan,
-- lui, affichait `users_ko 39`, `tokens_failed 0`, `failure_codes {}`
-- et `status DONE`. Autrement dit : 57 % de l'audience n'a rien reçu
-- et la table disait que tout allait bien.
--
-- La cause est dans send-announcement : `pushTo` renvoyait `null` dès
-- que l'appel échouait, en jetant le code HTTP, et `absorb(null)` se
-- contentait d'incrémenter un compteur. Le correctif de l'orchestrateur
-- est dans supabase/functions/send-announcement/index.ts (même lot).
--
-- CE QUE CETTE MIGRATION AJOUTE
--
--   1. `failures` jsonb — le détail par usager en échec : user_id,
--      nature de l'échec, statut HTTP le cas échéant, note. C'est ce
--      qui manquait pour qu'un bilan soit lisible.
--   2. `failed_user_ids` uuid[] — la poignée de reprise. Dérivable de
--      `failures`, mais typée : la RPC la lit directement.
--   3. `retry_of` uuid — de quelle annonce cet envoi est la reprise.
--   4. L'audience `retry` — rejoue une annonce vers ses seuls
--      `failed_user_ids`, avec le MÊME titre et le MÊME texte, repris
--      de la source pour qu'une reprise ne puisse pas dériver.
--
-- LIMITE ASSUMÉE. Les annonces antérieures à cette migration n'ont
-- aucun `failed_user_ids` : rien de nominatif n'a jamais été écrit.
-- Les 39 usagers manqués du 2026-08-28 sont donc IRRÉCUPÉRABLES par
-- ce chemin — `retry` sur 9025aebc lèvera, et le dira. La reprise
-- protège les envois futurs, pas celui-là.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.push_announcements
  ADD COLUMN IF NOT EXISTS failures        jsonb,
  ADD COLUMN IF NOT EXISTS failed_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS retry_of        uuid REFERENCES public.push_announcements(id);

COMMENT ON COLUMN public.push_announcements.failures IS
  'Detail par usager en echec : [{user_id, kind, status, note}]. kind = http | throw | badjson | aucun_jeton_accepte.';
COMMENT ON COLUMN public.push_announcements.failed_user_ids IS
  'Les usagers de failures, types, pour l audience retry. NULL sur les annonces anterieures au 2026-08-28.';
COMMENT ON COLUMN public.push_announcements.retry_of IS
  'Annonce dont celle-ci est la reprise (audience retry).';

-- La signature change (nouveau parametre en fin) : CREATE OR REPLACE
-- creerait une SURCHARGE, et un appel a 5 arguments deviendrait
-- ambigu. On depose l ancienne d abord.
DROP FUNCTION IF EXISTS public.send_push_announcement(text, text, text, uuid[], boolean);

CREATE FUNCTION public.send_push_announcement(
  p_title                  text,
  p_body                   text,
  p_audience               text,
  p_user_ids               uuid[]  DEFAULT NULL,
  p_confirme_envoi_large   boolean DEFAULT false,
  p_source_announcement_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_actor   uuid := auth.uid();
  v_secret  text;
  v_url     text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-announcement';
  v_users   uuid[];
  v_tokens  int;
  v_id      uuid;
  v_title   text;
  v_body    text;
  v_src     public.push_announcements%ROWTYPE;
  c_seuil   constant int := 5;
BEGIN
  ---- 1. GATE — relue en base, jamais depuis le payload ---------------
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'NEXUS: non authentifié.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  ---- 2. AUDIENCE — jamais d'échec silencieux -------------------------
  IF p_audience IS NULL OR p_audience NOT IN
     ('me','all','athletes','coachs','recruteurs','user','retry') THEN
    RAISE EXCEPTION 'NEXUS: audience inconnue « % » (attendu : me | all | athletes | coachs | recruteurs | user | retry).',
      coalesce(p_audience, '(absente)') USING ERRCODE = 'check_violation';
  END IF;
  IF p_audience = 'user'
     AND (p_user_ids IS NULL OR cardinality(p_user_ids) = 0) THEN
    RAISE EXCEPTION 'NEXUS: audience « user » sans destinataire (p_user_ids vide).'
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 3. REPRISE — la source décide du texte ET des destinataires -----
  -- Le texte est REPRIS de la source, jamais ressaisi : une reprise qui
  -- dirait autre chose que l'envoi qu'elle complète serait un piège.
  IF p_audience = 'retry' THEN
    IF p_source_announcement_id IS NULL THEN
      RAISE EXCEPTION 'NEXUS: audience « retry » sans p_source_announcement_id.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_src FROM public.push_announcements
     WHERE id = p_source_announcement_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NEXUS: annonce source % introuvable.', p_source_announcement_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_src.failed_user_ids IS NULL OR cardinality(v_src.failed_user_ids) = 0 THEN
      RAISE EXCEPTION 'NEXUS: l''annonce % n''a aucun destinataire en échec à rejouer. Les annonces antérieures au 2026-08-28 ne consignaient QUE des compteurs : leurs usagers manqués sont irrécupérables, il faut refaire un envoi ciblé.',
        p_source_announcement_id USING ERRCODE = 'check_violation';
    END IF;

    v_title := v_src.title;
    v_body  := v_src.body;
  ELSE
    v_title := btrim(p_title);
    v_body  := btrim(p_body);
  END IF;

  ---- 4. CONTENU ------------------------------------------------------
  IF coalesce(v_title, '') = '' THEN
    RAISE EXCEPTION 'NEXUS: le titre est vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_title) > 100 THEN
    RAISE EXCEPTION 'NEXUS: titre trop long (% caractères, maximum 100).', length(v_title)
      USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(v_body, '') = '' THEN
    RAISE EXCEPTION 'NEXUS: le texte est vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_body) > 300 THEN
    RAISE EXCEPTION 'NEXUS: texte trop long (% caractères, maximum 300).', length(v_body)
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 5. RÉSOLUTION ---------------------------------------------------
  -- `retry` repasse par device_tokens comme les autres : un usager
  -- désactivé ou dont les jetons ont disparu depuis l'envoi d'origine
  -- ne doit pas rentrer dans la reprise par la porte de derrière.
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
           WHEN 'retry'       THEN dt.user_id = ANY (v_src.failed_user_ids)
         END;

  ---- 6. GARDE-FOU — sur la TAILLE, pas sur le nom de l'audience ------
  IF coalesce(cardinality(v_users), 0) > c_seuil AND NOT p_confirme_envoi_large THEN
    RAISE EXCEPTION 'NEXUS: envoi refusé — % usager(s) et % jeton(s) seraient touchés, au-delà du seuil de % sans confirmation. Relance avec p_confirme_envoi_large := true si c''est bien voulu.',
      cardinality(v_users), coalesce(v_tokens, 0), c_seuil
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 7. ZÉRO CIBLE = ÉCHEC BRUYANT -----------------------------------
  IF v_users IS NULL OR cardinality(v_users) = 0 THEN
    RAISE EXCEPTION 'NEXUS: aucun appareil pour cette audience — rien n''a été envoyé.'
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 8. LE BILAN AVANT L'ENVOI ---------------------------------------
  INSERT INTO public.push_announcements
    (sender_id, title, body, audience, targeted_users, targeted_tokens, retry_of)
  VALUES
    (v_actor, v_title, v_body, p_audience,
     cardinality(v_users), coalesce(v_tokens, 0),
     CASE WHEN p_audience = 'retry' THEN p_source_announcement_id END)
  RETURNING id INTO v_id;

  ---- 9. UN SEUL APPEL HTTP -------------------------------------------
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
      'title',           v_title,
      'body',            v_body,
      'user_ids',        to_jsonb(v_users)
    ),
    timeout_milliseconds := 15000
  );

  RETURN jsonb_build_object(
    'announcement_id', v_id,
    'audience',        p_audience,
    'retry_of',        CASE WHEN p_audience = 'retry' THEN p_source_announcement_id END,
    'targeted_users',  cardinality(v_users),
    'targeted_tokens', coalesce(v_tokens, 0),
    'status',          'QUEUED'
  );
END;
$fn$;

COMMENT ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean, uuid) IS
  'Annonce push admin (canal hors messagerie). Audience : me | all | athletes | coachs | recruteurs | user | retry. retry rejoue les failed_user_ids de p_source_announcement_id avec le titre et le texte de la source. Au-dela de 5 usagers resolus, exige p_confirme_envoi_large := true. Bilan dans push_announcements.';
