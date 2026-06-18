-- ═══════════════════════════════════════════════════════════════
-- iter coach-civil-2b — RPC atomique finish_coach_civil_onboarding +
-- enforcement serveur Loi 25 (responsable RPRP) pour le coach civil.
--
-- Pré-requis :
--   - 20260610100000 school_has_responsable (agnostique au type school)
--   - 20260611000000 coaches_create_civil_schools (RLS additive,
--     même si SECURITY DEFINER ici bypass — cohérence du modèle).
--
-- Calquée sur finish_coach_school_onboarding (20260610110000) avec
-- ces deltas civils :
--
--  - Le club peut être SOIT existant (p_club_id), SOIT créé
--    (p_club_name + p_club_city + p_club_region) en une transaction.
--    L'école n'avait jamais ce cas (les SECONDAIRE sont seedées MEQ).
--
--  - Le wizard civil web N'OFFRE PAS 'interim' ni 'coach_only' (le
--    DirectorChoiceStep type="league" ne montre que self/invite — cf.
--    DIAG coach-civil-responsable-1). La RPC accepte donc UNIQUEMENT
--    'owner' | 'invite'. Cohérence stricte UI ↔ serveur.
--
--  - Règle responsable : un club sans responsable EXIGE 'owner'
--    (RPRP attesté). 'invite' seul ne suffit pas — on ne crée pas
--    un club orphelin. Si club existant + responsable → 'invite' OK.
--
--  - L'équipe peut elle aussi être existante (rejoindre) OU créée
--    (nouvelle row teams) — wizard civil web le permet, parité.
--    Création équipe → role='head_coach' (parité L3270 web).
--    Choix équipe existante → role='assistant' (parité joinExistingTeam).
--
--  - school_coaches.role TOUJOURS 'COACH'. Le wizard web actuel pose
--    'DIRECTEUR' direct (auto-promotion non Loi 25). La RPC FERME cette
--    porte : le claim DIRECTEUR passe désormais par admin_claims
--    + modération admin (apply_admin_claim_approval flippe is_school_admin).
--
-- SECURITY DEFINER + row_security=off : la fonction écrit dans users,
-- schools (création club), school_coaches, teams, team_coaches,
-- admin_claims (tables sous RLS). Le caller n'aurait pas les droits
-- direct (notamment admin_claims INSERT RLS).
--
-- ⚠️ N'écrit JAMAIS is_school_admin (reste false → modération admin).
-- N'écrit JAMAIS date_naissance (déjà posée au signup).
-- N'écrit que pour auth.uid() (pas de p_user_id, sécurité by-construction).
--
-- Codes d'erreur (texte) :
--   NOT_AUTHENTICATED          — auth.uid() est NULL
--   WRONG_ROLE_OR_CONTEXT      — role != COACH ou context != 'ligue_civile'
--   INVALID_CLUB               — p_club_id invalide/non-LIGUE_CIVILE,
--                                ou création sans p_club_name
--   INVALID_DIRECTOR_CHOICE    — valeur hors {owner, invite}
--   SCHOOL_REQUIRES_RESPONSABLE — club sans responsable + choice != owner
--   RPRP_REQUIRED              — owner sans p_rprp_accepted=true
--   INVALID_SPORT              — création équipe sans sport résolu
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finish_coach_civil_onboarding(
  -- Club : soit existant (p_club_id non-null), soit création (les autres).
  p_club_id          uuid,
  p_club_name        text,
  p_club_city        text,
  p_club_region      text,
  -- Profil (idem école)
  p_sport            text,
  p_first_name       text,
  p_last_name        text,
  p_phone            text,
  p_bio              text,
  p_experience_years int,
  p_photo_url        text,
  -- Équipe : soit existante (p_team_id non-null), soit création (les autres).
  p_team_id          uuid,
  p_team_name        text,
  p_team_age_group   text,
  p_team_gender      text,
  p_team_division    text,
  -- Responsable (civil : seulement owner | invite)
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
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
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

  -- ── 3. Director choice validation (civil : owner | invite seulement) ─
  IF p_director_choice NOT IN ('owner', 'invite') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 4. Résoudre ou créer le club (delta civil) ─────────────
  IF p_club_id IS NOT NULL THEN
    -- Club existant : valider qu'il est bien LIGUE_CIVILE.
    SELECT type INTO v_club_type FROM public.schools WHERE id = p_club_id;
    IF v_club_type IS NULL OR v_club_type IS DISTINCT FROM 'LIGUE_CIVILE' THEN
      RAISE EXCEPTION 'INVALID_CLUB';
    END IF;
    v_club_id := p_club_id;
  ELSE
    -- Création : name obligatoire.
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

  -- ── 5. ENFORCEMENT — règle Loi 25 (responsable + RPRP) ─────
  v_has_resp := public.school_has_responsable(v_club_id);

  -- Règle 1 : club sans responsable → seul 'owner' accepté.
  --           (Civil n'a pas d'interim ni coach_only — un club orphelin
  --            ne peut être créé/rejoint sans qu'un owner ATTESTE la
  --            responsabilité RPRP.)
  IF NOT v_has_resp AND p_director_choice <> 'owner' THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Règle 2 : 'owner' exige p_rprp_accepted=true.
  IF p_director_choice = 'owner' AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 6. Résoudre sport_id (utilisé si création équipe) ───────
  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  -- ── 7. Préparation profile_data ─────────────────────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner' THEN 'owner'
    ELSE NULL
  END;

  -- Invite : on stash uniquement si email non-vide. type='league' pour
  -- distinguer des invitations école (utile à un admin tab futur).
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'league')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice = 'owner' AND p_rprp_accepted THEN v_now
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
  -- onboarding_complete posé À LA FIN (atomique : si la transaction
  -- rollback, il reste false → re-essai propre).
  -- region : préserve la région du club si fournie, sinon la région
  -- existante du user (un club sans région n'écrase pas users.region).
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
  -- Parité école : le claim DIRECTEUR passe par admin_claims +
  -- modération admin (jamais écrit direct ici). FERME l'auto-promotion
  -- du wizard web actuel (LeagueCoachLeagueStep L3259 écrit
  -- role='DIRECTEUR' direct — à retirer en sprint civil-2c côté client).
  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, v_club_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  -- ── 11. Équipe — soit rejoindre, soit créer (civil delta) ───
  IF p_team_id IS NOT NULL THEN
    -- Équipe existante : rejoindre comme 'assistant' (parité
    -- joinExistingTeam web L1701).
    v_team_id := p_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    -- Création équipe : sport_id obligatoire (NOT NULL sur teams).
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;
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
    -- Créateur de l'équipe → 'head_coach' (parité L3270 web).
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'head_coach')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  END IF;
  -- Sinon (ni team_id ni team_name) : pas d'équipe créée — non-bloquant
  -- côté serveur. Le client civil peut décider de l'imposer côté UX.

  -- ── 12. admin_claims INSERT si owner — anti-duplicate ───────
  IF p_director_choice = 'owner' THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = v_club_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      -- Civil n'a pas d'INTERIM (UX wizard). claim_type='DIRECTEUR'.
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, v_club_id, 'DIRECTEUR', 'PENDING');
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
    'claim_created',          v_claim_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_coach_civil_onboarding(
  uuid, text, text, text,
  text, text, text, text, text, int, text,
  uuid, text, text, text, text,
  text, boolean, text
) TO authenticated;
