-- ═══════════════════════════════════════════════════════════════
-- iter recruteur-rpc-2b — RPC atomique finish_recruiter_onboarding +
-- enforcement serveur Loi 25 (responsable RPRP) côté recruteur CÉGEP.
--
-- Pré-requis (déjà en place) :
--   - 20260610100000 school_has_responsable (agnostique au type school
--     — vérifié empiriquement sur un CEGEP au DIAG recruteur-1)
--   - 20260515210000 apply_admin_claim_approval (trigger sur
--     admin_claims, agnostique au type school — flippe is_school_admin
--     + profile_data.admin_type sur APPROVED, même pour CEGEP)
--
-- Calquée sur finish_coach_school_onboarding (20260610110000) avec
-- ces deltas recruteur :
--
--   - role = 'RECRUTEUR' (vs 'COACH'), context = 'collegial'
--     (vs 'scolaire'/'collegial' côté coach école).
--   - Lien recruteur↔CÉGEP via users.school_id (pas de table de
--     liaison ni school_coaches — le recruteur n'est pas dans cette
--     table).
--   - Ajout users.primary_team_id (le programme/équipe sous le CÉGEP,
--     OPTIONNEL). UPDATE conditionnel pour ne pas écraser une valeur
--     existante avec NULL si le recruteur n'a pas choisi de programme.
--   - Validation p_cegep_id : doit pointer sur un schools row avec
--     has_collegial=true (cohérence wizard web qui query ce filtre).
--   - PAS de school_coaches / team_coaches (hors-scope recruteur).
--   - PAS de recruiter_preferences (gestion via wizard step Critères
--     séparé, post-RPC).
--
-- Le reste (gating responsable, RPRP enforcement, admin_claims insert
-- avec anti-duplicate, claim_type mapping owner→DIRECTEUR / interim→
-- INTERIM) est verbatim école.
--
-- SECURITY DEFINER + row_security=off : la fonction écrit dans users,
-- admin_claims (tables sous RLS). Le caller n'aurait pas les droits
-- direct sur admin_claims (claim PENDING d'un autre user).
--
-- ⚠️ N'écrit JAMAIS is_school_admin (reste false → modération admin
-- via apply_admin_claim_approval trigger).
-- N'écrit JAMAIS date_naissance (recruteur ne capte pas DOB).
-- N'écrit que pour auth.uid() (pas de p_user_id, sécurité by-construction).
--
-- Codes d'erreur (texte) :
--   NOT_AUTHENTICATED          — auth.uid() est NULL
--   WRONG_ROLE_OR_CONTEXT      — role != RECRUTEUR ou context != 'collegial'
--   INVALID_CEGEP              — p_cegep_id n'existe pas ou has_collegial=false
--   INVALID_DIRECTOR_CHOICE    — valeur hors {owner, interim, invite, coach_only}
--   SCHOOL_REQUIRES_RESPONSABLE — CÉGEP sans responsable + choice NOT IN owner/interim
--   RPRP_REQUIRED              — owner/interim sans p_rprp_accepted=true
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finish_recruiter_onboarding(
  p_cegep_id         uuid,
  p_primary_team_id  uuid,
  p_sport            text,
  p_first_name       text,
  p_last_name        text,
  p_phone            text,
  p_bio              text,
  p_experience_years int,
  p_photo_url        text,
  p_director_choice  text,
  p_rprp_accepted    boolean,
  p_invite_email     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_cegep_valid        boolean;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── 2. Role + context check (recruteur : collegial uniquement) ─
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'RECRUTEUR'::public.user_role
     OR v_context IS DISTINCT FROM 'collegial'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- ── 3. CÉGEP validation (has_collegial=true, cohérence wizard) ──
  SELECT (has_collegial = true) INTO v_cegep_valid
  FROM public.schools WHERE id = p_cegep_id;

  IF v_cegep_valid IS NULL OR NOT v_cegep_valid THEN
    RAISE EXCEPTION 'INVALID_CEGEP';
  END IF;

  -- ── 4. Director choice validation (parité école : 4 choix) ──
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 5. ENFORCEMENT — règle Loi 25 (parité école) ───────────
  v_has_resp := public.school_has_responsable(p_cegep_id);

  -- Règle 1 : CÉGEP sans responsable → seuls owner ou interim acceptés.
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Règle 2 : owner/interim exige p_rprp_accepted=true.
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 6. Préparation profile_data (parité école) ──────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : stash uniquement si email non-vide. type='cegep'
  -- (recruteur-specific, vs 'school'/'league' côté coach).
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'cegep')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 7. Merge profile_data (préserve l'existant) ─────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 8. users UPDATE ─────────────────────────────────────────
  -- primary_team_id : conditionnel — si null fourni, on PRÉSERVE la
  -- valeur existante (COALESCE) plutôt que d'écraser. Le recruteur
  -- peut sauter le programme step et revenir le compléter plus tard.
  -- photo_url : idem (préserve si pas de nouvelle).
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_cegep_id,
      primary_team_id     = COALESCE(p_primary_team_id, primary_team_id),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- ── 9. admin_claims INSERT si owner/interim — anti-duplicate ─
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_cegep_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_cegep_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- ── 10. Retour ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                     true,
    'cegep_id',               p_cegep_id,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_recruiter_onboarding(
  uuid, uuid,
  text, text, text, text, text, int, text,
  text, boolean, text
) TO authenticated;
