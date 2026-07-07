-- ROLLBACK d'urgence de 20260706130000_harden_top_athletes_view.sql
-- Restaure l'état post-120300 : security_invoker=true SANS le gate
-- is_approved_partner (WHERE is_partner_eligible_athlete seul).
-- À appliquer MANUELLEMENT (hors supabase/migrations/).

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
  WHERE is_partner_eligible_athlete(a.id)
  ORDER BY a.cote_globale_entraineur DESC;
