-- ════════════════════════════════════════════════════════════════════
-- finish_coach_school_onboarding — add a CREATE-team branch (Fix #2 équipes)
--
-- The school finisher previously only LINKED an existing team
-- (p_team_id -> team_coaches role='assistant'). This adds a CREATE branch
-- that mirrors finish_coach_civil_onboarding's create path EXACTLY — the
-- only difference is school_id = p_school_id (the real school) instead of
-- the civil club. The team creator becomes head_coach (PO decision).
--
-- Why DROP + recreate (not a bare CREATE OR REPLACE): the 4 new params
-- change the function's argument signature, so CREATE OR REPLACE alone
-- would register a SECOND 17-arg overload alongside the old 13-arg one,
-- making the existing 13-arg client calls ambiguous ("function is not
-- unique"). We drop the exact old signature, then recreate with the new
-- params defaulted to NULL — so existing 13-arg callers keep working
-- unchanged (the defaults fill the rest). DROP clears the function's
-- grants, so they are re-applied at the bottom. Idempotent / re-runnable.
-- ════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.finish_coach_school_onboarding(
  uuid, text, text, text, text, text, text, integer, text, uuid, text, boolean, text
);

CREATE OR REPLACE FUNCTION public.finish_coach_school_onboarding(
  p_school_id        uuid,
  p_region           text,
  p_sport            text,
  p_first_name       text,
  p_last_name        text,
  p_phone            text,
  p_bio              text,
  p_experience_years integer,
  p_photo_url        text,
  p_team_id          uuid,
  p_director_choice  text,
  p_rprp_accepted    boolean,
  p_invite_email     text,
  -- NEW (DEFAULT NULL → existing 13-arg calls are unaffected). Set ONLY
  -- when the coach creates a team instead of joining one.
  p_team_name        text DEFAULT NULL,
  p_team_age_group   text DEFAULT NULL,
  p_team_gender      text DEFAULT NULL,
  p_team_division    text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_team_created       boolean := false;
  v_sport_id           uuid;          -- NEW : résolu depuis p_sport pour la création
  v_team_id            uuid;          -- NEW : id de l'équipe créée
  v_now                timestamptz := now();
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── 2. Role + context check ──────────────────────────────────
  -- Flow école : role='COACH' + context IN ('scolaire','collegial').
  -- Le coach civil ('ligue_civile') a son propre flow (sprint coach-4).
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS NULL
     OR v_context = 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- ── 3. Director choice validation ────────────────────────────
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 4. ENFORCEMENT — règle Loi 25 (responsable + RPRP) ─────
  v_has_resp := public.school_has_responsable(p_school_id);

  -- Règle 1 : école sans responsable → seul owner/interim acceptés.
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Règle 2 : owner/interim exige rprp_accepted=true.
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 5. Préparation des valeurs pour profile_data ────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : on stash uniquement si email non-vide.
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'school')
    ELSE NULL
  END;

  -- RPRP : timestamp posé UNIQUEMENT si owner/interim accepté.
  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 6. Merge profile_data (préserve l'existant) ──────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 7. users UPDATE ──────────────────────────────────────────
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_school_id,
      region              = NULLIF(TRIM(COALESCE(p_region, '')), ''),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- ── 8. school_coaches UPSERT ─────────────────────────────────
  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, p_school_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  -- ── 8b. Résoudre sport_id depuis le sport déclaré (pour création) ──
  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  -- ── 9. Équipe — REJOINDRE une existante OU en CRÉER une ──────
  -- Link et create mutuellement exclusifs ; les DEUX NULL = continuer
  -- sans équipe (valide, aucun write équipe).
  IF p_team_id IS NOT NULL THEN
    -- Branche LINK existante (INCHANGÉE) — rôle 'assistant'.
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, p_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    GET DIAGNOSTICS v_team_created = ROW_COUNT;
    v_team_created := (v_team_created::int = 1);

  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    -- Branche CREATE (miroir civil) — school_id = p_school_id (la VRAIE
    -- école, seule différence vs le civil qui met v_club_id). Créateur
    -- = head_coach.
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;
    INSERT INTO public.teams (school_id, sport_id, name, age_group, gender, division, is_active)
    VALUES (
      p_school_id,
      v_sport_id,
      TRIM(p_team_name),
      NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
      NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
      NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
      true
    )
    RETURNING id INTO v_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'head_coach')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    v_team_created := true;
  END IF;

  -- ── 10. admin_claims INSERT (si owner/interim, anti-duplicate) ─
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_school_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_school_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- ── 11. Retour ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                     true,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created,
    'team_linked',            COALESCE(v_team_created, false),
    'team_id',                v_team_id
  );
END;
$function$;

-- Re-apply the grants cleared by DROP (mirror finish_coach_civil_onboarding).
GRANT EXECUTE ON FUNCTION public.finish_coach_school_onboarding(
  uuid, text, text, text, text, text, text, integer, text, uuid, text, boolean, text,
  text, text, text, text
) TO anon, authenticated, service_role;
