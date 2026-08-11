-- ═══════════════════════════════════════════════════════════════
-- LOT 2 SÉCURITÉ — TEMPS 1, migration 2/2 : RPC de projection
--
-- Remplacent, à terme (1.2.1), les lectures directes de la table
-- athletes par les 13 surfaces recruteur. AUCUN front ne les
-- appelle aujourd'hui : cette migration est une pure addition,
-- sans effet observable sur l'app 1.1.1 live ni sur le build 1.2.
--
-- DÉCOUPAGE MINIMAL — 3 familles pour 12 surfaces :
--
--   1. recruiter_athlete_cards(uuid[])  ← 9 hooks qui font un embed
--      athletes!athlete_id sur une relation qu'ils possèdent déjà
--      (favoris, pipeline, listes, vus récemment, tendances,
--      calendrier, conversations, threadSummary, threadContext).
--      Le hook garde sa requête de relation, puis résout les cartes
--      par IDs. Une fonction, neuf appelants.
--
--   2. recruiter_search_athletes(...)   ← useAthleteSearch +
--      useAthleteAutocomplete. Porte les filtres serveur, le tri et
--      le cap de tier.
--
--   3. recruiter_athlete_profile(uuid)  ← AthleteRecruiterProfileBody
--      et sa variante Mobile.
--
--   Hors périmètre (vérifié) : useActivityList, useDashboardKpi,
--   useCegepStats ne lisent que des agrégats, aucun champ sensible.
--
-- LES DEUX CRITÈRES, dans l'ordre de priorité :
--   (a) Loi 25 — athlete_identity_ok(). Prime toujours.
--   (b) Tier   — get_user_tier() IN ('pro','all_star').
--   show_identity = (a) AND (b). Un tier payant ne rachète JAMAIS
--   un défaut de consentement.
--
-- CHAMPS JAMAIS PROJETÉS AUX RECRUTEURS, AUCUN TIER :
--   date_naissance  → seul `age` (entier dérivé) est exposé. L'âge
--                     ne réidentifie pas ; la date de naissance est
--                     un identifiant direct au sens de la Loi 25.
--   nom_parent, telephone_parent, email, telephone → absents du
--   RETURNS TABLE. Vérifié : aucun hook recruteur ne les lit
--   aujourd'hui, donc leur retrait ne casse aucune surface.
--
-- DEUX ORACLES FERMÉS EXPLICITEMENT (famille 2) :
--   • recherche par nom neutralisée pour les Free — sinon un Free
--     retrouve un nom masqué par binarisation du filtre ilike.
--   • tri 'name_asc' neutralisé pour les Free — sinon l'ordre
--     alphabétique du résultat divulgue le nom masqué.
--
-- GARDE DE RÔLE : ces fonctions sont SECURITY DEFINER avec
-- row_security=off — elles court-circuitent la RLS par
-- construction. Sans garde is_recruiter(), n'importe quel compte
-- authentifié (athlète, parent) lirait toute la base. Le garde
-- n'est donc pas décoratif : il remplace la RLS désactivée.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── Famille 1 : cartes par lot d'IDs ────────────────────────────

CREATE OR REPLACE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
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
  school_name         text,
  school_region       text,
  school_type         text
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
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text,
    a.statut_recrutement_override,
    a.open_to_offers,
    (a.video_faits_saillants_url IS NOT NULL),
    a.context,
    sp.nom, po.nom, po.abreviation,
    sc.name, sc.region, sc.type
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status;
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_athlete_cards(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_athlete_cards(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.recruiter_athlete_cards(uuid[]) IS
  'Lot 2 — cartes athletes projetees pour les surfaces recruteur de type liste (favoris, pipeline, listes, vus recemment, tendances, calendrier, messagerie). Loi 25 prime sur le tier. date_naissance jamais projetee (age derive) ; coordonnees parentales absentes.';

-- ── Famille 2 : recherche ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recruiter_search_athletes(
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
  school_name         text,
  school_region       text,
  school_type         text
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
    a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    (a.video_faits_saillants_url IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    sc.name, sc.region, sc.type
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
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
  'Lot 2 — recherche recruteur projetee. Loi 25 prime sur le tier. Ferme deux oracles pour les Free : filtre par nom neutralise et tri name_asc rabattu sur rating_desc.';

-- ── Famille 3 : profil ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
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
  school_name         text,
  school_region       text,
  school_city         text,
  school_type         text
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
    sc.name, sc.region, sc.city, sc.type
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status;
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_athlete_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recruiter_athlete_profile(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.recruiter_athlete_profile(uuid) IS
  'Lot 2 — profil athlete projete pour le recruteur. Loi 25 prime sur le tier. date_naissance jamais projetee (age derive) ; nom_parent, telephone_parent, email, telephone absents du contrat.';

COMMIT;
