-- Retire l'accès anonyme aux 5 vues SECURITY DEFINER.
-- Réf : docs/security-definer-audit-20260706.md
--
-- Motif : ces vues (DEFINER) contournent la RLS et étaient accessibles au rôle
-- `anon` via l'API PostgREST publique. Aucun caller anonyme légitime identifié
-- en Phase B de l'audit — les dashboards athlète et partenaire sont tous
-- authentifiés (rôle `authenticated`).
--
-- Rollback : GRANT SELECT ON public.<view> TO anon;

REVOKE ALL ON public.athlete_coaches          FROM anon;
REVOKE ALL ON public.athlete_views_weekly     FROM anon;
REVOKE ALL ON public.athlete_visibility_stats FROM anon;
REVOKE ALL ON public.top_athletes_view        FROM anon;
REVOKE ALL ON public.trending_athletes_view   FROM anon;

-- Filet : garantir que `authenticated` conserve le SELECT (accès légitime).
GRANT SELECT ON public.athlete_coaches          TO authenticated;
GRANT SELECT ON public.athlete_views_weekly     TO authenticated;
GRANT SELECT ON public.athlete_visibility_stats TO authenticated;
GRANT SELECT ON public.top_athletes_view        TO authenticated;
GRANT SELECT ON public.trending_athletes_view   TO authenticated;
