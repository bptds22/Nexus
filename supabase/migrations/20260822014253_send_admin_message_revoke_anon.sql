-- Messagerie admin — correctif de la migration 2.
--
-- REVOKE ALL ... FROM PUBLIC ne retire PAS le grant explicite que les
-- default privileges Supabase posent pour `anon` sur toute fonction neuve.
-- send_admin_message se retrouvait donc avec anon=X, contrairement à
-- send_broadcast et à la convention du dépôt (cf. migrations
-- revoke_anon_on_definer_views, consume_athlete_invitation_revoke_anon,
-- set_initial_role_and_context_revoke_anon, revoke_anon_on_recruiter_rpcs).
--
-- Aucune exposition n'existait : le premier test de la fonction est
-- « auth.uid() IS NULL -> RAISE 42501 ». C'est de la défense en profondeur
-- et de la conformité, pas la fermeture d'une brèche.

REVOKE EXECUTE ON FUNCTION public.send_admin_message(jsonb, text) FROM anon;
