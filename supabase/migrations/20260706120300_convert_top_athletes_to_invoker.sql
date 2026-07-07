-- Convertit top_athletes_view en security_invoker=true.
-- Réf : docs/security-definer-partner-views-investigation-20260706.md (§D)
--
-- Sûreté : la vue ne lit que des tables couvertes pour un partenaire approuvé
-- sous RLS normale :
--   athletes    → policy « Approved partners read opted-in athletes »
--                 (opt_in = true AND is_approved_partner(auth.uid()))
--   evaluations → policy « authenticated read evaluations »
--   sports/positions/schools → référentiels lisibles
-- Le prédicat is_partner_eligible_athlete(a.id) de la vue reste évalué. Un
-- non-partenaire perd l'accès (resserrement), un partenaire approuvé garde le
-- même ensemble d'athlètes.
--
-- PRÉREQUIS EMPIRIQUE : media_partners.status = 'APPROVED' pour le compte
-- partenaire (sinon is_approved_partner() = false → 0 ligne). À valider par un
-- smoke test dashboard partenaire après application.
--
-- Rollback : supabase/rollback/20260706120300_rollback_convert_top_athletes.sql

ALTER VIEW public.top_athletes_view SET (security_invoker = true);

COMMENT ON VIEW public.top_athletes_view IS
  'security_invoker=true depuis 2026-07-06 (audit securite pre-launch). Les '
  'partenaires approuves lisent via la policy athletes "Approved partners read '
  'opted-in athletes" ; evaluations via "authenticated read evaluations".';
