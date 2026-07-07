-- Durcit top_athletes_view : ajoute le gate appelant is_approved_partner(auth.uid()).
-- Réf : docs/security-definer-audit-20260706.md §7
--
-- Contexte : après 20260706120300 (convert invoker), un athlète non-partenaire
-- pouvait encore voir SA PROPRE ligne dans cette vue (via la policy athletes
-- « athletes can read own profile ») — pas une fuite (aucun autre athlète, aucune
-- UI athlète ne lit cette vue), mais incohérent avec trending_athletes_view.
--
-- Ici : on RESTE en security_invoker=true (contrairement à trending qui a gardé
-- DEFINER) — la RLS athletes couvre déjà le partenaire — et on ajoute le même
-- gate appelant que trending pour qu'un non-partenaire voie 0 ligne.
--
-- Définition reprise à l'identique de l'état courant, seul le WHERE change.
-- Rollback : supabase/rollback/20260706130000_rollback_harden_top.sql

CREATE OR REPLACE VIEW public.top_athletes_view
  WITH (security_invoker = true) AS
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.cote_globale_entraineur,
    a.annee_diplomation,
    sch.region,
    a.sport_id,
    a.position_id,
    a.school_id,
    a.photo_url,
    s.nom AS sport_name,
    p.nom AS position_name,
    sch.name AS school_name,
    e.distinctions,
    a.video_faits_saillants_url,
    a.video_match_complet_url,
    a.video_entrainement_url
   FROM ((((athletes a
     LEFT JOIN sports s ON ((s.id = a.sport_id)))
     LEFT JOIN positions p ON ((p.id = a.position_id)))
     LEFT JOIN schools sch ON ((sch.id = a.school_id)))
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM evaluations
          WHERE (evaluations.athlete_id = a.id)
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON (true))
  WHERE (is_partner_eligible_athlete(a.id) AND is_approved_partner(auth.uid()))
  ORDER BY a.cote_globale_entraineur DESC;

COMMENT ON VIEW public.top_athletes_view IS
  'security_invoker=true + gate is_approved_partner(auth.uid()) depuis 2026-07-07 '
  '(audit securite pre-launch, cf. docs/security-definer-audit-20260706.md sec.7). '
  'RLS athletes "Approved partners read opted-in" couvre l''acces ; le gate assure '
  'qu''un non-partenaire voit 0 ligne (coherence avec trending_athletes_view).';
