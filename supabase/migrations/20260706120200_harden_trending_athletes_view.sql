-- Durcit trending_athletes_view SANS la convertir en INVOKER.
-- Réf : docs/security-definer-partner-views-investigation-20260706.md
--
-- Pourquoi KEEP SECURITY DEFINER : la vue agrège recruiter_athlete_views et
-- recruiter_favorites, tables qui n'ont AUCUNE policy RLS pour le rôle
-- partenaire. Une conversion en security_invoker ferait tomber toutes les
-- métriques (views/favs deltas) à 0 → « Tendances » cassé. Le DEFINER est donc
-- intentionnel pour permettre l'agrégation.
--
-- Trou fermé ici : REVOKE anon (migration 20260706120000) ne suffit pas car le
-- rôle `authenticated` inclut athlètes/coachs/recruteurs. On ajoute un GATE
-- APPELANT dans le WHERE : is_approved_partner(auth.uid()). auth.uid() lit le
-- JWT de l'appelant (indépendant de DEFINER/INVOKER), donc un non-partenaire
-- obtient 0 ligne, un partenaire approuvé garde le comportement complet.
--
-- security_barrier=true : empêche qu'un opérateur/fonction fourni par l'appelant
-- soit évalué avant le gate (anti-fuite via réordonnancement des quals).
--
-- Rollback : supabase/rollback/20260706120200_rollback_harden_trending.sql

CREATE OR REPLACE VIEW public.trending_athletes_view
  WITH (security_barrier = true) AS
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
  WHERE (is_partner_eligible_athlete(a.id) AND is_approved_partner(auth.uid()));

COMMENT ON VIEW public.trending_athletes_view IS
  'SECURITY DEFINER intentionnel (audit 2026-07-06) : agrege '
  'recruiter_athlete_views/recruiter_favorites, aucune policy RLS partenaire ne '
  'couvre ces tables de tracking (une conversion INVOKER mettrait les metriques '
  'a 0). Acces restreint via REVOKE anon + gate is_approved_partner(auth.uid()) '
  'dans le WHERE + security_barrier. Revoir si une RLS partenaire est ajoutee '
  'aux tables de tracking.';
