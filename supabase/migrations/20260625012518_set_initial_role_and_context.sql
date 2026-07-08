-- ════════════════════════════════════════════════════════════════════
-- set_initial_role_and_context — RPC one-shot (BLOC 2)
--
-- RÉCONCILIATION : ce fichier reproduit l'enregistrement RÉEL appliqué sur
-- le cloud (schema_migrations version 20260625012518). Le cloud a reçu la
-- fonction via MCP/Studio en deux temps (CREATE+GRANT ici, REVOKE anon dans
-- 20260625012739) ; le fichier local combiné 20260625010000 a été retiré au
-- profit de ces deux fichiers, pour aligner l'historique local sur le distant.
--
-- Pose le `role` + `context` INITIAUX d'un compte social (corrige le défaut
-- ATHLETE/NULL une seule fois, avant l'onboarding). SECURITY DEFINER +
-- row_security=off + search_path pinné (pattern is_recruiter()).
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_initial_role_and_context(
  p_role    text,
  p_context text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_uid  uuid;
  v_role public.user_role;
  v_ob   boolean;
  v_ctx  text;
BEGIN
  -- 1. Auth obligatoire
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 2. Validation des valeurs (self-service : JAMAIS ADMIN/PARTNER)
  IF p_role NOT IN ('ATHLETE','COACH','RECRUTEUR') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  IF p_context NOT IN ('scolaire','collegial','ligue_civile') THEN
    RAISE EXCEPTION 'INVALID_CONTEXT';
  END IF;
  -- Cohérence role <-> context (athlète relâché : scolaire OU ligue_civile)
  IF NOT (
       (p_role = 'ATHLETE'   AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'COACH'     AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'RECRUTEUR' AND p_context = 'collegial')
  ) THEN
    RAISE EXCEPTION 'INCOHERENT_ROLE_CONTEXT';
  END IF;

  -- 3. Etat courant (lecture en row_security=off -> pas de recursion sur users)
  SELECT role, onboarding_complete, context
    INTO v_role, v_ob, v_ctx
  FROM public.users
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'NO_PROFILE';
  END IF;

  -- 4. Gardes one-shot
  IF v_ob IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_ONBOARDED';
  END IF;
  IF v_role <> 'ATHLETE'::public.user_role THEN
    RAISE EXCEPTION 'ROLE_ALREADY_SET';
  END IF;
  IF v_ctx IS NOT NULL THEN
    RAISE EXCEPTION 'CONTEXT_ALREADY_SET';
  END IF;

  -- 5. Ecriture STRICTE : role + context UNIQUEMENT.
  UPDATE public.users
  SET role    = p_role::public.user_role,
      context = p_context
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'role', p_role, 'context', p_context);
END;
$function$;

REVOKE ALL     ON FUNCTION public.set_initial_role_and_context(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_initial_role_and_context(text, text) TO authenticated;
