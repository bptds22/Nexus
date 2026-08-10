-- ============================================================================
-- 20260810120000_loi25_gates_attachement_equipe.sql
--
-- LOT 1 SÉCURITÉ — défense serveur Loi 25 sur l'attachement d'équipe.
-- Correctif SERVEUR PUR : aucun changement front, l'app collecte déjà tout.
-- Vit partout sans rebuild natif.
--
-- ── LES DEUX FAILLES FERMÉES ────────────────────────────────────────────────
-- F-A  Aucun contrôle de consentement parental 14-17. Le client était le SEUL
--      gate : un appel RPC direct avec un JWT valide rattachait un mineur de
--      15 ans sans consentement.
-- F-B  Gate <14 conditionné à `date_naissance IS NOT NULL` — un compte sans
--      date de naissance passait au travers.
--
-- ── IMPACT RÉTROACTIF MESURÉ AVANT APPLICATION : ZÉRO ───────────────────────
--   · 14-17 attachés à une équipe : 5, TOUS avec consentement enregistré.
--   · Athlètes < 14 : aucun.
--   · date_naissance NULL : 8, tous des orphelins anonymisés « [supprimé] »
--     SANS compte utilisateur. apply_team_attachment résolvant l'athlète par
--     `user_id = auth.uid()`, aucun d'eux ne peut emprunter ce chemin.
--   Le gate DOB est donc de la défense en profondeur, pas une rupture.
--
-- ── LE NO-OP EST GATÉ, DÉLIBÉRÉMENT ────────────────────────────────────────
-- Les gates sont placés AVANT la lecture de l'ancrage existant : un athlète
-- 14-17 dont le consentement a été RETIRÉ ne peut pas « reconfirmer » son
-- rattachement. C'est l'esprit de la Loi 25 — un retrait doit être effectif.
--
-- ── HÉRITAGE GRATUIT ────────────────────────────────────────────────────────
-- apply_team_invitation_acceptance appelle ce même cœur : les trois gates s'y
-- appliquent sans la toucher. Les fonctions consume_invitation_token et
-- consume_athlete_invitation n'écrivent pas team_athletes — hors périmètre.
--
-- ── CE QUE CE LOT NE FERME PAS ──────────────────────────────────────────────
-- Le consentement reste AUTO-ATTRIBUABLE : la policy « athletes can update own
-- profile » n'a aucune restriction de colonne et aucun trigger ne garde
-- consentement_parental. Un athlète peut poser le drapeau sur lui-même. Ce gate
-- fait passer l'attaque de « aucun contrôle » à « il faut lever un drapeau »,
-- ce n'est PAS une preuve de consentement. La vraie infrastructure de preuve
-- (parental_consents : attestation, expiration, retrait, granularité) existe et
-- dort avec 0 ligne — chantier Loi 25 nommé, à part.
-- Les policies coach/directeur sur team_athletes ne bougent PAS : le coach qui
-- attache atteste humainement, et les gater demanderait de refactorer 4 sites
-- front vers le cœur. Lot séparé, assumé.
-- ============================================================================

-- ── 1. Le cœur, avec G1/G2/G3 ───────────────────────────────────────────────
-- Signature INCHANGÉE → CREATE OR REPLACE, pas de DROP, grants préservés.
-- Seuls changements vs la version précédente : `consentement_parental` ajouté
-- au SELECT, `v_age` déclarée, et le bloc de gates qui remplace l'ancien test
-- <14 permissif. Tout le reste du corps est repris à l'identique.
CREATE OR REPLACE FUNCTION public._apply_team_attachment_core(
  p_athlete_id uuid, p_team_id uuid, p_confirm_transfer boolean
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

  -- ══ GATES LOI 25 ══════════════════════════════════════════════════════════
  -- Placés AVANT la résolution de l'équipe : un refus d'âge ne doit pas
  -- divulguer qu'une équipe existe. Et avant la lecture de l'ancrage : le
  -- no-op est gaté (voir en-tête).

  -- G1 · date de naissance obligatoire. Remplace l'ancien `IS NOT NULL` qui
  --      laissait passer un compte sans DOB (F-B).
  IF v_athlete.date_naissance IS NULL THEN
    RAISE EXCEPTION 'DOB_REQUIRED';
  END IF;

  v_age := extract(year from age(v_athlete.date_naissance))::int;

  -- G2 · plancher Loi 25 : sous 14 ans, seul le titulaire de l'autorité
  --      parentale peut consentir — l'auto-inscription est refusée.
  IF v_age < 14 THEN
    RAISE EXCEPTION 'ATHLETE_UNDER_14';
  END IF;

  -- G3 · consentement parental 14-17 (F-A). Le client le collectait déjà ;
  --      désormais la base l'exige.
  IF v_age BETWEEN 14 AND 17
     AND NOT COALESCE(v_athlete.consentement_parental, false) THEN
    RAISE EXCEPTION 'PARENTAL_CONSENT_REQUIRED';
  END IF;
  -- ══════════════════════════════════════════════════════════════════════════

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

  -- CEGEP -> 'scolaire' et non 'collegial' : ce dernier est le contexte du
  -- RECRUTEUR (cf. regle de coherence de set_initial_role_and_context).
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
$function$;

COMMENT ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) IS
  'Cœur de l''attachement d''équipe. Gates Loi 25 en tête : DOB_REQUIRED, '
  'ATHLETE_UNDER_14, PARENTAL_CONSENT_REQUIRED (14-17). Gates appliqués AVANT '
  'la lecture de l''ancrage : le no-op est gaté, un retrait de consentement est '
  'effectif. Appelé par apply_team_attachment et apply_team_invitation_acceptance.';


-- ── 2. La porte de garage : self-assign athlète ─────────────────────────────
-- Cette policy laissait un athlète s'INSÉRER dans n'importe quelle équipe de
-- sa propre école par un POST direct sur team_athletes — donc en contournant
-- intégralement le cœur et ses trois gates. Sans ce DROP, le lot barre la
-- fenêtre et laisse la porte ouverte au MÊME acteur.
--
-- MORTE CÔTÉ FRONT, vérifié par grep exhaustif (app/ lib/ components/ hooks/,
-- web et mobile, y compris les anciens chemins) : les 6 sites d'écriture sur
-- team_athletes sont TOUS côté coach —
--   app/coach/athletes/_data/saveAthlete.ts:288 et :375
--   app/coach/equipes/[teamId]/PageClient.tsx:512 (insert) et :553 (delete)
--   components/shared/CoachEquipeDetailMobile.tsx:198 et :229
-- Le seul accès athlète direct est un SELECT d'affichage
-- (app/athlete/notifications/_components/PendingInvitations.tsx:138) ;
-- l'acceptation d'invitation passe par team_invitations puis le cœur.
-- Les surfaces athlète d'attachement passent toutes par la RPC
-- (lib/queries/athlete/teamAttachment.ts).
DROP POLICY IF EXISTS "Athletes self-assign to school team" ON public.team_athletes;

-- Les policies coach et directeur restent INTACTES, décision assumée :
--   « Coaches manage own team athletes »   (ALL)
--   « Directors manage school team athletes » (ALL)


-- ── 3. Deuxième étage sur les fonctions admin ───────────────────────────────
-- create/revoke portaient un GRANT à `authenticated` et ne se défendaient que
-- par leur garde interne `is_admin()`. Un seul étage. Zéro appel front
-- confirmé (aucune surface ne lit même team_join_tokens), donc le REVOKE ne
-- casse rien.
--
-- CONSÉQUENCE ASSUMÉE : le chantier « code d'équipe côté coach » devra passer
-- par une NOUVELLE RPC avec sa propre garde, pas par le recyclage de la
-- fonction admin. C'est une feature, pas un coût.
REVOKE EXECUTE ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_team_join_token(text) FROM authenticated;

-- Ceinture et bretelles sur les deux : PUBLIC et anon nominatif.
REVOKE ALL ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_team_join_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_team_join_token(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_team_join_token(text) TO service_role;
