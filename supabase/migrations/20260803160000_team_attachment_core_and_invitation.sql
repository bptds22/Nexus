-- ============================================================================
-- A4 — Sémantique de transfert PARTAGÉE : RPC athlète + acceptation d'invitation
--
-- PROBLÈME. La phase 1 a posé apply_team_attachment (chemin athlète : join code
-- et onglet Transfert) mais a laissé intact le trigger
-- apply_team_invitation_acceptance, qui appliquait encore l'ancienne sémantique :
--     INSERT INTO team_athletes … ON CONFLICT (team_id, athlete_id) DO NOTHING
-- Deux conséquences, toutes deux mauvaises :
--   • un athlète DÉJÀ ancré ailleurs qui accepte une invitation faisait échouer
--     l'INSERT sur team_athletes_athlete_id_key — l'ON CONFLICT ne couvre pas
--     cette contrainte-là — et l'invitation passait à ACCEPTED alors que
--     l'athlète n'avait rejoint personne ;
--   • même en cas de succès, l'ancienne appartenance disparaissait sans laisser
--     de trace dans parcours_equipes, et coach_id n'était que COALESCE'é.
--
-- DÉCISION. L'acceptation d'une invitation VAUT confirmation de transfert :
-- l'athlète a lu le nom de l'équipe et a cliqué « Accepter ». Le trigger appelle
-- donc le même corps que la RPC, avec p_confirm_transfer := true.
--
-- FACTORISATION. Le corps commun descend dans _apply_team_attachment_core(),
-- qui porte la sémantique ET le gate Loi 25 <14. Ce qui reste PROPRE À CHAQUE
-- APPELANT reste dehors :
--   • apply_team_attachment  : garde auth.uid(), résolution de l'athlète par
--                              user_id, validation du join code et
--                              consommation du quota ;
--   • le trigger             : l'athlète vient de NEW.athlete_id (déjà validé
--                              par la policy « Athletes update own
--                              invitations »), pas de code.
--
-- LE GATE <14 VIT DANS LE NOYAU. Il y est parce que le noyau est la porte
-- d'écriture UNIQUE de l'ancrage : un futur appelant ne peut pas l'oublier.
-- Conséquence directe et voulue — le chemin INVITATION est désormais couvert
-- lui aussi. Un athlète de moins de 14 ans qui accepte une invitation fait
-- échouer l'UPDATE de team_invitations : le trigger lève, la transaction est
-- annulée, le statut ne passe pas à ACCEPTED. Sous 14 ans l'enfant ne consent
-- pas seul, que le geste parte d'un code, d'un écran de transfert ou d'une
-- invitation. L'ajout par un COACH (INSERT direct dans team_athletes, hors de
-- cette fonction) reste permis : là, c'est l'adulte responsable qui agit.
--
-- SÉQUENÇAGE DU DROP. UNIQUE (team_id, athlete_id) n'avait été conservée en
-- phase 1 que pour l'ON CONFLICT ci-dessus. Le trigger réécrit ne l'utilise
-- plus (il fait DELETE-puis-INSERT via le core), et un balayage de pg_proc
-- confirme qu'aucune autre fonction ne cite cette paire — le seul autre
-- ON CONFLICT du schéma porte sur conversation_members. La contrainte tombe
-- donc EN FIN de cette migration, après que les trois fonctions aient été
-- remplacées, dans la même transaction.
-- ============================================================================

-- ── Corps commun ────────────────────────────────────────────────────────────
-- Contrat : l'appelant a DÉJÀ établi que p_athlete_id est légitime. Cette
-- fonction ne fait aucun contrôle d'identité — elle applique la sémantique.
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
  v_parcours     jsonb   := NULL;      -- NULL = ne pas toucher la colonne
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

  -- ── Loi 25 — moins de 14 ans ──────────────────────────────────────────────
  -- Le gate vit ICI, dans le noyau, et nulle part ailleurs. Le noyau est la
  -- porte d'ecriture UNIQUE de l'ancrage : un futur appelant (import, back-
  -- office, nouveau flux) ne peut pas l'oublier, alors qu'il pourrait tres bien
  -- oublier de recopier un garde-fou pose dans l'enveloppe.
  --
  -- CONSEQUENCE ASSUMEE : le chemin INVITATION est desormais couvert lui aussi.
  -- Un athlete de moins de 14 ans qui accepte une invitation d'equipe fait
  -- echouer l'UPDATE de team_invitations (le trigger leve, la transaction est
  -- annulee, le statut ne passe pas a ACCEPTED). C'est le comportement voulu :
  -- sous 14 ans, l'enfant ne consent pas seul, que le geste parte d'un code,
  -- d'un ecran de transfert ou d'une invitation.
  --
  -- Ce que ce gate NE bloque PAS : le coach qui ajoute lui-meme un athlete a
  -- son alignement (INSERT direct dans team_athletes, hors de cette fonction).
  -- C'est voulu — la, c'est l'adulte responsable qui agit, pas l'enfant.
  IF v_athlete.date_naissance IS NOT NULL
     AND extract(year from age(v_athlete.date_naissance))::int < 14 THEN
    RAISE EXCEPTION 'ATHLETE_UNDER_14';
  END IF;

  -- ── Equipe cible ──────────────────────────────────────────────────────────
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

  -- ── Appartenance actuelle ────────────────────────────────────────────────
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

    -- Idempotence : deja sur l'equipe cible → on ne touche a RIEN.
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
    -- lecteur client (parseTeamHistory + TeamHistoryBlock) traite year_end
    -- NULL comme « equipe ACTUELLE ». Sans annees, la trace d'une equipe
    -- QUITTEE s'afficherait comme l'equipe courante.
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
      -- ISO-8601 UTC a format FIXE : timestamptz brut porterait le decalage de
      -- la session, et le tri TEXTE de l'eviction cesserait d'etre chronologique.
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

    -- Plafond 10 (CHECK athletes_parcours_equipes_shape). On evince la PLUS
    -- VIEILLE entree SYSTEME. S'il n'y en a aucune — les 10 lignes sont des
    -- saisies manuelles de l'athlete — on N'ECRASE RIEN : le transfert se fait
    -- quand meme et parcours_appended=false le dit a l'appelant.
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
    -- Sur une ancienne equipe LIGUE_CIVILE, le trigger peut nuller ou repointer
    -- athletes.school_id juste apres. Sans consequence : l'UPDATE d'ancrage
    -- ci-dessous s'execute APRES (trigger AFTER ROW non defere) et ecrase sans
    -- condition.
    DELETE FROM public.team_athletes WHERE id = v_prev_id;
  END IF;

  -- ── Ancrage final — TOUJOURS apres le DELETE ─────────────────────────────
  -- Regle coach_id a deux branches : equipe cible avec staff → reecriture vers
  -- le head_coach (repli : plus ancien created_at) ; equipe cible sans staff →
  -- preservation. COALESCE(role,'') parce que role est nullable et que
  -- « NULL = 'head_coach' » vaut NULL, que ORDER BY … DESC placerait en tete.
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

  -- Le trigger BEFORE team_athletes_set_sport_id_trg remplit sport_id.
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

-- Helper interne : aucun EXECUTE accorde. Les deux appelants sont SECURITY
-- DEFINER et s'executent sous le proprietaire, qui garde ses droits.
REVOKE ALL ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) FROM service_role;

COMMENT ON FUNCTION public._apply_team_attachment_core(uuid, uuid, boolean) IS
  'Corps commun du rattachement d''equipe : trace parcours + DELETE de '
  'l''ancienne appartenance + ancrage ecrit APRES le trigger + regle coach_id a '
  'deux branches + INSERT. NE CONTROLE AUCUNE IDENTITE — l''appelant doit avoir '
  'etabli la legitimite de p_athlete_id. Appele par apply_team_attachment '
  '(chemin athlete) et apply_team_invitation_acceptance (chemin invitation).';


-- ── apply_team_attachment — devient une enveloppe ───────────────────────────
-- Signature INCHANGEE : les GRANTs poses en phase 1 (authenticated +
-- service_role, ferme a anon) survivent au CREATE OR REPLACE. Ils sont
-- neanmoins reposes en fin de fichier, par principe.
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
  v_caller  uuid := auth.uid();
  v_athlete record;
  v_tok     record;
  v_has_tok boolean := false;
  v_result  jsonb;
BEGIN
  -- ── GUARD STRICT ─────────────────────────────────────────────────────────
  -- Forme DURE, volontairement differente du « auth.uid() IS NOT NULL AND … »
  -- permissif des consume_* : pas de session = pas d'appel.
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT a.id INTO v_athlete
  FROM public.athletes a
  WHERE a.user_id = v_caller;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  -- Le gate Loi 25 <14 N'EST PLUS ICI : il a ete DEPLACE dans
  -- _apply_team_attachment_core, seule porte d'ecriture de l'ancrage. Une
  -- copie locale ferait une deuxieme implementation a maintenir, qui finirait
  -- par diverger. Ne pas la reintroduire.

  -- ── Join code ────────────────────────────────────────────────────────────
  -- FOR UPDATE : le quota est la seule vraie course de cette fonction. Deux
  -- athletes qui scannent le dernier usage disponible doivent se serialiser
  -- ici. L'increment n'a lieu qu'apres un rattachement REEL (cf. plus bas).
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

  v_result := public._apply_team_attachment_core(v_athlete.id, p_team_id, p_confirm_transfer);

  -- Quota consomme seulement si un rattachement a REELLEMENT eu lieu : un
  -- no-op idempotent (l'athlete rescanne le code de son equipe actuelle) ne
  -- doit pas griller une utilisation.
  IF v_has_tok AND (v_result->>'no_op') = 'false' THEN
    UPDATE public.team_join_tokens
       SET use_count = use_count + 1
     WHERE id = v_tok.id;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_team_attachment(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_team_attachment(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_team_attachment(uuid, text, boolean)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_team_attachment(uuid, text, boolean) IS
  'LA fonction de rattachement d''equipe cote athlete (join code ET onglet '
  'Transfert). Garde auth.uid(), validation et consommation du join code ; '
  'delegue la semantique ET le gate Loi 25 <14 a _apply_team_attachment_core. Sans '
  'p_confirm_transfer, un changement d''equipe leve '
  'TRANSFER_REQUIRES_CONFIRMATION (details JSON dans DETAIL). Fermee a anon.';


-- ── apply_team_invitation_acceptance — meme semantique que la RPC ───────────
CREATE OR REPLACE FUNCTION public.apply_team_invitation_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF NEW.status <> 'ACCEPTED' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'ACCEPTED' THEN
    RETURN NEW;                              -- idempotent : deja accepte
  END IF;

  -- L'ACCEPTATION VAUT CONFIRMATION : l'athlete a lu le nom de l'equipe dans
  -- l'invitation et a clique « Accepter ». Lui relever
  -- TRANSFER_REQUIRES_CONFIRMATION ici n'aurait aucun ecran ou atterrir — le
  -- geste de confirmation, c'est l'acceptation elle-meme.
  --
  -- La legitimite de NEW.athlete_id est etablie EN AMONT par la policy
  -- « Athletes update own invitations » (is_own_athlete(athlete_id) + status
  -- clampe a ACCEPTED/REJECTED). Le core n'a donc pas a la recontroler.
  PERFORM public._apply_team_attachment_core(NEW.athlete_id, NEW.team_id, true);

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.apply_team_invitation_acceptance() IS
  'A l''acceptation d''une invitation, applique la semantique de transfert '
  'COMPLETE via _apply_team_attachment_core (trace parcours, DELETE de '
  'l''ancienne appartenance, ancrage, regle coach_id a deux branches, INSERT). '
  'L''acceptation vaut confirmation. Remplace l''ancien INSERT … ON CONFLICT '
  '(team_id, athlete_id) DO NOTHING, qui laissait passer l''invitation a '
  'ACCEPTED sans rattacher quand l''athlete etait deja ancre ailleurs.';


-- ── La contrainte redondante peut enfin tomber ──────────────────────────────
-- Plus aucun ON CONFLICT (team_id, athlete_id) dans le schema (verifie sur
-- pg_proc : le seul autre ON CONFLICT porte sur conversation_members).
-- L'unicite reste garantie par team_athletes_athlete_id_key : deux lignes de
-- meme paire impliqueraient deux lignes de meme athlete_id.
ALTER TABLE public.team_athletes
  DROP CONSTRAINT IF EXISTS team_athletes_team_id_athlete_id_key;
