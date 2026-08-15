-- ═══════════════════════════════════════════════════════════════
-- LOT A — le plafond Free tombe, le genre d'équipe rejoint le contrat
--
-- 1. p_limit : NULL ou négatif = ILLIMITÉ
-- La convention du client est « -1 = illimité » (SubscriptionProvider
-- maxSearchResults, useAthleteSearch:174). La forme actuelle
--   LIMIT GREATEST(COALESCE(p_limit, 50), 0)
-- traduit -1 en LIMIT 0, soit ZÉRO ligne. Un câblage naïf aurait
-- rendu une grille vide, sans erreur, pour tous les Pro. On règle
-- ça À LA SOURCE plutôt que par un grand entier côté client : un
-- sentinel qui ne vit que dans l'appelant est un piège qui se
-- retend au prochain appelant.
--   LIMIT NULL vaut LIMIT ALL en Postgres — c'est la forme exacte.
--
-- DEFAULT passé de 50 à NULL. Un argument oublié ne doit pas
-- tronquer en silence à 50 : c'est la même classe de plafond
-- invisible que cette migration supprime. Un appelant qui veut un
-- plafond (autocomplete) le demande explicitement. Aucun contrat
-- n'est cassé : les 3 RPC n'ont aucun appelant applicatif au jour
-- de cette migration.
--
-- 2. team_gender ajouté
-- useAthleteSearch mappe teamGender depuis team_athletes(teams(gender))
-- et le filtre par genre s'applique dessus côté client
-- (page.tsx / RecruteurRechercheMobile). La RPC ne le projetait pas :
-- basculer dessus aurait cassé le filtre en silence — teamGender
-- serait resté null, et un genre sélectionné aurait vidé la grille.
--
-- Le LEFT JOIN ne multiplie AUCUNE ligne : team_athletes porte un
-- index UNIQUE sur athlete_id (team_athletes_athlete_id_key), donc
-- au plus une équipe par athlète. Vérifié au catalogue.
--
-- team_gender N'EST PAS de l'identité : c'est le genre de l'ÉQUIPE,
-- partagé par tout un effectif. Il reste hors du masquage
-- identity_visible, comme l'école ou la position.
--
-- DROP + CREATE, PAS CREATE OR REPLACE : le RETURNS TABLE change.
-- Les GRANT ne survivent pas au DROP — repris en fin de fichier.
--
-- ⚠ PIÈGE REJOUÉ ICI (voir 20260811032846 et 20260811210000)
-- Supabase pose des ALTER DEFAULT PRIVILEGES sur le schéma public :
-- toute fonction CRÉÉE y reçoit EXECUTE pour `anon`. Ce DROP+CREATE
-- annule donc à nouveau le REVOKE. `REVOKE ... FROM PUBLIC` ne le
-- corrige pas — anon porte un grant nommé. Le REVOKE ... FROM anon
-- explicite est obligatoire, il est en fin de fichier.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

DROP FUNCTION IF EXISTS public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,
  boolean,boolean,boolean,boolean,text,integer
);

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
  p_limit               integer DEFAULT NULL          -- NULL = illimité
)
RETURNS TABLE (
  id                          uuid,
  identity_visible            boolean,
  first_name                  text,
  last_name                   text,
  photo_url                   text,
  numero_jersey               text,
  age                         integer,
  annee_diplomation           integer,
  verified                    boolean,
  last_profile_validation     timestamp with time zone,
  cote_globale                numeric,
  profile_completion          integer,
  taille_pieds                integer,
  taille_pouces               integer,
  poids_lbs                   numeric,
  moyenne_generale            numeric,
  mentions_academiques        jsonb,
  recruitment_status          text,
  statut_recrutement_override text,
  open_to_offers              boolean,
  a_une_video                 boolean,
  context                     text,
  created_at                  timestamp with time zone,
  sport_nom                   text,
  position_nom                text,
  position_abbr               text,
  school_id                   uuid,
  school_name                 text,
  school_region               text,
  school_type                 text,
  committed_school_name       text,
  evaluations                 jsonb,
  team_gender                 text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_tier_ok boolean;
  v_search  text;
  v_sort    text;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- Deux oracles fermés pour les Free : le filtre par nom est
  -- neutralisé, et le tri alphabétique rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  v_search := CASE WHEN v_tier_ok THEN NULLIF(btrim(COALESCE(p_search, '')), '') END;

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
      WHERE ev.athlete_id = a.id),
    tm.gender
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
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
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$$;

REVOKE ALL ON FUNCTION public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,
  boolean,boolean,boolean,boolean,text,integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,
  boolean,boolean,boolean,boolean,text,integer
) TO authenticated, service_role;

-- Obligatoire après DROP+CREATE : voir le piège en tête de fichier.
REVOKE EXECUTE ON FUNCTION public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,
  boolean,boolean,boolean,boolean,text,integer
) FROM anon;

COMMENT ON FUNCTION public.recruiter_search_athletes(
  text,uuid,integer,boolean,boolean,numeric,numeric,
  boolean,boolean,boolean,boolean,text,integer
) IS
  'Lot A — recherche recruteur projetee, SANS plafond de volume. p_limit NULL ou negatif = illimite (LIMIT NULL). Loi 25 prime sur le tier. Ferme deux oracles pour les Free : filtre par nom neutralise et tri name_asc rabattu sur rating_desc. team_gender projete pour le filtre par genre (jointure 1-1, team_athletes.athlete_id est UNIQUE).';

COMMIT;
