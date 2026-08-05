-- ============================================================================
-- M3 — Fonctions du transfer portal (phase 1)
--
--   _gen_join_code            (helper interne, aucun droit public)
--   create_team_join_token    admin — crée un code
--   revoke_team_join_token    admin — brûle un code
--   resolve_team_join_token   anon + authenticated — « c'est quelle équipe ? »
--   apply_team_attachment     authenticated + service_role — LE rattachement
--
-- apply_team_attachment est la SEULE porte d'écriture sur l'ancrage. Le join
-- code et l'onglet « Transfert » y entrent tous les deux : le code ne fait
-- qu'apporter la preuve qu'on a le droit de désigner l'équipe cible. Un seul
-- corps ⇒ une seule séquence de transfert à raisonner, à tester et à corriger.
--
-- ── SÉQUENCE ET NEUTRALISATION DU TRIGGER ───────────────────────────────────
-- Le DELETE de l'ancienne appartenance réveille le trigger AFTER DELETE
-- public.reset_athlete_anchor_on_team_remove(), dont le corps exact est :
--   • school de la team supprimée de type SECONDAIRE / CEGEP → RETURN, il ne
--     touche à rien ;
--   • school de type LIGUE_CIVILE → si l'athlète n'a plus d'autre équipe
--     civile, il fait `UPDATE athletes SET school_id = NULL WHERE id = OLD.
--     athlete_id AND school_id = <school de la team supprimée>` ; sinon il
--     repointe school_id vers la plus récente des autres équipes civiles.
-- Autrement dit : sur un transfert QUITTANT un club civil, le trigger peut
-- écraser school_id juste après notre DELETE.
--
-- La fonction est donc séquencée ainsi, et l'ordre n'est pas négociable :
--   1) LIRE l'ancienne appartenance (avant toute écriture),
--   2) DELETE team_athletes            → le trigger fait ce qu'il veut,
--   3) UPDATE athletes (school_id, coach_id, parcours) ← APRÈS le trigger,
--   4) INSERT team_athletes de la cible.
-- Le trigger est AFTER ROW non déferré : il a fini avant que l'instruction (2)
-- ne rende la main, donc (3) écrit toujours en dernier. L'ancrage final est
-- TOUJOURS celui de l'équipe cible, quel que soit le type de l'ancienne école.
--
-- ── MESSAGES D'ERREUR ───────────────────────────────────────────────────────
-- Les RAISE de ces fonctions sont des SENTINELLES PROTOCOLAIRES (majuscules,
-- sans accent), pas du texte d'écran : elles suivent la convention déjà en
-- place dans create_athlete_invitation (NOT_AUTHENTICATED, ATHLETE_UNDER_14…).
-- Elles ne portent donc PAS le marqueur « NEXUS: » de
-- 20260731200000_raise_marqueur_nexus.sql — ce marqueur est réservé aux
-- messages rédigés POUR l'utilisateur. La phase 2 traduit chaque sentinelle en
-- français côté client, comme le fait déjà le flux d'invitation.
-- TRANSFER_REQUIRES_CONFIRMATION transporte en plus l'ancienne équipe / école
-- dans le message ET un JSON exploitable dans DETAIL (lisible côté client via
-- error.details), pour que l'écran de confirmation soit imposé par le SERVEUR
-- et pas seulement par l'UI.
-- ============================================================================

-- ── Helper : génération d'un code sans ambiguïté ────────────────────────────
-- Tirage cryptographique (pgcrypto vit dans le schéma `extensions`, d'où la
-- qualification explicite : le search_path de ces fonctions est 'public').
-- Rejet des octets >= 248 : 248 = 8 x 31, le plus grand multiple de la taille
-- de l'alphabet sous 256. Sans ce rejet, les 8 premiers caractères sortiraient
-- légèrement plus souvent que les 23 autres.
CREATE OR REPLACE FUNCTION public._gen_join_code(p_len int DEFAULT 8)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $function$
DECLARE
  c_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  -- 31 chars
  c_n        constant int  := 31;
  c_max      constant int  := 248;
  v_out  text := '';
  v_byte int;
BEGIN
  IF p_len < 6 OR p_len > 8 THEN
    RAISE EXCEPTION 'JOIN_CODE_BAD_LENGTH';
  END IF;

  WHILE length(v_out) < p_len LOOP
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    IF v_byte < c_max THEN
      v_out := v_out || substr(c_alphabet, 1 + (v_byte % c_n), 1);
    END IF;
  END LOOP;

  RETURN v_out;
END;
$function$;

REVOKE ALL ON FUNCTION public._gen_join_code(int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._gen_join_code(int) FROM anon;
REVOKE ALL ON FUNCTION public._gen_join_code(int) FROM authenticated;

COMMENT ON FUNCTION public._gen_join_code(int) IS
  'Helper interne : code d''adhesion aleatoire, alphabet 2-9 A-Z sans I/L/O, '
  'tirage pgcrypto avec rejet du biais modulo. Aucun droit EXECUTE accorde — '
  'appele uniquement depuis create_team_join_token (SECURITY DEFINER).';


-- ── create_team_join_token — ADMIN ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_team_join_token(
  p_team_id    uuid,
  p_expires_at timestamptz DEFAULT NULL,
  p_max_uses   int         DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_code   text;
  v_try    int  := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id) THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND';
  END IF;
  IF p_max_uses IS NOT NULL AND p_max_uses < 1 THEN
    RAISE EXCEPTION 'INVALID_MAX_USES';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'INVALID_EXPIRES_AT';
  END IF;

  -- Retry sur collision : l'espace est immense, mais on ne parie pas dessus.
  LOOP
    v_try  := v_try + 1;
    v_code := public._gen_join_code(8);
    BEGIN
      INSERT INTO public.team_join_tokens (team_id, code, created_by, expires_at, max_uses)
      VALUES (p_team_id, v_code, v_caller, p_expires_at, p_max_uses);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 10 THEN
        RAISE EXCEPTION 'JOIN_CODE_GENERATION_FAILED';
      END IF;
    END;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_team_join_token(uuid, timestamptz, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.create_team_join_token(uuid, timestamptz, int) IS
  'ADMIN uniquement (is_admin()). Cree un code d''adhesion pour une equipe et '
  'le retourne. p_expires_at NULL = sans expiration, p_max_uses NULL = '
  'illimite.';


-- ── revoke_team_join_token — ADMIN ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_team_join_token(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_found  int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;

  -- Idempotent : revoked_at n'est pose que la premiere fois, mais un second
  -- appel ne leve pas — la revocation d'un code deja brule est un succes.
  UPDATE public.team_join_tokens
     SET revoked_at = COALESCE(revoked_at, now())
   WHERE code = upper(btrim(p_code));

  GET DIAGNOSTICS v_found = ROW_COUNT;
  IF v_found = 0 THEN
    RAISE EXCEPTION 'JOIN_CODE_NOT_FOUND';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_team_join_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_team_join_token(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_team_join_token(text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.revoke_team_join_token(text) IS
  'ADMIN uniquement (is_admin()). Pose revoked_at. Jamais de DELETE : la ligne '
  'reste comme trace d''audit.';


-- ── resolve_team_join_token — anon + authenticated ──────────────────────────
-- Modele : public.resolve_athlete_invitation.
--   • code inexistant           → AUCUNE row (pas d'oracle d'enumeration) ;
--   • code existant mais invalide → une row, is_valid = false, TOUS les
--     details a NULL. Un code expire ne doit pas continuer a nommer l'ecole.
CREATE OR REPLACE FUNCTION public.resolve_team_join_token(p_code text)
RETURNS TABLE(
  team_id         uuid,
  team_name       text,
  school_id       uuid,
  school_name     text,
  school_logo_url text,
  sport_name      text,
  season          text,
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
         COALESCE(t.is_active, true) AS t_active,
         s.id             AS s_id,
         s.name           AS s_name,
         s.logo_url       AS s_logo,
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
    CASE WHEN v_valid THEN v_ctx.t_id    ELSE NULL::uuid END,
    CASE WHEN v_valid THEN v_ctx.t_name  ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.s_id    ELSE NULL::uuid END,
    CASE WHEN v_valid THEN v_ctx.s_name  ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.s_logo  ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.sp_name ELSE NULL::text END,
    CASE WHEN v_valid THEN v_ctx.t_season ELSE NULL::text END,
    v_valid;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_team_join_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_team_join_token(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.resolve_team_join_token(text) IS
  'Lecture publique d''un code d''adhesion : nomme l''equipe derriere le code. '
  'Aucune row si le code n''existe pas ; tous les details a NULL si le code '
  'existe mais est invalide (revoque / expire / quota atteint / equipe '
  'inactive). N''expose jamais le quota, l''expiration ni le createur.';


-- ── apply_team_attachment — LE rattachement ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_team_attachment(
  p_team_id          uuid,
  p_join_code        text    DEFAULT NULL,
  p_confirm_transfer boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_athlete      record;
  v_target       record;
  v_tok          record;
  v_has_tok      boolean := false;
  v_prev_id      uuid;
  v_prev         record;
  v_prev_team_id uuid;                 -- copie scalaire : v_prev n'est PAS
                                       -- assigne quand l'athlete n'a aucune
                                       -- appartenance, et plpgsql leve
                                       -- « record is not assigned yet » des
                                       -- qu'une expression en LIT un champ,
                                       -- meme sous un CASE non pris.
  v_has_prev     boolean := false;
  v_entry        jsonb;
  v_parcours     jsonb   := NULL;      -- NULL = ne pas toucher la colonne
  v_appended     boolean := false;
  v_new_coach    uuid;
  v_coach_upd    boolean := false;
  v_year_start   int;
  v_year_end     int;
  v_evict_ord    int;
BEGIN
  -- ── 1. GUARD STRICT ───────────────────────────────────────────────────────
  -- Forme DURE, volontairement differente du « auth.uid() IS NOT NULL AND … »
  -- permissif des consume_* : ici, pas de session = pas d'appel. Il n'existe
  -- aucun chemin ou un appelant anonyme doit pouvoir rattacher qui que ce soit.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT a.id, a.date_naissance, a.coach_id, a.school_id, a.parcours_equipes
    INTO v_athlete
  FROM public.athletes a
  WHERE a.user_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  -- ── 2. Loi 25 — moins de 14 ans : jamais de rattachement self-service ─────
  -- Meme gate que create_athlete_invitation. DOB inconnue = on ne bloque pas
  -- (le consentement parental est verifie ailleurs dans le parcours).
  IF v_athlete.date_naissance IS NOT NULL
     AND extract(year from age(v_athlete.date_naissance))::int < 14 THEN
    RAISE EXCEPTION 'ATHLETE_UNDER_14';
  END IF;

  -- ── 3. Equipe cible ───────────────────────────────────────────────────────
  SELECT t.id        AS id,
         t.name      AS name,
         t.school_id AS school_id,
         t.season    AS season,
         t.league    AS league,
         t.division  AS division,
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

  -- ── 3bis. Join code, s'il y en a un ──────────────────────────────────────
  -- FOR UPDATE : le quota (use_count vs max_uses) est la seule vraie course de
  -- cette fonction. Deux athletes qui scannent le dernier usage disponible en
  -- meme temps doivent se serialiser ici, pas se retrouver tous les deux dans
  -- l'equipe. L'increment n'a lieu qu'a la toute fin, une fois le rattachement
  -- REELLEMENT ecrit — un no-op idempotent ne brule pas d'utilisation.
  IF p_join_code IS NOT NULL AND btrim(p_join_code) <> '' THEN
    SELECT * INTO v_tok
    FROM public.team_join_tokens
    WHERE code = upper(btrim(p_join_code))
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'JOIN_CODE_NOT_FOUND';
    END IF;
    v_has_tok := true;

    IF v_tok.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'JOIN_CODE_REVOKED';
    END IF;
    IF v_tok.expires_at IS NOT NULL AND v_tok.expires_at <= now() THEN
      RAISE EXCEPTION 'JOIN_CODE_EXPIRED';
    END IF;
    IF v_tok.max_uses IS NOT NULL AND v_tok.use_count >= v_tok.max_uses THEN
      RAISE EXCEPTION 'JOIN_CODE_EXHAUSTED';
    END IF;
    IF v_tok.team_id <> p_team_id THEN
      RAISE EXCEPTION 'JOIN_CODE_TEAM_MISMATCH';
    END IF;
  END IF;

  -- ── 4. Appartenance actuelle ─────────────────────────────────────────────
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
           s.name       AS school_name,
           sp.nom       AS sport_name
      INTO v_prev
    FROM public.team_athletes ta
    JOIN public.teams t     ON t.id  = ta.team_id
    LEFT JOIN public.schools s  ON s.id  = t.school_id
    LEFT JOIN public.sports  sp ON sp.id = t.sport_id
    WHERE ta.id = v_prev_id;

    v_prev_team_id := v_prev.team_id;

    -- Idempotence : deja sur l'equipe cible → on ne touche a RIEN (ni
    -- parcours, ni coach_id, ni quota du code) et on le signale.
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

    -- ── Ecran de confirmation impose par le SERVEUR ───────────────────────
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
                    'target_team_id',       p_team_id,
                    'target_team_name',     v_target.name,
                    'target_school_name',   v_target.school_name
                  )::text,
        HINT    = 'Rappeler apply_team_attachment avec p_confirm_transfer => true.';
    END IF;

    -- ── Entree systeme dans parcours_equipes ──────────────────────────────
    -- year_start / year_end / ligue / division ne sont PAS decoratifs : le
    -- lecteur cote client (parseTeamHistory + TeamHistoryBlock) traite
    -- year_end NULL comme « equipe ACTUELLE » (bague rouge + pastille
    -- « Actif »). Une entree systeme sans annees s'afficherait donc comme
    -- l'equipe courante de l'athlete — exactement le contraire de ce qu'elle
    -- raconte. Les annees sont derivees de la saison « AAAA-AAAA ».
    v_year_start := NULLIF(substring(COALESCE(v_prev.season, '') from '^(\d{4})'), '')::int;
    v_year_end   := NULLIF(substring(COALESCE(v_prev.season, '') from '(\d{4})$'), '')::int;
    IF v_year_start IS NULL THEN v_year_start := extract(year from now())::int; END IF;
    IF v_year_end   IS NULL THEN v_year_end   := extract(year from now())::int; END IF;

    v_entry := jsonb_build_object(
      -- charge utile systeme
      'source',      'system',
      'team_id',     v_prev.team_id,
      'team_name',   COALESCE(v_prev.team_name, ''),
      'school_name', COALESCE(v_prev.school_name, ''),
      'sport',       COALESCE(v_prev.sport_name, ''),
      'season',      v_prev.season,
      'coach_id',    v_athlete.coach_id,
      -- ISO-8601 UTC a format FIXE, pas `now()` brut : rendu tel quel,
      -- timestamptz porte le decalage de la session (« +00:00 », « -04:00 »),
      -- et le tri TEXTE de l'eviction plus bas cesserait d'etre chronologique
      -- des que deux transferts sont ecrits sous deux TimeZone differents.
      'left_at',     to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      -- cles d'affichage attendues par le lecteur existant
      'ligue',       COALESCE(v_prev.league, ''),
      'division',    COALESCE(v_prev.division, ''),
      'year_start',  v_year_start,
      'year_end',    v_year_end
    );

    v_parcours := COALESCE(v_athlete.parcours_equipes, '[]'::jsonb);
    IF jsonb_typeof(v_parcours) <> 'array' THEN
      v_parcours := '[]'::jsonb;
    END IF;

    -- Plafond 10 (CHECK athletes_parcours_equipes_shape). On evince la PLUS
    -- VIEILLE entree SYSTEME. S'il n'y en a aucune — les 10 lignes sont des
    -- saisies manuelles de l'athlete — on N'ECRASE RIEN : le transfert se fait
    -- quand meme, et parcours_appended=false le dit a l'appelant. Detruire une
    -- saisie manuelle pour loger une trace automatique serait le mauvais
    -- arbitrage, et ce serait irreversible.
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

    -- ── DELETE : reveille reset_athlete_anchor_on_team_remove ─────────────
    -- Sur une ancienne equipe LIGUE_CIVILE, le trigger peut nuller ou
    -- repointer athletes.school_id juste apres. C'est sans consequence : le
    -- UPDATE d'ancrage ci-dessous s'execute APRES et ecrase sans condition.
    DELETE FROM public.team_athletes WHERE id = v_prev_id;
  END IF;

  -- ── 5 + 6. Ancrage final — TOUJOURS apres le DELETE ──────────────────────
  -- Regle coach_id a deux branches :
  --   • l'equipe cible a au moins un coach → coach_id est REECRIT vers son
  --     head_coach ; s'il n'y a pas de head_coach, vers le plus ancien
  --     created_at de team_coaches ;
  --   • l'equipe cible n'a AUCUN coach → coach_id est PRESERVE tel quel.
  -- COALESCE(role,'') plutot que role = 'head_coach' : role est nullable, et
  -- « NULL = 'head_coach' » vaut NULL, que ORDER BY … DESC placerait EN TETE
  -- (NULLS FIRST par defaut en DESC) — un assistant sans role passerait devant
  -- le head coach.
  SELECT tc.coach_id INTO v_new_coach
  FROM public.team_coaches tc
  WHERE tc.team_id = p_team_id
  ORDER BY (COALESCE(tc.role, '') = 'head_coach') DESC,
           tc.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_new_coach IS NOT NULL THEN
    v_coach_upd := (v_athlete.coach_id IS DISTINCT FROM v_new_coach);
  ELSE
    v_new_coach := v_athlete.coach_id;          -- preservation
  END IF;

  UPDATE public.athletes
     SET school_id        = v_target.school_id,
         coach_id         = v_new_coach,
         parcours_equipes = COALESCE(v_parcours, parcours_equipes)
   WHERE id = v_athlete.id;

  -- ── 7. Nouvelle appartenance (le trigger BEFORE remplit sport_id) ────────
  INSERT INTO public.team_athletes (team_id, athlete_id)
  VALUES (p_team_id, v_athlete.id);

  -- ── Quota du code : consomme seulement maintenant ────────────────────────
  IF v_has_tok THEN
    UPDATE public.team_join_tokens
       SET use_count = use_count + 1
     WHERE id = v_tok.id;
  END IF;

  -- ── 8. Retour ────────────────────────────────────────────────────────────
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

-- ── GRANTs : ferme a anon, ouvert a authenticated + service_role ────────────
-- REVOKE sur PUBLIC *et* sur anon : Supabase accorde EXECUTE a anon par
-- ALTER DEFAULT PRIVILEGES, ce qui produit un droit NOMMATIF que revoquer
-- PUBLIC seul ne retirerait pas.
REVOKE ALL ON FUNCTION public.apply_team_attachment(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_team_attachment(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_team_attachment(uuid, text, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_team_attachment(uuid, text, boolean) IS
  'LA fonction de rattachement d''equipe (join code ET onglet Transfert). '
  'Ancrage unique strict : l''ancienne appartenance part dans '
  'athletes.parcours_equipes (entree source=system) puis est supprimee, et '
  'l''ancrage de l''equipe cible est ecrit APRES le DELETE — donc apres le '
  'trigger reset_athlete_anchor_on_team_remove. Sans p_confirm_transfer, un '
  'changement d''equipe leve TRANSFER_REQUIRES_CONFIRMATION (details JSON dans '
  'ERRCODE DETAIL). Fermee a anon.';
