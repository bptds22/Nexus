-- ROLLBACK d'urgence de 20260706120200_harden_trending_athletes_view.sql
-- Restaure la définition d'origine : sans gate is_approved_partner, sans
-- security_barrier. À appliquer MANUELLEMENT (hors supabase/migrations/).

ALTER VIEW public.trending_athletes_view RESET (security_barrier);

CREATE OR REPLACE VIEW public.trending_athletes_view AS
 WITH recent_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_last_7d
           FROM recruiter_athlete_views
          WHERE (recruiter_athlete_views.viewed_at >= (now() - '7 days'::interval))
          GROUP BY recruiter_athlete_views.athlete_id
        ), prior_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_prior_7d
           FROM recruiter_athlete_views
          WHERE ((recruiter_athlete_views.viewed_at >= (now() - '14 days'::interval)) AND (recruiter_athlete_views.viewed_at < (now() - '7 days'::interval)))
          GROUP BY recruiter_athlete_views.athlete_id
        ), recent_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_last_7d
           FROM recruiter_favorites
          WHERE (recruiter_favorites.created_at >= (now() - '7 days'::interval))
          GROUP BY recruiter_favorites.athlete_id
        ), prior_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_prior_7d
           FROM recruiter_favorites
          WHERE ((recruiter_favorites.created_at >= (now() - '14 days'::interval)) AND (recruiter_favorites.created_at < (now() - '7 days'::interval)))
          GROUP BY recruiter_favorites.athlete_id
        )
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.cote_globale_entraineur,
    sch.region,
    sch.name AS school_name,
    a.annee_diplomation,
    s.nom AS sport_name,
    COALESCE(rv.views_last_7d, (0)::bigint) AS views_7d,
    COALESCE(pv.views_prior_7d, (0)::bigint) AS views_prior_7d,
    (COALESCE(rv.views_last_7d, (0)::bigint) - COALESCE(pv.views_prior_7d, (0)::bigint)) AS views_delta,
    COALESCE(rfv.favs_last_7d, (0)::bigint) AS favs_7d,
    COALESCE(pf.favs_prior_7d, (0)::bigint) AS favs_prior_7d,
    (COALESCE(rfv.favs_last_7d, (0)::bigint) - COALESCE(pf.favs_prior_7d, (0)::bigint)) AS favs_delta,
    a.sport_id,
    a.position_id
   FROM ((((((athletes a
     LEFT JOIN sports s ON ((s.id = a.sport_id)))
     LEFT JOIN schools sch ON ((sch.id = a.school_id)))
     LEFT JOIN recent_views rv ON ((rv.athlete_id = a.id)))
     LEFT JOIN prior_views pv ON ((pv.athlete_id = a.id)))
     LEFT JOIN recent_favs rfv ON ((rfv.athlete_id = a.id)))
     LEFT JOIN prior_favs pf ON ((pf.athlete_id = a.id)))
  WHERE is_partner_eligible_athlete(a.id);
