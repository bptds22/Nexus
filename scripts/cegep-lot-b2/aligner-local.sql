-- Lot B2 cégep — aligne la base jetable nexus_b2 sur la PROD pour les fonctions que les preuves exécutent.
-- Corps relevés en prod (pg_get_functiondef) le 2026-10-26 ; le md5 de chaque corps est vérifié à la fin.
-- LOCAL SEULEMENT. Les deux finish_coach_*_onboarding ne sont pas alignées : les preuves ne les exécutent pas
-- localement (voir docs/cegep-lot-b2/preuves-locales-*.txt).
\set ON_ERROR_STOP 1

CREATE OR REPLACE FUNCTION public.athlete_identity_ok(p_dob date, p_consent boolean)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT (p_dob IS NOT NULL AND p_dob <= current_date - INTERVAL '18 years')
      OR COALESCE(p_consent, false);
$function$
;

CREATE OR REPLACE FUNCTION public.ecole_ouverte_aux_coachs(p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  -- Vrai si un compte COACH peut s'y rattacher : pas d'école, une école SECONDAIRE ou un club
  -- LIGUE_CIVILE. Liste blanche : CEGEP — et tout type futur — est fermé.
  -- Un identifiant inconnu rend vrai : la clé étrangère refusera l'écriture elle-même.
  select not exists (
    select 1 from public.schools s
     where s.id = p_school_id
       and s.type::text not in ('SECONDAIRE', 'LIGUE_CIVILE')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.porte_coach_cegep()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_compte uuid;
  v_ecole  uuid;
  v_role   public.user_role;
begin
  -- On ne bloque que l'écriture qui FAIT ENTRER dans l'état interdit : une mise à jour qui ne
  -- touche pas la colonne de rattachement laisse passer une ligne existante telle quelle.
  case tg_table_name
    when 'users' then
      if tg_op = 'UPDATE' and old.role is not distinct from new.role
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.id;
      v_ecole  := new.school_id;
      v_role   := new.role;
    when 'school_coaches' then
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.coach_id;
      v_ecole  := new.school_id;
    when 'team_coaches' then
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id
         and old.team_id is not distinct from new.team_id then
        return new;
      end if;
      v_compte := new.coach_id;
      select t.school_id into v_ecole from public.teams t where t.id = new.team_id;
    when 'teams' then
      if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      -- Une équipe n'a pas de propriétaire : c'est l'APPELANT qui compte. Import RSEQ, service,
      -- admin et recruteur collégial ne sont pas des COACH.
      v_compte := auth.uid();
      v_ecole  := new.school_id;
    when 'admin_claims' then
      if tg_op = 'UPDATE' and old.user_id is not distinct from new.user_id
         and old.school_id is not distinct from new.school_id then
        return new;
      end if;
      v_compte := new.user_id;
      v_ecole  := new.school_id;
    when 'athletes' then
      -- Seul le geste du coach compte (création avec coach, réclamation, réassignation). Un
      -- changement d'école d'ancrage qui garde son coach n'est pas visé ici (nettoyage de l'été).
      if tg_op = 'UPDATE' and old.coach_id is not distinct from new.coach_id then
        return new;
      end if;
      v_compte := new.coach_id;
      v_ecole  := new.school_id;
    else
      raise exception 'NEXUS: porte_coach_cegep branchée sur une table inattendue (%)', tg_table_name;
  end case;

  if v_compte is null or v_ecole is null then
    return new;
  end if;
  if v_role is null then
    select u.role into v_role from public.users u where u.id = v_compte;
  end if;
  if v_role is distinct from 'COACH'::public.user_role then
    return new;
  end if;
  if public.ecole_ouverte_aux_coachs(v_ecole) then
    return new;
  end if;

  raise exception 'NEXUS_COACH_CEGEP: Un compte coach ne peut pas être rattaché à un cégep. La gestion des équipes collégiales arrive bientôt.'
    using errcode = 'P0001',
          detail  = format('table %s, opération %s', tg_table_name, tg_op),
          hint    = 'liste_attente_gestion_collegiale';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_team_join_token(p_code text)
 RETURNS TABLE(team_id uuid, team_name text, school_id uuid, school_name text, school_logo_url text, school_type text, sport_name text, season text, age_group text, division text, gender text, league text, is_valid boolean)
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
    RETURN;
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
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_transfer_token(p_token text)
 RETURNS TABLE(invitation_id uuid, team_id uuid, team_name text, school_id uuid, school_name text, school_type text, sport_name text, season text, age_group text, division text, gender text, league text, coach_name text, is_valid boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_token text := upper(btrim(coalesce(p_token, '')));
begin
  if length(v_token) < 6 or length(v_token) > 8 then
    return;
  end if;

  return query
  select
    ti.id,
    t.id,
    t.name,
    s.id,
    s.name,
    s.type::text,
    sp.nom,
    t.season,
    -- ORDRE STRICT : RETURNS TABLE mappe par POSITION, pas par nom.
    -- age_group, division, gender, league — toute permutation compilerait et
    -- sortirait des valeurs croisees a l'ecran, sans une seule erreur.
    t.age_group,
    t.division,
    t.gender,
    t.league,
    nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
    true
  from public.team_invitations ti
  join public.teams t   on t.id = ti.team_id
  left join public.schools s on s.id = t.school_id
  left join public.sports sp on sp.id = t.sport_id
  left join public.users  u  on u.id = ti.invited_by_coach_id
  where ti.transfer_token = v_token
    and ti.status = 'PENDING'
    -- PREMIER endroit de l'application qui honore expires_at. NULL = pas de
    -- limite, coherent avec le reste.
    and (ti.expires_at is null or ti.expires_at > now())
    -- LE CONTROLE QUI COMPTE : seul le destinataire voit quoi que ce soit.
    -- Un jeton qui fuit (journaux, Referer, courriel transfere) ne revele NI
    -- l'equipe, NI l'ecole, NI le coach a un tiers.
    and public.is_own_athlete(ti.athlete_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.teams_resync_athlete_sport_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.team_athletes SET sport_id = NEW.sport_id WHERE team_id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.user_has_pro(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  SELECT public.get_user_tier() IN ('pro', 'all_star');
$function$
;

CREATE OR REPLACE FUNCTION public._apply_team_attachment_core(p_athlete_id uuid, p_team_id uuid, p_confirm_transfer boolean)
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
  v_ctx          text;
  v_ctx_upd      boolean := false;
  v_age          int;
BEGIN
  SELECT a.id, a.user_id, a.date_naissance, a.coach_id, a.school_id,
         a.parcours_equipes, a.consentement_parental
    INTO v_athlete
  FROM public.athletes a
  WHERE a.id = p_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  IF v_athlete.date_naissance IS NULL THEN
    RAISE EXCEPTION 'DOB_REQUIRED';
  END IF;

  v_age := extract(year from age(v_athlete.date_naissance))::int;

  IF v_age < 14 THEN
    RAISE EXCEPTION 'ATHLETE_UNDER_14';
  END IF;

  IF v_age BETWEEN 14 AND 17
     AND NOT COALESCE(v_athlete.consentement_parental, false) THEN
    RAISE EXCEPTION 'PARENTAL_CONSENT_REQUIRED';
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
         s.type      AS school_type,
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
        'parcours_appended', false,
        'context_updated',   false
      );
    END IF;

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

  v_ctx := CASE v_target.school_type
             WHEN 'LIGUE_CIVILE' THEN 'ligue_civile'
             WHEN 'SECONDAIRE'   THEN 'scolaire'
             WHEN 'CEGEP'        THEN 'scolaire'
             ELSE NULL
           END;

  IF v_ctx IS NOT NULL AND v_athlete.user_id IS NOT NULL THEN
    UPDATE public.users
       SET context = v_ctx
     WHERE id = v_athlete.user_id
       AND context IS DISTINCT FROM v_ctx;
    GET DIAGNOSTICS v_ctx_upd = ROW_COUNT;
  END IF;

  INSERT INTO public.team_athletes (team_id, athlete_id)
  VALUES (p_team_id, v_athlete.id);

  RETURN jsonb_build_object(
    'athlete_id',        v_athlete.id,
    'team_id',           p_team_id,
    'transferred',       v_has_prev,
    'previous_team_id',  v_prev_team_id,
    'coach_id_updated',  v_coach_upd,
    'no_op',             false,
    'parcours_appended', v_appended,
    'context_updated',   v_ctx_upd
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public._team_norm_division(d text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN d IS NULL OR btrim(d) = ''      THEN NULL
    WHEN d ~* '^division\s*[1-4]$'       THEN 'D' || substring(d from '[1-4]')
    WHEN d ~* '^d[1-4]$'                 THEN upper(btrim(d))
    ELSE btrim(d)
  END
$function$
;

CREATE OR REPLACE FUNCTION public.current_season()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT CASE
    WHEN EXTRACT(MONTH FROM now()) >= 8
      THEN EXTRACT(YEAR FROM now())::int || '-' || (EXTRACT(YEAR FROM now())::int + 1)
    ELSE (EXTRACT(YEAR FROM now())::int - 1) || '-' || EXTRACT(YEAR FROM now())::int
  END
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_tier(uid uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  SELECT COALESCE(
    (SELECT tier FROM subscriptions
     WHERE user_id = auth.uid() AND status = 'active'
     ORDER BY created_at DESC LIMIT 1),
    'free'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_own_athlete(target_athlete uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists (select 1 from athletes a
                     where a.id = target_athlete and a.user_id = (select auth.uid())) $function$
;

CREATE OR REPLACE FUNCTION public.school_has_responsable(p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.admin_claims
      WHERE school_id  = p_school_id
        AND claim_type IN ('DIRECTEUR', 'INTERIM')
        AND status     = 'APPROVED'
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE school_id        = p_school_id
        AND is_school_admin  = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches
      WHERE school_id = p_school_id
        AND role IN ('DIRECTEUR'::public.coach_school_role,
                     'DIRECTEUR_INTERIM'::public.coach_school_role)
    );
$function$
;

-- Déclencheurs du lot B1, tels qu'en prod.
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.admin_claims;
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.athletes;
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.school_coaches;
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.team_coaches;
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.teams;
DROP TRIGGER IF EXISTS trg_porte_coach_cegep ON public.users;
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF school_id, user_id ON public.admin_claims FOR EACH ROW EXECUTE FUNCTION porte_coach_cegep();
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF coach_id ON public.athletes FOR EACH ROW WHEN (((new.coach_id IS NOT NULL) AND (new.school_id IS NOT NULL))) EXECUTE FUNCTION porte_coach_cegep();
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF school_id, coach_id ON public.school_coaches FOR EACH ROW EXECUTE FUNCTION porte_coach_cegep();
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF team_id, coach_id ON public.team_coaches FOR EACH ROW EXECUTE FUNCTION porte_coach_cegep();
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF school_id ON public.teams FOR EACH ROW WHEN ((new.school_id IS NOT NULL)) EXECUTE FUNCTION porte_coach_cegep();
CREATE TRIGGER trg_porte_coach_cegep BEFORE INSERT OR UPDATE OF role, school_id ON public.users FOR EACH ROW WHEN (((new.role = 'COACH'::user_role) AND (new.school_id IS NOT NULL))) EXECUTE FUNCTION porte_coach_cegep();

-- Contrôle : md5 de pg_get_functiondef = prod (relevé 2026-10-26, 10 premiers caractères).
select regexp_replace(p.oid::regprocedure::text, '^public[.]', '') as fonction,
       left(md5(pg_get_functiondef(p.oid)), 10) = attendu as conforme_prod
  from (values
    ('rseq_family_key(text,text,text)', '4ad0562e98'), ('resolve_transfer_token(text)', 'b1ef749bbd'),
    ('notify_team_invitation_email()', '265eb085ab'), ('teams_resync_athlete_sport_id()', '0d26fee980'),
    ('apercu_code_equipe(text)', 'c04d0bffdf'), ('processus_cartes(uuid,uuid,boolean)', '3cd475091e'),
    ('cartes_par_ids(uuid[])', 'cb757cd847'), ('rseq_creer_equipes_proposees(uuid[])', '3d4608b0a7'),
    ('_apply_team_attachment_core(uuid,uuid,boolean)', '2cee1fab6f'), ('resolve_team_join_token(text)', '5c6e06c9c1'),
    ('depistage_profils_match(uuid)', '01a05c483e'), ('porte_coach_cegep()', 'c87ae233c5'),
    ('rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)', '00766b1735'),
    ('matchs_suggestions(text,text,text[],text,text)', 'f514a17a73'),
    ('matchs_recherche(date,date,text,text[],text,uuid[],text[],boolean)', '82ac7e3aeb'),
    ('_team_norm_division(text)', '5cd36d2668'), ('current_season()', '97455ef0d9'),
    ('coach_nommable(uuid)', '5383af84c4'), ('is_own_athlete(uuid)', 'e0b3e6db58'),
    ('coachs_nommables_equipe(uuid)', 'fa7e738937'), ('is_admin()', '3d53607752'),
    ('user_has_pro(uuid)', 'aadf0af0e3'), ('athlete_identity_ok(date,boolean)', '7ac461dba1'),
    ('school_has_responsable(uuid)', '454a843827'), ('lieu_normalise(text)', '461e6e642e'),
    ('empreinte_courriel(text)', '70c4681269'), ('acces_carte_lecture(uuid,uuid)', '693b1c52c1'),
    ('ecole_ouverte_aux_coachs(uuid)', '1fa8f03615'), ('partenaire_admis()', '20e86f078a'),
    ('athlete_est_cegepien(uuid)', '64d1f6e988'), ('peut_voir_cegepiens()', 'bf3463481d'),
    ('get_user_tier(uuid)', '56d8846cf7'), ('acces_carte_ecriture(uuid,uuid)', '0d09de15e3'),
    ('unite_voit_cegepiens(uuid)', 'e6c978a071')) v(sig, attendu)
  join pg_proc p on p.oid = ('public.' || v.sig)::regprocedure
 order by conforme_prod, fonction;
