-- Convertit 3 vues SECURITY DEFINER en security_invoker=true.
-- La RLS des tables sous-jacentes prend le relais (vérifié — audit Phase B).
-- Réf : docs/security-definer-audit-20260706.md
--
-- Prérequis : migration 20260706120000 (REVOKE anon) appliquée d'abord.
--
-- Sûreté (audit Phase B) :
--   athlete_coaches         → orpheline (aucun caller) : conversion sans impact.
--   athlete_views_weekly    → l'athlète lit ses propres vues via la policy
--                             « athletes read own views » (recruiter_athlete_views).
--   athlete_visibility_stats→ idem + « Athletes read own favorites »
--                             (recruiter_favorites).
--
-- NON incluses ici (traitées séparément) : top_athletes_view (CONVERT sûr, à
-- pousser après validation) et trending_athletes_view (CONVERT casserait les
-- métriques — pas de policy partenaire sur les tables de tracking). Voir
-- docs/security-definer-partner-views-investigation-20260706.md.
--
-- Rollback : voir supabase/rollback/20260706120100_rollback_convert_low_risk_views.sql

ALTER VIEW public.athlete_coaches         SET (security_invoker = true);
ALTER VIEW public.athlete_views_weekly     SET (security_invoker = true);
ALTER VIEW public.athlete_visibility_stats SET (security_invoker = true);

COMMENT ON VIEW public.athlete_coaches IS
  'security_invoker=true depuis 2026-07-06 (audit securite pre-launch). RLS de '
  'team_athletes/teams/team_coaches gouverne l''acces. Aucun caller identifie a '
  'l''audit (candidate au DROP).';
COMMENT ON VIEW public.athlete_views_weekly IS
  'security_invoker=true depuis 2026-07-06 (audit securite pre-launch). '
  'L''athlete lit ses propres vues via la policy "athletes read own views" sur '
  'recruiter_athlete_views.';
COMMENT ON VIEW public.athlete_visibility_stats IS
  'security_invoker=true depuis 2026-07-06 (audit securite pre-launch). '
  'L''athlete lit ses propres stats via "athletes read own views" '
  '(recruiter_athlete_views) et "Athletes read own favorites" (recruiter_favorites).';
