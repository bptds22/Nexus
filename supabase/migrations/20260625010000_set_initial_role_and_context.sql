-- ════════════════════════════════════════════════════════════════════
-- set_initial_role_and_context — RPC one-shot (BLOC 2)
--
-- Pose le `role` + `context` INITIAUX d'un compte social. Un signup social
-- (Google/Apple) naît `role='ATHLETE', context=NULL` via handle_new_auth_user
-- (COALESCE metadata->>'role', 'ATHLETE'). Cette RPC permet à l'utilisateur de
-- corriger ce défaut UNE SEULE FOIS, avant l'onboarding.
--
-- Les colonnes role/context sont VERROUILLÉES côté self-service par la policy
-- "users update own" (WITH CHECK user_privileged_cols_unchanged(...)). Un UPDATE
-- direct par l'utilisateur échoue donc en 42501. On copie le pattern éprouvé de
-- is_recruiter() : SECURITY DEFINER + SET row_security = off + search_path pinné,
-- ce qui (1) écrit les colonnes pinnées sans passer par la RLS, et (2) évite la
-- récursion historique (lecture de public.users hors policies).
--
-- Garde-fous : NOT_AUTHENTICATED, NO_PROFILE, ALREADY_ONBOARDED,
-- ROLE_ALREADY_SET (défaut social = ATHLETE ; tout autre rôle = déjà décidé),
-- CONTEXT_ALREADY_SET (durcissement one-shot). Écriture STRICTE role+context —
-- is_platform_admin / status / is_school_admin / onboarding_complete intouchés.
-- ADMIN/PARTNER ne peuvent JAMAIS être auto-attribués.
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
  -- Cohérence role ↔ context (athlète relâché : scolaire OU ligue_civile)
  IF NOT (
       (p_role = 'ATHLETE'   AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'COACH'     AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'RECRUTEUR' AND p_context = 'collegial')
  ) THEN
    RAISE EXCEPTION 'INCOHERENT_ROLE_CONTEXT';
  END IF;

  -- 3. État courant (lecture en row_security=off → pas de récursion sur users)
  SELECT role, onboarding_complete, context
    INTO v_role, v_ob, v_ctx
  FROM public.users
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'NO_PROFILE';
  END IF;

  -- 4. Gardes one-shot
  IF v_ob IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_ONBOARDED';        -- onboarding terminé → figé
  END IF;
  IF v_role <> 'ATHLETE'::public.user_role THEN
    RAISE EXCEPTION 'ROLE_ALREADY_SET';         -- rôle déjà décidé (non-défaut)
  END IF;
  IF v_ctx IS NOT NULL THEN
    RAISE EXCEPTION 'CONTEXT_ALREADY_SET';      -- déjà exécuté (durcissement)
  END IF;

  -- 5. Écriture STRICTE : role + context UNIQUEMENT.
  UPDATE public.users
  SET role    = p_role::public.user_role,
      context = p_context
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'role', p_role, 'context', p_context);
END;
$function$;

REVOKE ALL     ON FUNCTION public.set_initial_role_and_context(text, text) FROM PUBLIC;
-- Supabase accorde EXECUTE à anon/authenticated/service_role par DEFAULT
-- PRIVILEGES (grant explicite, non couvert par REVOKE FROM PUBLIC). On retire
-- anon explicitement : RPC réservée aux comptes authentifiés. Autosuffisant —
-- un replay from scratch obtient le bon état sans anon.
REVOKE EXECUTE ON FUNCTION public.set_initial_role_and_context(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_initial_role_and_context(text, text) TO authenticated;
