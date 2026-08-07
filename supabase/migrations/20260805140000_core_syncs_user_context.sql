-- ============================================================================
-- users.context aligné par _apply_team_attachment_core, à chaque rattachement.
--
-- LE TROU. users.context est écrit UNE FOIS au signup (écran « école » vs
-- « ligue civile ») par une RPC one-shot, set_initial_role_and_context, qui
-- REFUSE toute réécriture :
--     IF v_ctx IS NOT NULL THEN RAISE EXCEPTION 'CONTEXT_ALREADY_SET';
-- Résultat : dès que l'ancrage RÉEL diverge du choix fait au signup, plus rien
-- ne peut recoller. Deux chemins produisent cette divergence :
--   • l'onboarding code-first — l'athlète coche « école » au signup puis entre
--     un code d'équipe civile : l'ancrage devient civil, le contexte reste
--     scolaire (constaté sur l'athlète de test 2c592ed6) ;
--   • le tab Transfert — un transfert école → club civil réancre l'athlète
--     sans jamais toucher au contexte.
--
-- POURQUOI ICI. Même raisonnement que le gate Loi 25 <14 : _core est la PORTE
-- D'ÉCRITURE UNIQUE de l'ancrage. Tout ce qui doit rester vrai « quel que soit
-- le chemin » doit y vivre, sinon chaque nouvel appelant devra y penser — et
-- un jour n'y pensera pas. Corriger l'onboarding seul aurait laissé le tab
-- Transfert cassé ; corriger les deux aurait laissé le chemin invitation.
--
-- POURQUOI PAS CÔTÉ CLIENT. La policy « users update own » passe par
-- user_privileged_cols_unchanged(role, status, is_platform_admin, context,
-- is_school_admin) : un athlète NE PEUT PAS changer son propre context par un
-- UPDATE direct. Seule une fonction SECURITY DEFINER le peut. _core en est une.
--
-- ── LE TRIGGER EXISTANT, ET POURQUOI IL N'Y A PAS DE BOUCLE ────────────────
--   CREATE TRIGGER trg_sync_athlete_context
--     AFTER UPDATE OF context ON public.users
--     FOR EACH ROW WHEN (new.context IS DISTINCT FROM old.context)
--     EXECUTE FUNCTION sync_athlete_context();
--   -- corps : UPDATE public.athletes SET context = NEW.context
--   --         WHERE user_id = NEW.id;
--
-- Écrire users.context depuis _core le réveille, et il écrit athletes.context.
-- Ce n'est PAS une boucle : aucun des 10 triggers de `athletes` n'écrit dans
-- `users` (vérifié sur pg_trigger/pg_proc), la chaîne s'arrête donc au premier
-- rebond. Et ce n'est pas un double-write : le trigger ne touche QUE la colonne
-- context, alors que _core écrit school_id / coach_id / parcours_equipes.
--
-- L'UPDATE ci-dessous porte quand même `IS DISTINCT FROM` : sans lui, chaque
-- rattachement réécrirait la même valeur et ferait tourner le trigger pour
-- rien. Le WHEN du trigger l'aurait rattrapé, mais on ne fait pas dépendre la
-- propreté d'un garde-fou situé chez le voisin.
--
-- BONUS. athletes.context est NULL pour 8 athlètes : le trigger ne fire que sur
-- UPDATE de users, or le contexte est écrit au signup, AVANT que la ligne
-- athletes n'existe. Chaque rattachement recollera désormais les deux copies au
-- passage. Le backfill des lignes historiques est un choix séparé — voir le
-- bloc commenté en fin de fichier, volontairement NON exécuté.
--
-- ── MAPPING school.type → context ─────────────────────────────────────────
--   SECONDAIRE   → 'scolaire'
--   LIGUE_CIVILE → 'ligue_civile'
--   CEGEP        → 'scolaire'   ⚠ PAS 'collegial'
--
-- 'collegial' existe bien dans le CHECK de users.context, mais
-- set_initial_role_and_context impose la cohérence rôle/contexte :
--     (p_role = 'ATHLETE' AND p_context IN ('scolaire','ligue_civile'))
-- 'collegial' est le contexte du RECRUTEUR, pas celui d'un athlète. Un athlète
-- ancré dans un CÉGEP reste donc 'scolaire' — un CÉGEP est une école de son
-- point de vue. Mapper vers 'collegial' produirait un athlète que la propre
-- règle de cohérence de l'application considère comme invalide.
-- ============================================================================

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
  v_ctx          text;
  v_ctx_upd      boolean := false;
BEGIN
  SELECT a.id, a.user_id, a.date_naissance, a.coach_id, a.school_id, a.parcours_equipes
    INTO v_athlete
  FROM public.athletes a
  WHERE a.id = p_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

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

  -- ── ALIGNEMENT DU CONTEXTE ────────────────────────────────────────────────
  -- CEGEP → 'scolaire' et non 'collegial' : ce dernier est le contexte du
  -- RECRUTEUR (cf. la regle de coherence de set_initial_role_and_context).
  v_ctx := CASE v_target.school_type
             WHEN 'LIGUE_CIVILE' THEN 'ligue_civile'
             WHEN 'SECONDAIRE'   THEN 'scolaire'
             WHEN 'CEGEP'        THEN 'scolaire'
             ELSE NULL
           END;

  -- v_athlete.user_id NULL = athlete orphelin cree par un coach : aucun compte
  -- a aligner, l'UPDATE ne matche rien et c'est correct.
  IF v_ctx IS NOT NULL AND v_athlete.user_id IS NOT NULL THEN
    UPDATE public.users
       SET context = v_ctx
     WHERE id = v_athlete.user_id
       AND context IS DISTINCT FROM v_ctx;   -- n'ecrit que si ca change
    GET DIAGNOSTICS v_ctx_upd = ROW_COUNT;
    -- Le trigger trg_sync_athlete_context recopie ensuite dans
    -- athletes.context. Pas de boucle : aucun trigger d'athletes n'ecrit
    -- dans users.
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
$function$;

COMMENT ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) IS
  'Corps commun du rattachement d''equipe : gate Loi 25 <14 + trace parcours + '
  'DELETE de l''ancienne appartenance + ancrage ecrit APRES le trigger + regle '
  'coach_id a deux branches + alignement de users.context sur le type de '
  'l''organisation cible + INSERT. NE CONTROLE AUCUNE IDENTITE. Appele par '
  'apply_team_attachment et apply_team_invitation_acceptance.';


-- ── RECOLLAGE DES COPIES MANQUANTES ─────────────────────────────────────────
-- 8 athletes ont athletes.context NULL alors que users.context est renseigne :
-- le trigger a fire au signup, AVANT que leur ligne athletes n'existe, et rien
-- n'est jamais repasse. Aucun n'a de contexte FAUX — seule la copie manque.
--
-- Ils se recolleraient d'eux-memes au premier rattachement, mais la prod est
-- petite et on part propre. La direction est users → athletes, jamais
-- l'inverse : users.context est la source (c'est elle qui porte le CHECK et
-- que lisent les policies), athletes.context n'en est qu'un miroir de lecture.
UPDATE public.athletes a
   SET context = u.context
  FROM public.users u
 WHERE u.id = a.user_id
   AND a.context IS DISTINCT FROM u.context;
