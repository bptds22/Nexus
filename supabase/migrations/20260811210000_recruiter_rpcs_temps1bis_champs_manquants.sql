-- ═══════════════════════════════════════════════════════════════
-- LOT 2 SÉCURITÉ — TEMPS 1 bis : complétion du contrat des 3 RPC
--
-- POURQUOI CETTE MIGRATION EXISTE
-- Les 3 RPC de 20260811032645 projettent moins de champs que les
-- surfaces recruteur n'en affichent aujourd'hui. Basculer les hooks
-- dessus tels quels aurait produit une régression visuelle
-- silencieuse — constatée champ par champ contre le code appelant :
--
--   evaluations        → badges Capitaine / Équipe d'étoiles /
--                        Leader sur les cartes favoris ET recherche
--                        (useAthletesByIds:62, useAthleteSearch:191)
--   profile_completion → jauge de complétion du kanban et du
--                        résumé de fil (usePipelineCards:108,
--                        useAthleteThreadSummary:83)
--   committed_school   → école d'engagement sous les statuts
--                        ENGAGE / LETTRE_SIGNEE (usePipelineCards:113)
--   school_id          → pastille « sans équipe » et déduction
--                        orgType (useAthleteSearch:232/241)
--
-- L'alternative — compléter par des requêtes annexes côté client —
-- aurait maintenu des lectures directes sur athletes/evaluations,
-- soit exactement ce que le verrou RLS final doit fermer. Le
-- déficit se paie au serveur, une fois.
--
-- POURQUOI `evaluations` EST UN AGRÉGAT BRUT, PAS UNE LIGNE CHOISIE
-- La règle de sélection (lib/evaluations/selectEvaluation.ts) est
-- « la plus récente par updated_at gagne, aucune priorité de type ».
-- La réimplémenter en SQL créerait deux copies d'une règle produit
-- qui a déjà changé une fois. On projette donc le tableau complet
-- et selectBestEvaluation continue de trancher côté client,
-- inchangé. `updated_at` est inclus — sans lui la sélection
-- retombe sur un ordre non déterministe.
--
-- CES CHAMPS NE SONT PAS DE L'IDENTITÉ
-- distinctions, cote, complétion, école d'engagement, école
-- d'origine : aucun n'est un identifiant direct au sens de la
-- Loi 25, et tous sont déjà visibles à tous les tiers aujourd'hui.
-- Ils restent donc HORS du masquage identity_visible, qui continue
-- de ne couvrir que prénom, nom, photo et numéro.
--
-- DROP + CREATE, PAS CREATE OR REPLACE : changer un RETURNS TABLE
-- est un changement de type de retour, que REPLACE refuse.
-- Les GRANT ne survivent pas au DROP — ils sont repris ci-dessous.
--
-- ⚠ PIÈGE VÉRIFIÉ AU CATALOGUE, À REJOUER À CHAQUE DROP+CREATE
-- Supabase pose des ALTER DEFAULT PRIVILEGES sur le schéma public :
-- toute fonction qui y est CRÉÉE reçoit EXECUTE pour `anon`
-- automatiquement. Le DROP+CREATE a donc silencieusement ANNULÉ le
-- REVOKE de 20260811032846 — constaté sur le premier apply, proacl
-- affichait `anon=X/postgres` sur les 3 fonctions.
-- `REVOKE ... FROM PUBLIC` ne corrige PAS ça : anon porte un grant
-- nommé, pas un grant PUBLIC. Il faut un REVOKE ... FROM anon
-- explicite — c'est le bloc en fin de fichier.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS public.recruiter_athlete_cards(uuid[]);
DROP FUNCTION IF EXISTS public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer);
DROP FUNCTION IF EXISTS public.recruiter_athlete_profile(uuid);

-- ── Famille 1 : cartes par lot d'IDs ────────────────────────────

CREATE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
RETURNS TABLE (
  id                  uuid,
  identity_visible    boolean,
  first_name          text,
  last_name           text,
  photo_url           text,
  numero_jersey       text,
  age                 integer,
  annee_diplomation   integer,
  verified            boolean,
  last_profile_validation timestamptz,
  cote_globale        numeric,
  profile_completion  integer,
  taille_pieds        integer,
  taille_pouces       integer,
  poids_lbs           numeric,
  moyenne_generale    numeric,
  mentions_academiques jsonb,
  recruitment_status  text,
  statut_recrutement_override text,
  open_to_offers      boolean,
  a_une_video         boolean,
  context             text,
  sport_nom           text,
  position_nom        text,
  position_abbr       text,
  school_id           uuid,
  school_name         text,
  school_region       text,
  school_type         text,
  committed_school_name text,
  evaluations         jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation,
    a.verified,
    a.last_profile_validation,
    a.cote_globale_entraineur,
    a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text,
    a.statut_recrutement_override,
    a.open_to_offers,
    (a.video_faits_saillants_url IS NOT NULL),
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', ev.distinctions,
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status;
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_athlete_cards(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_athlete_cards(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.recruiter_athlete_cards(uuid[]) IS
  'Lot 2 TEMPS 1bis — cartes athletes projetees pour les surfaces recruteur de type liste. Loi 25 prime sur le tier. date_naissance jamais projetee (age derive) ; coordonnees parentales absentes. evaluations est un agregat brut : selectBestEvaluation tranche cote client.';

-- ── Famille 2 : recherche ───────────────────────────────────────

CREATE FUNCTION public.recruiter_search_athletes(
  p_search              text    DEFAULT NULL,
  p_sport_id            uuid    DEFAULT NULL,
  p_promotion           integer DEFAULT NULL,
  p_verified_only       boolean DEFAULT false,
  p_with_video_only     boolean DEFAULT false,
  p_min_gpa             numeric DEFAULT NULL,
  p_min_rating          numeric DEFAULT NULL,
  p_ouvert_demenager    boolean DEFAULT false,
  p_ouvert_prive        boolean DEFAULT false,
  p_ouvert_anglophone   boolean DEFAULT false,
  p_new_only            boolean DEFAULT false,
  p_sort_by             text    DEFAULT 'rating_desc',
  p_limit               integer DEFAULT 50
)
RETURNS TABLE (
  id                  uuid,
  identity_visible    boolean,
  first_name          text,
  last_name           text,
  photo_url           text,
  numero_jersey       text,
  age                 integer,
  annee_diplomation   integer,
  verified            boolean,
  last_profile_validation timestamptz,
  cote_globale        numeric,
  profile_completion  integer,
  taille_pieds        integer,
  taille_pouces       integer,
  poids_lbs           numeric,
  moyenne_generale    numeric,
  mentions_academiques jsonb,
  recruitment_status  text,
  statut_recrutement_override text,
  open_to_offers      boolean,
  a_une_video         boolean,
  context             text,
  created_at          timestamptz,
  sport_nom           text,
  position_nom        text,
  position_abbr       text,
  school_id           uuid,
  school_name         text,
  school_region       text,
  school_type         text,
  committed_school_name text,
  evaluations         jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
DECLARE
  v_tier_ok  boolean;
  v_search   text;
  v_sort     text;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- Oracle 1 : un Free ne reçoit pas les noms — il ne peut donc pas
  -- filtrer dessus, sinon il les retrouve par binarisation.
  v_search := CASE WHEN v_tier_ok THEN NULLIF(btrim(COALESCE(p_search, '')), '') END;

  -- Oracle 2 : trier par nom divulgue l'ordre alphabétique des noms
  -- masqués. Repli sur le tri par cote pour les Free.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.numero_jersey END,
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
              'distinctions', ev.distinctions,
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.status = 'ACTIF'::public.account_status
    AND (v_search IS NULL
         OR a.first_name ILIKE '%' || v_search || '%'
         OR a.last_name  ILIKE '%' || v_search || '%')
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
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN a.cote_globale_entraineur END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN a.cote_globale_entraineur END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT GREATEST(COALESCE(p_limit, 50), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer) IS
  'Lot 2 TEMPS 1bis — recherche recruteur projetee. Loi 25 prime sur le tier. Ferme deux oracles pour les Free : filtre par nom neutralise et tri name_asc rabattu sur rating_desc. evaluations est un agregat brut.';

-- ── Famille 3 : profil ──────────────────────────────────────────
--
-- L'agrégat porte ici les 14 traits + le rapport d'entraîneur : le
-- profil détaillé les affiche un par un, là où les cartes n'ont
-- besoin que de la cote et des distinctions.

CREATE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
RETURNS TABLE (
  id                  uuid,
  identity_visible    boolean,
  first_name          text,
  last_name           text,
  photo_url           text,
  numero_jersey       text,
  age                 integer,
  genre               text,
  annee_diplomation   integer,
  verified            boolean,
  profile_completion  integer,
  last_profile_validation timestamptz,
  cote_globale        numeric,
  taille_pieds        integer,
  taille_pouces       integer,
  poids_lbs           numeric,
  moyenne_generale    numeric,
  mentions_academiques jsonb,
  matieres_fortes     jsonb,
  programme_cegep_vise jsonb,
  regions_cegep_preferees jsonb,
  ouvert_cegep_prive  boolean,
  ouvert_cegep_anglophone boolean,
  pret_changer_region boolean,
  bio                 text,
  recruitment_status  text,
  statut_recrutement_override text,
  open_to_offers      boolean,
  video_faits_saillants_url text,
  hudl_url            text,
  youtube_url         text,
  context             text,
  sport_nom           text,
  position_nom        text,
  position_abbr       text,
  school_id           uuid,
  school_name         text,
  school_region       text,
  school_city         text,
  school_type         text,
  committed_school_name text,
  evaluations         jsonb
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public SET row_security = off AS $$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND v_tier_ok THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.genre,
    a.annee_diplomation, a.verified, a.profile_completion, a.last_profile_validation,
    a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques, a.matieres_fortes,
    a.programme_cegep_vise, a.regions_cegep_preferees,
    a.ouvert_cegep_prive, a.ouvert_cegep_anglophone, a.pret_changer_region,
    a.bio,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.city, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale',        ev.cote_globale,
              'distinctions',        ev.distinctions,
              'rapport_entraineur',  ev.rapport_entraineur,
              'updated_at',          ev.updated_at,
              'leadership',          ev.leadership,
              'discipline',          ev.discipline,
              'coachabilite',        ev.coachabilite,
              'intelligence_jeu',    ev.intelligence_jeu,
              'competitivite',       ev.competitivite,
              'esprit_equipe',       ev.esprit_equipe,
              'resilience',          ev.resilience,
              'attitude_mentalite',  ev.attitude_mentalite,
              'vitesse_explosivite', ev.vitesse_explosivite,
              'force_puissance',     ev.force_puissance,
              'endurance_cardio',    ev.endurance_cardio,
              'agilite_coordination',ev.agilite_coordination,
              'vision_du_jeu',       ev.vision_du_jeu,
              'sens_tactique',       ev.sens_tactique))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status;
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_athlete_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_athlete_profile(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.recruiter_athlete_profile(uuid) IS
  'Lot 2 TEMPS 1bis — profil athlete projete pour le recruteur. Loi 25 prime sur le tier. date_naissance jamais projetee (age derive) ; nom_parent, telephone_parent, email, telephone absents du contrat. evaluations porte les 14 traits + le rapport.';

-- ── Repose du REVOKE anon (voir le PIÈGE en tête de fichier) ─────
-- Sans ces 3 lignes, les fonctions sortent du DROP+CREATE avec
-- anon=X. Le garde is_recruiter() les protegerait quand meme, mais
-- la defense en profondeur veut que la surface anon soit nulle.
REVOKE ALL ON FUNCTION public.recruiter_athlete_cards(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer) FROM anon;
REVOKE ALL ON FUNCTION public.recruiter_athlete_profile(uuid) FROM anon;

COMMIT;
