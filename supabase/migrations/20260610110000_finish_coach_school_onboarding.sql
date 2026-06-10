-- ═══════════════════════════════════════════════════════════════
-- iter coach-responsable-2b — RPC atomique finish coach école +
-- enforcement serveur Loi 25 (responsable RPRP).
--
-- Pré-requis : school_has_responsable (sprint 2a) appliquée.
--
-- La RPC reproduit le finish() mobile/web (mapping validé en coach-3b)
-- en UNE transaction (rollback total si l'un des steps plante). En
-- bonus, applique 2 règles côté SERVEUR (défense en profondeur) :
--
--  1. SCHOOL_REQUIRES_RESPONSABLE : si l'école n'a aucun responsable
--     (school_has_responsable=false), le coach DOIT choisir 'owner'
--     ou 'interim' (attestation RPRP). 'coach_only' et 'invite' sont
--     rejetés. Empêche un appel API forgé de contourner le gate
--     client (UX).
--
--  2. RPRP_REQUIRED : si owner/interim, p_rprp_accepted DOIT être true.
--     Sinon RAISE EXCEPTION. (Le gate client doit empêcher d'arriver
--     ici sans la case cochée.)
--
-- SECURITY DEFINER + row_security=off : la fonction écrit dans users,
-- school_coaches, team_coaches, admin_claims (tables sous RLS). Le caller
-- n'aurait pas les droits direct (notamment admin_claims INSERT RLS).
--
-- ⚠️ La fonction écrit UNIQUEMENT pour auth.uid() (jamais un autre
-- user). Pas de p_user_id. Sécurité par construction.
--
-- ⚠️ N'écrit JAMAIS is_school_admin (reste false → modération admin).
-- N'écrit JAMAIS date_naissance (déjà posée au signup).
--
-- Codes d'erreur retournés via message texte (pattern Supabase RPC) :
--   NOT_AUTHENTICATED         — auth.uid() est NULL
--   WRONG_ROLE_OR_CONTEXT     — role != COACH ou context != 'scolaire'/'collegial'
--   INVALID_DIRECTOR_CHOICE   — valeur p_director_choice hors enum
--   SCHOOL_REQUIRES_RESPONSABLE — règle 1 ci-dessus
--   RPRP_REQUIRED             — règle 2 ci-dessus
-- Le client mappera les 2 derniers vers des messages FR explicatifs.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.finish_coach_school_onboarding(
  p_school_id        uuid,
  p_region           text,
  p_sport            text,
  p_first_name       text,
  p_last_name        text,
  p_phone            text,
  p_bio              text,
  p_experience_years int,
  p_photo_url        text,
  p_team_id          uuid,
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

  -- RPRP : timestamp posé UNIQUEMENT si owner/interim accepté (chemin
  -- decline supprimé — la règle 2 ci-dessus exige true).
  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 6. Merge profile_data (préserve l'existant) ──────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  -- Utilise '||' jsonb : les nouvelles clés écrasent les anciennes
  -- mais le reste de la JSONB existante est préservé. Les valeurs NULL
  -- sont jsonb 'null' (pas absentes) — sémantique cohérente avec le
  -- finish() web qui écrit explicitement null sur les chemins
  -- non-applicables.
  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 7. users UPDATE ──────────────────────────────────────────
  -- onboarding_complete posé À LA FIN (atomique : si la transaction
  -- rollback, le flag reste false → re-essai propre).
  -- photo_url : COALESCE pour préserver la photo existante si pas de
  -- nouvelle (l'utilisateur peut avoir uploadé puis annulé).
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
  -- role TOUJOURS 'COACH' (parité web — claim DIRECTEUR/INTERIM passe
  -- par admin_claims). UNIQUE (school_id, coach_id) → ON CONFLICT.
  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, p_school_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  -- ── 9. team_coaches INSERT si équipe choisie ─────────────────
  -- UNIQUE (team_id, coach_id) → ON CONFLICT DO NOTHING pour
  -- idempotence sur retry.
  IF p_team_id IS NOT NULL THEN
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, p_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    -- Note : v_team_created sera false si déjà inséré, true sinon —
    -- pas critique pour le retour, mais on pourrait le détecter via
    -- ROW_COUNT si besoin. Pour l'instant, info pas remontée.
    GET DIAGNOSTICS v_team_created = ROW_COUNT;
    v_team_created := (v_team_created::int = 1);
  END IF;

  -- ── 10. admin_claims INSERT (si owner/interim, anti-duplicate) ─
  -- Pas de UNIQUE sur la table → vérifier qu'il n'y a pas déjà un
  -- claim PENDING/APPROVED pour ce user+school avant d'insérer.
  -- Évite les claims dupliqués sur retry après échec partiel.
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
    'ok',                    true,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created,
    'team_linked',            COALESCE(v_team_created, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_coach_school_onboarding(
  uuid, text, text, text, text, text, text, int, text, uuid, text, boolean, text
) TO authenticated;
