-- ============================================================================
-- Détails d'équipe dans resolve_team_join_token et dans le DETAIL de transfert.
--
-- POURQUOI. Les listes d'équipes ne montraient que « nom · sport · saison ».
-- Deux « Dragons » d'une même école — Cadet D1 Masculin et Juvénile D2 Féminin
-- — étaient indistinguables : l'athlète choisissait au hasard. La base porte
-- pourtant age_group, division, gender et league.
--
-- CE QUI OBLIGEAIT À PASSER PAR LE SQL. Deux surfaces ne peuvent PAS aller
-- chercher ces colonnes elles-mêmes :
--   • la page /join est ANONYME, et les trois policies « discoverable » de
--     `teams` sont toutes TO authenticated — anon ne lit pas `teams` ;
--   • la modale de confirmation de transfert est alimentée par le JSON DETAIL
--     construit DANS _apply_team_attachment_core, pas par une requête client.
-- D'où cette migration plutôt qu'un SELECT de plus côté React.
--
-- BONUS school_type. resolve renvoie désormais le type de l'organisation, ce
-- qui évite à l'onboarding un aller-retour sur `schools` juste pour savoir
-- s'il doit basculer en contexte scolaire ou ligue civile.
--
-- ── ATTENTION : DROP + CREATE, PAS CREATE OR REPLACE ────────────────────────
-- Changer le RETURNS TABLE d'une fonction est interdit à CREATE OR REPLACE
-- (« cannot change return type of existing function »). Il faut donc la
-- DÉTRUIRE puis la recréer — et une fonction recréée repart avec les droits
-- PAR DÉFAUT : EXECUTE à PUBLIC (Postgres) plus les GRANTs nominatifs de
-- Supabase (ALTER DEFAULT PRIVILEGES). Les GRANTs sont donc REPOSÉS
-- explicitement plus bas, dans la MÊME transaction que le DROP : à aucun
-- instant visible la fonction n'existe avec des droits non maîtrisés.
-- ============================================================================

DROP FUNCTION IF EXISTS public.resolve_team_join_token(text);

CREATE FUNCTION public.resolve_team_join_token(p_code text)
RETURNS TABLE(
  team_id         uuid,
  team_name       text,
  school_id       uuid,
  school_name     text,
  school_logo_url text,
  school_type     text,     -- SECONDAIRE | CEGEP | LIGUE_CIVILE
  sport_name      text,
  season          text,
  age_group       text,
  division        text,
  gender          text,
  league          text,
  is_valid        boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_tok   record;
  v_ctx   record;
  v_valid boolean;
BEGIN
  SELECT * INTO v_tok
  FROM public.team_join_tokens
  WHERE code = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;                              -- code inexistant → aucune row
  END IF;

  SELECT t.id             AS t_id,
         t.name           AS t_name,
         t.season         AS t_season,
         t.age_group      AS t_age,
         t.division       AS t_div,
         t.gender         AS t_gender,
         t.league         AS t_league,
         COALESCE(t.is_active, true) AS t_active,
         s.id             AS s_id,
         s.name           AS s_name,
         s.logo_url       AS s_logo,
         s.type           AS s_type,
         sp.nom           AS sp_name
    INTO v_ctx
  FROM public.teams t
  JOIN public.schools s  ON s.id  = t.school_id
  JOIN public.sports  sp ON sp.id = t.sport_id
  WHERE t.id = v_tok.team_id;

  v_valid := v_tok.revoked_at IS NULL
         AND (v_tok.expires_at IS NULL OR v_tok.expires_at > now())
         AND (v_tok.max_uses   IS NULL OR v_tok.use_count < v_tok.max_uses)
         AND COALESCE(v_ctx.t_active, false);

  -- Masquage : quand le code est invalide, TOUT est NULL sauf is_valid — y
  -- compris les champs ajoutes par cette migration. Un code expire ne doit pas
  -- continuer a renseigner la division ou le genre de l'equipe.
  RETURN QUERY SELECT
    CASE WHEN v_valid THEN v_ctx.t_id      ELSE NULL::uuid END,
    CASE WHEN v_valid THEN v_ctx.t_name    ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.s_id      ELSE NULL::uuid END,
    CASE WHEN v_valid THEN v_ctx.s_name    ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.s_logo    ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.s_type    ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.sp_name   ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_season  ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_age     ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_div     ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_gender  ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_league  ELSE NULL::text END,
    v_valid;
END;
$function$;

-- GRANTs REPOSÉS À L'IDENTIQUE de la phase 1 : PUBLIC révoqué (sinon le
-- droit par défaut de Postgres subsiste), puis les trois rôles nommés.
REVOKE ALL ON FUNCTION public.resolve_team_join_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_team_join_token(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_team_join_token(text) IS
  'Lecture publique d''un code d''adhesion : nomme l''equipe derriere le code, '
  'avec ses details discriminants (categorie, division, genre, ligue) et le '
  'type de l''organisation. Aucune row si le code n''existe pas ; TOUS les '
  'champs a NULL si le code existe mais est invalide. N''expose jamais le '
  'quota, l''expiration ni le createur.';


-- ── DETAIL du transfert : mêmes détails, des deux côtés ─────────────────────
-- Signature inchangée → CREATE OR REPLACE, les droits survivent. Seuls les
-- deux SELECT (v_prev, v_target) et le jsonb du DETAIL changent : age_group et
-- gender n'étaient pas lus, division et league l'étaient déjà mais ne
-- sortaient pas dans le DETAIL.
CREATE OR REPLACE FUNCTION public._apply_team_attachment_core(
  p_athlete_id       uuid,
  p_team_id          uuid,
  p_confirm_transfer boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_athlete      record;
  v_target       record;
  v_prev_id      uuid;
  v_prev         record;
  v_prev_team_id uuid;
  v_has_prev     boolean := false;
  v_entry        jsonb;
  v_parcours     jsonb   := NULL;
  v_appended     boolean := false;
  v_new_coach    uuid;
  v_coach_upd    boolean := false;
  v_year_start   int;
  v_year_end     int;
  v_evict_ord    int;
BEGIN
  SELECT a.id, a.date_naissance, a.coach_id, a.school_id, a.parcours_equipes
    INTO v_athlete
  FROM public.athletes a
  WHERE a.id = p_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  -- Loi 25 : le gate vit ICI, seule porte d'ecriture de l'ancrage. Couvre donc
  -- AUSSI le chemin invitation. Ne bloque pas l'ajout par un coach (INSERT
  -- direct hors de cette fonction) : la, c'est l'adulte responsable qui agit.
  IF v_athlete.date_naissance IS NOT NULL
     AND extract(year from age(v_athlete.date_naissance))::int < 14 THEN
    RAISE EXCEPTION 'ATHLETE_UNDER_14';
  END IF;

  SELECT t.id        AS id,
         t.name      AS name,
         t.school_id AS school_id,
         t.season    AS season,
         t.league    AS league,
         t.division  AS division,
         t.age_group AS age_group,
         t.gender    AS gender,
         COALESCE(t.is_active, true) AS is_active,
         s.name      AS school_name,
         sp.nom      AS sport_name
    INTO v_target
  FROM public.teams t
  JOIN public.schools s  ON s.id  = t.school_id
  JOIN public.sports  sp ON sp.id = t.sport_id
  WHERE t.id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND';
  END IF;
  IF NOT v_target.is_active THEN
    RAISE EXCEPTION 'TEAM_INACTIVE';
  END IF;

  SELECT ta.id INTO v_prev_id
  FROM public.team_athletes ta
  WHERE ta.athlete_id = v_athlete.id
  FOR UPDATE;
  v_has_prev := FOUND;

  IF v_has_prev THEN
    SELECT ta.team_id   AS team_id,
           t.name       AS team_name,
           t.season     AS season,
           t.league     AS league,
           t.division   AS division,
           t.age_group  AS age_group,
           t.gender     AS gender,
           s.name       AS school_name,
           sp.nom       AS sport_name
      INTO v_prev
    FROM public.team_athletes ta
    JOIN public.teams t     ON t.id  = ta.team_id
    LEFT JOIN public.schools s  ON s.id  = t.school_id
    LEFT JOIN public.sports  sp ON sp.id = t.sport_id
    WHERE ta.id = v_prev_id;

    v_prev_team_id := v_prev.team_id;

    IF v_prev.team_id = p_team_id THEN
      RETURN jsonb_build_object(
        'athlete_id',        v_athlete.id,
        'team_id',           p_team_id,
        'transferred',       false,
        'previous_team_id',  p_team_id,
        'coach_id_updated',  false,
        'no_op',             true,
        'parcours_appended', false
      );
    END IF;

    -- L'ecran de confirmation est impose par le SERVEUR. Le DETAIL porte
    -- desormais de quoi DECRIRE les deux equipes, pas seulement les nommer :
    -- « Dragons » → « Dragons » ne dit rien a l'athlete, « Dragons Cadet D1
    -- Masculin » → « Dragons Juvenile D2 Feminin » lui dit tout.
    IF NOT p_confirm_transfer THEN
      RAISE EXCEPTION 'TRANSFER_REQUIRES_CONFIRMATION: % (%)',
        COALESCE(v_prev.team_name, '?'),
        COALESCE(v_prev.school_name, '?')
      USING
        ERRCODE = 'P0001',
        DETAIL  = jsonb_build_object(
                    'previous_team_id',     v_prev.team_id,
                    'previous_team_name',   v_prev.team_name,
                    'previous_school_name', v_prev.school_name,
                    'previous_sport',       v_prev.sport_name,
                    'previous_season',      v_prev.season,
                    'previous_age_group',   v_prev.age_group,
                    'previous_division',    v_prev.division,
                    'previous_gender',      v_prev.gender,
                    'previous_league',      v_prev.league,
                    'target_team_id',       p_team_id,
                    'target_team_name',     v_target.name,
                    'target_school_name',   v_target.school_name,
                    'target_sport',         v_target.sport_name,
                    'target_season',        v_target.season,
                    'target_age_group',     v_target.age_group,
                    'target_division',      v_target.division,
                    'target_gender',        v_target.gender,
                    'target_league',        v_target.league
                  )::text,
        HINT    = 'Rappeler apply_team_attachment avec p_confirm_transfer => true.';
    END IF;

    v_year_start := NULLIF(substring(COALESCE(v_prev.season, '') from '^(\d{4})'), '')::int;
    v_year_end   := NULLIF(substring(COALESCE(v_prev.season, '') from '(\d{4})$'), '')::int;
    IF v_year_start IS NULL THEN v_year_start := extract(year from now())::int; END IF;
    IF v_year_end   IS NULL THEN v_year_end   := extract(year from now())::int; END IF;

    v_entry := jsonb_build_object(
      'source',      'system',
      'team_id',     v_prev.team_id,
      'team_name',   COALESCE(v_prev.team_name, ''),
      'school_name', COALESCE(v_prev.school_name, ''),
      'sport',       COALESCE(v_prev.sport_name, ''),
      'season',      v_prev.season,
      'coach_id',    v_athlete.coach_id,
      'left_at',     to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'ligue',       COALESCE(v_prev.league, ''),
      'division',    COALESCE(v_prev.division, ''),
      'year_start',  v_year_start,
      'year_end',    v_year_end
    );

    v_parcours := COALESCE(v_athlete.parcours_equipes, '[]'::jsonb);
    IF jsonb_typeof(v_parcours) <> 'array' THEN
      v_parcours := '[]'::jsonb;
    END IF;

    IF jsonb_array_length(v_parcours) >= 10 THEN
      SELECT e.ord INTO v_evict_ord
      FROM jsonb_array_elements(v_parcours) WITH ORDINALITY AS e(val, ord)
      WHERE e.val->>'source' = 'system'
      ORDER BY (e.val->>'left_at') ASC NULLS FIRST, e.ord ASC
      LIMIT 1;

      IF v_evict_ord IS NOT NULL THEN
        v_parcours := (v_parcours - (v_evict_ord - 1)) || jsonb_build_array(v_entry);
        v_appended := true;
      END IF;
    ELSE
      v_parcours := v_parcours || jsonb_build_array(v_entry);
      v_appended := true;
    END IF;

    DELETE FROM public.team_athletes WHERE id = v_prev_id;
  END IF;

  SELECT tc.coach_id INTO v_new_coach
  FROM public.team_coaches tc
  WHERE tc.team_id = p_team_id
  ORDER BY (COALESCE(tc.role, '') = 'head_coach') DESC,
           tc.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_new_coach IS NOT NULL THEN
    v_coach_upd := (v_athlete.coach_id IS DISTINCT FROM v_new_coach);
  ELSE
    v_new_coach := v_athlete.coach_id;
  END IF;

  UPDATE public.athletes
     SET school_id        = v_target.school_id,
         coach_id         = v_new_coach,
         parcours_equipes = COALESCE(v_parcours, parcours_equipes)
   WHERE id = v_athlete.id;

  INSERT INTO public.team_athletes (team_id, athlete_id)
  VALUES (p_team_id, v_athlete.id);

  RETURN jsonb_build_object(
    'athlete_id',        v_athlete.id,
    'team_id',           p_team_id,
    'transferred',       v_has_prev,
    'previous_team_id',  v_prev_team_id,
    'coach_id_updated',  v_coach_upd,
    'no_op',             false,
    'parcours_appended', v_appended
  );
END;
$function$;
