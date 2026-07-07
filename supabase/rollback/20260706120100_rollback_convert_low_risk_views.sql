-- ROLLBACK d'urgence de 20260706120100_convert_low_risk_views_to_invoker.sql
--
-- ⚠️ NE PAS placer dans supabase/migrations/ — ce dossier est ignoré par la CLI
-- Supabase (sinon ce rollback s'appliquerait automatiquement et annulerait la
-- conversion). Appliquer MANUELLEMENT en cas de régression :
--   - via Supabase MCP execute_sql, ou
--   - psql, ou
--   - copier dans une nouvelle migration horodatée si on veut le versionner.

ALTER VIEW public.athlete_coaches         SET (security_invoker = false);
ALTER VIEW public.athlete_views_weekly     SET (security_invoker = false);
ALTER VIEW public.athlete_visibility_stats SET (security_invoker = false);
