-- ═══════════════════════════════════════════════════════════════════
-- ANNONCES PUSH — canal parallèle à la messagerie
-- ═══════════════════════════════════════════════════════════════════
-- Une annonce est une notification push à titre et texte libres, envoyée
-- par un admin à un ensemble d'usagers. Elle ne crée AUCUNE conversation,
-- AUCUN message, et ne touche ni `notify_on_message` ni le flux messagerie.
--
-- Pourquoi un canal séparé plutôt qu'un message de service : un message
-- existe pour être relu ; une annonce (« Nexus 1.4 est disponible »)
-- existe pour être vue une fois. Les mêler donnerait un fil que personne
-- ne peut archiver et un compteur de non-lus qui ne retombe jamais.
--
-- Contrepartie assumée : une annonce manquée est perdue. Si le contenu
-- doit être rattrapable, l'envoyer AUSSI via send_admin_message.
--
-- Chemin complet :
--   send_push_announcement (ici, is_admin)
--     -> 1 seul net.http_post -> edge fn `send-announcement` (orchestrateur)
--        -> N appels à `send-push`
--           -> FCM HTTP v1
--
-- Un SEUL appel pg_net est émis par Postgres, et l'orchestrateur répond
-- 202 avant de travailler : le timeout pg_net (défaut 5 s, cause du faux
-- négatif documenté dans docs/push-pgnet-timeout-20260823.md) sort
-- structurellement du chemin au lieu d'être masqué.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. LE BILAN — une ligne par envoi, lisible sans deviner
-- ───────────────────────────────────────────────────────────────────
-- Table dédiée et NON `broadcasts` : /admin/messages liste toutes les
-- lignes de `broadcasts` puis résout leur contenu par
-- messages.broadcast_id. Une annonce n'a pas de message : elle y
-- apparaîtrait vide, avec un taux de lecture qui ne veut rien dire.
CREATE TABLE IF NOT EXISTS public.push_announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title           text NOT NULL,
  body            text NOT NULL,
  audience        text NOT NULL,
  -- Cible, résolue par la RPC au moment de l'envoi (photo, pas jointure).
  targeted_users  int  NOT NULL DEFAULT 0,
  targeted_tokens int  NOT NULL DEFAULT 0,
  -- Résultat, écrit par l'orchestrateur. users_* comptent l'USAGER
  -- (un usager à 42 jetons pèse 1) ; tokens_* comptent les APPAREILS.
  users_ok        int  NOT NULL DEFAULT 0,
  users_ko        int  NOT NULL DEFAULT 0,
  tokens_sent     int  NOT NULL DEFAULT 0,
  tokens_failed   int  NOT NULL DEFAULT 0,
  tokens_purged   int  NOT NULL DEFAULT 0,
  -- Histogramme des codes d'échec FCM ({"INVALID_ARGUMENT": 6, ...}).
  -- C'est la mesure qui manquait pour arbitrer la purge sur des chiffres.
  failure_codes   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'QUEUED'
                    CHECK (status IN ('QUEUED','RUNNING','DONE','ERROR')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS push_announcements_created_at_idx
  ON public.push_announcements (created_at DESC);

ALTER TABLE public.push_announcements ENABLE ROW LEVEL SECURITY;

-- Lecture : admins seulement. Aucune policy INSERT/UPDATE/DELETE — les
-- écritures passent par la RPC (SECURITY DEFINER) et par l'orchestrateur
-- (service role, qui contourne la RLS). Ne rien accorder ici est donc un
-- choix, pas un oubli.
DROP POLICY IF EXISTS push_announcements_select_admin ON public.push_announcements;
CREATE POLICY push_announcements_select_admin
  ON public.push_announcements FOR SELECT
  USING (public.is_admin());

-- ───────────────────────────────────────────────────────────────────
-- 2. LA RPC
-- ───────────────────────────────────────────────────────────────────
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
BEGIN
  ---- 1. GATE — relue en base, jamais depuis le payload ---------------
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'NEXUS: non authentifié.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NEXUS: action réservée aux administrateurs.' USING ERRCODE = '42501';
  END IF;

  ---- 2. CONTENU ------------------------------------------------------
  -- Les bornes sont celles de l'affichage : au-delà, iOS et Android
  -- tronquent en silence. Mieux vaut refuser que laisser couper.
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

  -- La cible se lit dans device_tokens : un usager sans jeton n'existe
  -- pas pour ce canal (permission refusée, ou app jamais ouverte).
  -- users.status = 'ACTIF' : un compte désactivé ne reçoit rien.
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

  ---- 4. GARDE-FOU D'ENVOI LARGE — l'écran de confirmation, en SQL ----
  -- « all » ne part jamais sur un simple appel : il faut l'avoir voulu
  -- deux fois. Le refus DIT le nombre, pour que la seconde décision soit
  -- prise en connaissance de cause.
  IF p_audience = 'all' AND NOT p_confirme_envoi_large THEN
    RAISE EXCEPTION 'NEXUS: envoi large refusé — % usager(s) et % jeton(s) seraient touchés. Relance avec p_confirme_envoi_large := true si c''est bien voulu.',
      coalesce(cardinality(v_users), 0), coalesce(v_tokens, 0)
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 5. ZÉRO CIBLE = ÉCHEC BRUYANT -----------------------------------
  IF v_users IS NULL OR cardinality(v_users) = 0 THEN
    RAISE EXCEPTION 'NEXUS: aucun appareil pour cette audience — rien n''a été envoyé.'
      USING ERRCODE = 'check_violation';
  END IF;

  ---- 6. LE BILAN AVANT L'ENVOI ---------------------------------------
  -- Écrit d'abord : si l'orchestrateur ne répond jamais, la ligne reste
  -- en 'QUEUED' et le silence est visible au lieu d'être total.
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

  -- timeout explicite : l'orchestrateur répond 202 en ~50 ms, donc 15 s
  -- est une ceinture, pas une attente. Contraste voulu avec
  -- notify_on_message, qui n'en passe aucun (défaut 5 s) — non touchée.
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

REVOKE ALL ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean) TO authenticated;

COMMENT ON FUNCTION public.send_push_announcement(text, text, text, uuid[], boolean) IS
  'Annonce push admin (canal hors messagerie). Audience : me | all | athletes | coachs | recruteurs | user. « all » exige p_confirme_envoi_large := true. Bilan dans push_announcements.';
