-- ============================================================================
-- Bridge RSEQ Phase 3 — Morceau 1 : garde d'adoption anti-doublon (ligue civile)
--
-- Miroir de la migration école : avant de créer une équipe dans
-- finish_coach_civil_onboarding, on cherche une équipe existante à identité
-- NORMALISÉE identique (club_id, sport_id, lower(age_group), gender, division
-- normalisée Division N ≡ DN), en IGNORANT name + season. Si elle existe →
-- ADOPTER (rattacher le coach), AUCUN INSERT teams. Sinon → créer comme avant.
--
-- Idempotent, aucun DELETE, aucun UPDATE d'une team existante.
-- ============================================================================

-- Helper immuable (idempotent — même définition que la migration école).
CREATE OR REPLACE FUNCTION public._team_norm_division(d text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL OR btrim(d) = ''      THEN NULL
    WHEN d ~* '^division\s*[1-4]$'       THEN 'D' || substring(d from '[1-4]')
    WHEN d ~* '^d[1-4]$'                 THEN upper(btrim(d))
    ELSE btrim(d)
  END
$$;

CREATE OR REPLACE FUNCTION public.finish_coach_civil_onboarding(
  p_club_id uuid, p_club_name text, p_club_city text, p_club_region text,
  p_sport text, p_first_name text, p_last_name text, p_phone text, p_bio text,
  p_experience_years integer, p_photo_url text, p_team_id uuid, p_team_name text,
  p_team_age_group text, p_team_gender text, p_team_division text,
  p_director_choice text, p_rprp_accepted boolean, p_invite_email text)
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
  v_club_id            uuid;
  v_club_type          text;
  v_club_created       boolean := false;
  v_team_id            uuid;
  v_team_created       boolean := false;
  v_sport_id           uuid;
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
  -- adoption guard
  v_existing_team_id   uuid;
  v_adopt_role         text;
  v_team_adopted       boolean := false;
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── 2. Role + context check (civil : ligue_civile uniquement) ─
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS DISTINCT FROM 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- ── 3. Director choice validation (parité école : 4 choix) ──
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 4. Résoudre ou créer le club (delta civil) ─────────────
  IF p_club_id IS NOT NULL THEN
    SELECT type INTO v_club_type FROM public.schools WHERE id = p_club_id;
    IF v_club_type IS NULL OR v_club_type IS DISTINCT FROM 'LIGUE_CIVILE' THEN
      RAISE EXCEPTION 'INVALID_CLUB';
    END IF;
    v_club_id := p_club_id;
  ELSE
    IF p_club_name IS NULL OR LENGTH(TRIM(p_club_name)) = 0 THEN
      RAISE EXCEPTION 'INVALID_CLUB';
    END IF;
    INSERT INTO public.schools (name, type, city, region)
    VALUES (
      TRIM(p_club_name),
      'LIGUE_CIVILE',
      NULLIF(TRIM(COALESCE(p_club_city, '')),   ''),
      NULLIF(TRIM(COALESCE(p_club_region, '')), '')
    )
    RETURNING id INTO v_club_id;
    v_club_created := true;
  END IF;

  -- ── 5. ENFORCEMENT — règle Loi 25 (parité école) ───────────
  v_has_resp := public.school_has_responsable(v_club_id);

  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 6. Résoudre sport_id (si création équipe) ──────────────
  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  -- ── 7. Préparation profile_data (parité école) ──────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'league')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 8. Merge profile_data (préserve l'existant) ─────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 9. users UPDATE ─────────────────────────────────────────
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = v_club_id,
      region              = COALESCE(NULLIF(TRIM(COALESCE(p_club_region, '')), ''), region),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- ── 10. school_coaches UPSERT — role TOUJOURS 'COACH' ───────
  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, v_club_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  -- ── 11. Équipe — rejoindre / ADOPTER / créer ────────────────
  IF p_team_id IS NOT NULL THEN
    v_team_id := p_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;

    -- ── GARDE D'ADOPTION : team à identité normalisée déjà présente ? ──
    SELECT id INTO v_existing_team_id
    FROM public.teams
    WHERE school_id = v_club_id
      AND sport_id  = v_sport_id
      AND is_active = true
      AND lower(btrim(COALESCE(age_group, ''))) = lower(btrim(COALESCE(p_team_age_group, '')))
      AND lower(btrim(COALESCE(gender,    ''))) = lower(btrim(COALESCE(p_team_gender,    '')))
      AND public._team_norm_division(division)
          IS NOT DISTINCT FROM public._team_norm_division(p_team_division)
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_team_id IS NOT NULL THEN
      -- ADOPTER : rattacher le coach, AUCUN insert teams.
      v_team_id := v_existing_team_id;
      v_adopt_role := CASE
        WHEN EXISTS (SELECT 1 FROM public.team_coaches WHERE team_id = v_existing_team_id)
          THEN 'assistant' ELSE 'head_coach'
      END;
      INSERT INTO public.team_coaches (coach_id, team_id, role)
      VALUES (v_uid, v_team_id, v_adopt_role)
      ON CONFLICT (team_id, coach_id) DO NOTHING;
      v_team_adopted := true;
    ELSE
      -- CRÉER (inchangé).
      INSERT INTO public.teams (
        school_id, sport_id, name, age_group, gender, division, is_active
      ) VALUES (
        v_club_id,
        v_sport_id,
        TRIM(p_team_name),
        NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
        NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
        NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
        true
      )
      RETURNING id INTO v_team_id;
      v_team_created := true;
      INSERT INTO public.team_coaches (coach_id, team_id, role)
      VALUES (v_uid, v_team_id, 'head_coach')
      ON CONFLICT (team_id, coach_id) DO NOTHING;
    END IF;
  END IF;

  -- ── 12. admin_claims INSERT si owner/interim — anti-duplicate ─
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = v_club_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, v_club_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- ── 13. Retour ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                     true,
    'club_id',                v_club_id,
    'club_created',           v_club_created,
    'has_responsable_before', v_has_resp,
    'team_id',                v_team_id,
    'team_created',           v_team_created,
    'team_adopted',           v_team_adopted,
    'claim_created',          v_claim_created
  );
END;
$function$;
