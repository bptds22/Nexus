-- 20260917150137_recruiter_search_athletes_nom_ecole_equipe
--
-- APPLIQUEE en PROD le 2026-09-17 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP (redigee sous
-- 20260917120000). md5 de la definition identique prod / local apres apply.
-- REMPLACE `20260917120000_recruiter_search_athletes_nom_complet` (chantier A,
-- jamais applique en prod) : meme horodatage, meme fonction, perimetre elargi.
--
-- Quatre changements, tous dans le SEUL predicat de recherche :
--
-- ── 1. NOM COMPLET (chantier A) ──────────────────────────────────────────────
-- L'ancien predicat testait la saisie ENTIERE contre first_name OU last_name :
-- « Gabriel Mandziuk » ne trouvait rien. Recherche PAR MOTS : chaque mot doit
-- se retrouver dans au moins un des champs cherches. Couvre l'ordre inverse et
-- les fragments ; un mot seul se comporte comme avant.
--
-- ── 2. ECOLE ET EQUIPE (decision BP 2026-09-17) ──────────────────────────────
-- Les mots cherchent aussi dans le nom de l'ecole de l'athlete (`sc.name`), de
-- l'ecole de son equipe (`tsc.name`) et de son equipe (`tm.name`) — trois
-- tables DEJA jointes pour la projection. Recherche texte plutot que menus :
-- `sc.name` designe aussi des CLUBS civils (24 athletes actifs au 2026-09-17),
-- un menu « Ecole » aurait affirme qu'un club est une ecole ; et la barre de
-- filtres est saturee. « Tremblay Saint-Sacrement » combine nom et ecole.
--
-- ── 3. PALIER GRATUIT (decision BP 2026-09-17) ───────────────────────────────
-- AVANT : p_search entierement neutralise pour Free.
-- APRES : Free cherche par ecole et equipe ; la branche NOM reste Pro seulement.
-- Pourquoi ce n'est pas un oracle : l'ecole est deja affichee sur la carte
-- gratuite, et les noms d'equipe releves en prod sont des noms d'ecole, de
-- club ou de niveau (« Wildcats Midget D1 »), jamais de personne. Pour un Free,
-- le prenom et le nom ne sont JAMAIS lus par le predicat : aucune reponse ne
-- depend du nom d'un athlete. Le tri name_asc reste rabattu sur la cote.
--
-- ── 4. ORACLE D'IDENTITE MASQUEE — CORRIGE (decision BP 2026-09-17) ──────────
-- AVANT : la recherche par nom d'un Pro comparait aussi les noms des athletes
-- dont l'identite est masquee MEME POUR PRO (mineur sans consentement,
-- athlete_identity_ok = false ; 2 en prod au 2026-09-17). Taper « Tremblay »
-- faisait sortir une carte « Profil verrouille » : la confirmation qu'un
-- mineur non consentant porte ce nom.
-- APRES : la branche NOM exige athlete_identity_ok(...). Pour un Pro,
-- identity_visible = athlete_identity_ok, donc un nom ne peut plus trouver
-- que des fiches dont le nom est affiche. Un profil masque reste trouvable
-- par ecole ou equipe — information deja visible sur sa carte.
--
-- ── MECANIQUE ────────────────────────────────────────────────────────────────
-- · Insensible aux accents : `extensions.unaccent` (45 des 57 ecoles des
--   athletes actifs portent un accent). QUALIFIE PAR SON SCHEMA — la fonction
--   tourne en `search_path = public`. Et forme a DEUX arguments avec le
--   dictionnaire qualifie : la forme a un argument resout le dictionnaire
--   `unaccent` via le search_path, et echouerait ici. Present en local et en
--   prod : extensions.unaccent 1.1, verifie le 2026-09-17.
-- · Jokers neutralises COTE SERVEUR : `\`, `%`, `_` sont echappes dans chaque
--   mot. Le client retirait deja `%` et `_`, mais un appel direct de la RPC —
--   desormais ouvert aux Free — ne doit pas pouvoir elargir un motif, et un
--   `\` final levait « LIKE pattern must not end with escape character ».
-- · COALESCE(..., false) autour du test d'un mot : une ecole ou une equipe
--   NULL rendrait sinon le test NULL, `NOT NULL` = NULL, et le mot serait
--   compte comme TROUVE — un athlete sans ecole sortirait pour n'importe
--   quelle saisie.
--
-- ── CE QUI NE CHANGE PAS ─────────────────────────────────────────────────────
-- Signature, RETURNS TABLE, garde is_recruiter, projection (dont
-- identity_visible), autres filtres, tri : identiques a la definition PROD
-- relevee le 2026-09-17. Pas de DROP : CREATE OR REPLACE a signature et type
-- de retour identiques, l'ACL n'est pas emportee. Relevee AVANT en prod :
-- {postgres, authenticated, service_role}. Le gate la compare INTEGRALEMENT
-- apres (regle CLAUDE.md du 2026-09-07).

CREATE OR REPLACE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
  v_mots    text[];
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- RECHERCHE TEXTE — ouverte a TOUS les paliers depuis le 2026-09-17, mais la
  -- branche NOM du predicat reste Pro (et identite visible) : voir l'en-tete
  -- de la migration 20260917120000. Mots sans accent, jokers LIKE echappes.
  -- NULL si la saisie est vide.
  SELECT array_agg(replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, m),
           '\', '\\'), '%', '\%'), '_', '\_'))
    INTO v_mots
    FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS m
   WHERE m <> '';

  -- Oracle ferme pour les Free : le tri alphabetique est rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assoupli. La vitrine sort de toute facon en
  -- tete du tri par cote.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  -- Une liste a zero doit toujours pouvoir dire POURQUOI elle est a zero.
  IF p_offert_par_mon_cegep THEN
    SELECT u.school_id INTO v_school FROM public.users u WHERE u.id = auth.uid();
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'NEXUS: aucun cegep rattache a ce compte — le filtre « offert par mon cegep » est indisponible'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_programs sp WHERE sp.school_id = v_school) THEN
      RAISE EXCEPTION 'NEXUS: aucun programme au catalogue de ce cegep — le filtre « offert par mon cegep » ne peut rien rendre'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    (a.video_faits_saillants_url IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
    tm.gender,
    -- Projection : sans elle le filtre est aveugle. Le LIBELLE choisi par
    -- l'athlete, pas le nom ministeriel.
    (SELECT jsonb_agg(jsonb_build_object(
              'id', l.id, 'label', l.label, 'code', p.code, 'program_id', p.id)
              ORDER BY idx.ord)
       FROM unnest(a.programmes_vises) WITH ORDINALITY AS idx(lid, ord)
       JOIN public.cegep_program_labels l ON l.id = idx.lid
       JOIN public.cegep_programs       p ON p.id = l.program_id),
    -- LOT 3 — meme jointure qu'au-dessus, quatre colonnes de plus.
    tm.division,
    tm.league,
    (tm.rseq_team_id IS NOT NULL),
    tsc.type
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  -- L'ecole de L'EQUIPE, pas celle de l'athlete : les deux divergent deja en
  -- prod (2 athletes au 2026-09-07). `teams.school_id` est NOT NULL, donc
  -- `team_school_type` non nul <=> l'athlete a une equipe.
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  WHERE a.status = 'ACTIF'::public.account_status
    -- RECHERCHE PAR MOTS (2026-09-17). Lu : « aucun mot saisi n'est introuvable ».
    -- Un mot est trouve s'il figure dans :
    --   · le prenom ou le nom — PRO SEULEMENT et IDENTITE VISIBLE (oracle ferme) ;
    --   · l'ecole de l'athlete, l'ecole de son equipe, ou son equipe — tous paliers.
    AND (v_mots IS NULL OR NOT EXISTS (
          SELECT 1
            FROM unnest(v_mots) AS mot
           WHERE NOT COALESCE(
                   (    v_tier_ok
                    AND public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                    AND (   extensions.unaccent('extensions.unaccent'::regdictionary, a.first_name) ILIKE '%' || mot || '%'
                         OR extensions.unaccent('extensions.unaccent'::regdictionary, a.last_name)  ILIKE '%' || mot || '%'))
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, sc.name)  ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tsc.name) ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tm.name)  ILIKE '%' || mot || '%',
                 false)))
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR a.video_faits_saillants_url IS NOT NULL)
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    AND (p_min_rating IS NULL OR a.cote_globale_entraineur >= p_min_rating)
    AND (NOT p_ouvert_demenager  OR a.pret_changer_region = true)
    AND (NOT p_ouvert_prive      OR a.ouvert_cegep_prive = true)
    AND (NOT p_ouvert_anglophone OR a.ouvert_cegep_anglophone = true)
    AND (NOT p_new_only OR a.created_at >= now() - INTERVAL '10 days')
    -- Comparaison au niveau du PROGRAMME, pas du libelle.
    AND (p_programme_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.cegep_program_labels l
           WHERE l.id = ANY(a.programmes_vises)
             AND l.program_id = ANY(p_programme_ids)))
    AND (NOT p_offert_par_mon_cegep OR EXISTS (
          SELECT 1
            FROM public.cegep_program_labels l
            JOIN public.school_programs spx ON spx.program_id = l.program_id
           WHERE l.id = ANY(a.programmes_vises)
             AND spx.school_id = v_school
             AND spx.is_displayed))
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN a.cote_globale_entraineur END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN a.cote_globale_entraineur END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;

-- ── GATES ────────────────────────────────────────────────────────────────────
do $$
declare
  f    regprocedure := 'public.recruiter_search_athletes(text, uuid, integer, boolean, boolean, numeric, numeric, boolean, boolean, boolean, boolean, text, integer, uuid[], boolean)'::regprocedure;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  -- ACL COMPLETE, triee, jamais par inclusion.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de recruiter_search_athletes = %, attendu %', vus, veut;
  end if;

  -- unaccent doit resoudre sous le search_path de la fonction (public seul) :
  -- sans ca la RPC leverait a la PREMIERE recherche, pas a l'apply.
  perform set_config('search_path', 'public', true);
  if extensions.unaccent('extensions.unaccent'::regdictionary, 'Séminaire École') <> 'Seminaire Ecole' then
    raise exception 'NEXUS: extensions.unaccent ne rend pas le resultat attendu';
  end if;

  raise notice 'NEXUS: ACL inchangee — %, unaccent qualifie OK sous search_path=public', vus;
end $$;
