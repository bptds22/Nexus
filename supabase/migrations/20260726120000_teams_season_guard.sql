-- ============================================================================
-- FIX 1 — Saison des équipes : le bloquant de septembre
--
-- Problème constaté (audit chaîne coach→équipe→athlète→calendrier) :
--   1. teams.season avait DEFAULT '2025-2026' HARDCODÉ. La branche création des
--      deux RPC finish_coach_*_onboarding n'envoie pas season → toute équipe
--      créée par onboarding en septembre 2026 serait estampillée 2025-2026.
--   2. Le garde d'adoption IGNORE season et trie ORDER BY created_at ASC →
--      il adopte TOUJOURS la ligne la plus ancienne, donc celle de la saison
--      passée. Un coach qui s'inscrit en septembre 2026 se retrouve rattaché
--      à l'équipe 2025-2026 → 0 match 2026-27 dans le calendrier recruteur.
--   3. Une ligne avait season='2026-27' (format hors norme). Comme le tri est
--      lexicographique, '2026-27' > '2026-2027' : tout raisonnement basé sur
--      max(season) désignait cette ligne et aurait traité les 210 vraies
--      équipes 2026-2027 comme « saison antérieure ».
--
-- Ce que fait cette migration :
--   (0) répare la ligne '2026-27' → '2026-2027' et pose un CHECK de format,
--       pour que le piège du tri lexicographique ne puisse pas revenir.
--   (a) current_season() + DEFAULT teams.season calculé (bascule 1er août —
--       les matchs 2026-27 commencent le 21 août).
--   (b) les deux RPC : lookup d'adoption borné à season >= current_season()
--       et trié season DESC, created_at ASC (préfère la saison la plus récente
--       disponible, jamais une saison passée) ; INSERT envoie season explicite.
--   (d) deactivate_stale_orphan_teams() : is_active=false sur les équipes de
--       saisons ANTÉRIEURES à la saison courante qui n'ont NI coach NI athlète.
--       JAMAIS de DELETE. Les équipes avec coach ou athlètes sont PRÉSERVÉES
--       (continuité — migration de roster à traiter plus tard).
--
-- Aucun DELETE. Aucune écriture sur games. rseq_team_id jamais touché.
-- ============================================================================

-- ── (0) Réparation du format + garde-fou ────────────────────────────────────
-- 1 ligne concernée (« Pionniers », non-RSEQ, 0 match, aucune collision
-- d'identité avec une ligne 2026-2027 existante — vérifié avant write).
UPDATE public.teams SET season = '2026-2027' WHERE season = '2026-27';

-- Empêche toute future saison mal formatée de casser les comparaisons
-- lexicographiques (NULL reste toléré : la colonne est nullable).
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_season_format_chk;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_season_format_chk
  CHECK (season IS NULL OR season ~ '^[0-9]{4}-[0-9]{4}$');

-- ── (a) Saison courante calculée ────────────────────────────────────────────
-- Saison RSEQ = août → juillet. STABLE (pas IMMUTABLE) : dépend de now().
CREATE OR REPLACE FUNCTION public.current_season()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM now()) >= 8
      THEN EXTRACT(YEAR FROM now())::int || '-' || (EXTRACT(YEAR FROM now())::int + 1)
    ELSE (EXTRACT(YEAR FROM now())::int - 1) || '-' || EXTRACT(YEAR FROM now())::int
  END
$$;

COMMENT ON FUNCTION public.current_season() IS
  'Saison RSEQ courante au format YYYY-YYYY. Bascule le 1er août (les calendriers '
  'RSEQ de la saison N commencent fin août). Source unique pour le DEFAULT de '
  'teams.season, le garde d''adoption des RPC onboarding et deactivate_stale_orphan_teams().';

ALTER TABLE public.teams ALTER COLUMN season SET DEFAULT public.current_season();

-- ── (d) Désactivation des équipes orphelines de saisons passées ─────────────
CREATE OR REPLACE FUNCTION public.deactivate_stale_orphan_teams()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Cible : saison STRICTEMENT antérieure à la saison courante, encore active,
  -- sans aucun coach ET sans aucun athlète. Jamais de DELETE — is_active=false
  -- est réversible et préserve la jointure games (qui ne filtre pas is_active).
  WITH cible AS (
    SELECT t.id
    FROM public.teams t
    WHERE t.is_active
      AND t.season IS NOT NULL
      AND t.season < public.current_season()
      AND NOT EXISTS (SELECT 1 FROM public.team_coaches  tc WHERE tc.team_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.team_athletes ta WHERE ta.team_id = t.id)
  )
  UPDATE public.teams SET is_active = false
  WHERE id IN (SELECT id FROM cible);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.deactivate_stale_orphan_teams() IS
  'Passe is_active=false sur les équipes des saisons antérieures à la saison '
  'courante qui n''ont ni coach ni athlète. À rappeler après chaque run de '
  'insert-rseq-teams.mjs. Idempotent, jamais de DELETE. Les équipes avec coach '
  'ou athlètes sont volontairement PRÉSERVÉES (continuité de roster).';

-- Appel une fois maintenant. Au 25 juillet 2026, current_season() = '2025-2026'
-- donc la cible (season < '2025-2026') est VIDE → no-op attendu. L'effet réel
-- (≈7 700 équipes 2025-2026 orphelines) arrivera au 1er août, ou dès le
-- prochain appel post-scrape.
DO $$
DECLARE v_n integer;
BEGIN
  v_n := public.deactivate_stale_orphan_teams();
  RAISE NOTICE 'deactivate_stale_orphan_teams: % équipe(s) désactivée(s)', v_n;
END $$;

-- ── (b) Garde d'adoption ÉCOLE : borné à la saison ──────────────────────────
CREATE OR REPLACE FUNCTION public.finish_coach_school_onboarding(
  p_school_id uuid, p_region text, p_sport text, p_first_name text,
  p_last_name text, p_phone text, p_bio text, p_experience_years integer,
  p_photo_url text, p_team_id uuid, p_director_choice text,
  p_rprp_accepted boolean, p_invite_email text,
  p_team_name text DEFAULT NULL::text, p_team_age_group text DEFAULT NULL::text,
  p_team_gender text DEFAULT NULL::text, p_team_division text DEFAULT NULL::text)
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
  v_sport_id           uuid;
  v_team_id            uuid;
  v_now                timestamptz := now();
  v_existing_team_id   uuid;
  v_adopt_role         text;
  v_team_adopted       boolean := false;
  v_season             text := public.current_season();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS NULL
     OR v_context = 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  v_has_resp := public.school_has_responsable(p_school_id);

  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'school')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

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

  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, p_school_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  IF p_team_id IS NOT NULL THEN
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, p_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    GET DIAGNOSTICS v_team_created = ROW_COUNT;
    v_team_created := (v_team_created::int = 1);
    v_team_id := p_team_id;

  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;

    -- FIX 1(b) : borné à la saison courante ou postérieure, et trié
    -- season DESC d'abord. Empêche l'adoption d'une équipe de saison passée
    -- (l'ancien ORDER BY created_at ASC seul adoptait systématiquement la plus
    -- vieille). Le >= couvre la fenêtre d'été où la saison N+1 est déjà
    -- chargée alors que current_season() renvoie encore N.
    SELECT id INTO v_existing_team_id
    FROM public.teams
    WHERE school_id = p_school_id
      AND sport_id  = v_sport_id
      AND is_active = true
      AND season IS NOT NULL
      AND season >= v_season
      AND lower(btrim(COALESCE(age_group, ''))) = lower(btrim(COALESCE(p_team_age_group, '')))
      AND lower(btrim(COALESCE(gender,    ''))) = lower(btrim(COALESCE(p_team_gender,    '')))
      AND public._team_norm_division(division)
          IS NOT DISTINCT FROM public._team_norm_division(p_team_division)
    ORDER BY season DESC, created_at ASC
    LIMIT 1;

    IF v_existing_team_id IS NOT NULL THEN
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
      -- FIX 1(b) : season explicite (ne dépend plus du DEFAULT de colonne).
      INSERT INTO public.teams (school_id, sport_id, name, age_group, gender, division, season, is_active)
      VALUES (
        p_school_id,
        v_sport_id,
        TRIM(p_team_name),
        NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
        NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
        NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
        v_season,
        true
      )
      RETURNING id INTO v_team_id;
      INSERT INTO public.team_coaches (coach_id, team_id, role)
      VALUES (v_uid, v_team_id, 'head_coach')
      ON CONFLICT (team_id, coach_id) DO NOTHING;
      v_team_created := true;
    END IF;
  END IF;

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

  RETURN jsonb_build_object(
    'ok',                     true,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created,
    'team_linked',            COALESCE(v_team_created, false),
    'team_adopted',           v_team_adopted,
    'team_id',                v_team_id,
    'season',                 v_season
  );
END;
$function$;

-- ── (b) Garde d'adoption CIVIL : même borne saison ──────────────────────────
CREATE OR REPLACE FUNCTION public.finish_coach_civil_onboarding(
  p_club_id uuid, p_club_name text, p_club_city text, p_club_region text,
  p_sport text, p_first_name text, p_last_name text, p_phone text, p_bio text,
  p_experience_years integer, p_photo_url text, p_team_id uuid,
  p_team_name text, p_team_age_group text, p_team_gender text,
  p_team_division text, p_director_choice text, p_rprp_accepted boolean,
  p_invite_email text)
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
  v_existing_team_id   uuid;
  v_adopt_role         text;
  v_team_adopted       boolean := false;
  v_season             text := public.current_season();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS DISTINCT FROM 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

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

  v_has_resp := public.school_has_responsable(v_club_id);

  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

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

  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

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

  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, v_club_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  IF p_team_id IS NOT NULL THEN
    v_team_id := p_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;

    -- FIX 1(b) : identique à la branche école — borne saison + tri season DESC.
    SELECT id INTO v_existing_team_id
    FROM public.teams
    WHERE school_id = v_club_id
      AND sport_id  = v_sport_id
      AND is_active = true
      AND season IS NOT NULL
      AND season >= v_season
      AND lower(btrim(COALESCE(age_group, ''))) = lower(btrim(COALESCE(p_team_age_group, '')))
      AND lower(btrim(COALESCE(gender,    ''))) = lower(btrim(COALESCE(p_team_gender,    '')))
      AND public._team_norm_division(division)
          IS NOT DISTINCT FROM public._team_norm_division(p_team_division)
    ORDER BY season DESC, created_at ASC
    LIMIT 1;

    IF v_existing_team_id IS NOT NULL THEN
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
      -- FIX 1(b) : season explicite.
      INSERT INTO public.teams (
        school_id, sport_id, name, age_group, gender, division, season, is_active
      ) VALUES (
        v_club_id,
        v_sport_id,
        TRIM(p_team_name),
        NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
        NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
        NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
        v_season,
        true
      )
      RETURNING id INTO v_team_id;
      v_team_created := true;
      INSERT INTO public.team_coaches (coach_id, team_id, role)
      VALUES (v_uid, v_team_id, 'head_coach')
      ON CONFLICT (team_id, coach_id) DO NOTHING;
    END IF;
  END IF;

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

  RETURN jsonb_build_object(
    'ok',                     true,
    'club_id',                v_club_id,
    'club_created',           v_club_created,
    'has_responsable_before', v_has_resp,
    'team_id',                v_team_id,
    'team_created',           v_team_created,
    'team_adopted',           v_team_adopted,
    'claim_created',          v_claim_created,
    'season',                 v_season
  );
END;
$function$;
