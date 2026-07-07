-- ROLLBACK d'urgence de 20260706120300_convert_top_athletes_to_invoker.sql
-- Rétablit le mode SECURITY DEFINER sur top_athletes_view.
-- À appliquer MANUELLEMENT (hors supabase/migrations/).

ALTER VIEW public.top_athletes_view SET (security_invoker = false);
