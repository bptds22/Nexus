-- ════════════════════════════════════════════════════════════════════
-- set_initial_role_and_context_revoke_anon
--
-- RÉCONCILIATION : reproduit l'enregistrement RÉEL appliqué sur le cloud
-- (schema_migrations version 20260625012739). Retire l'accès anon à la RPC
-- set_initial_role_and_context (réservée aux comptes authentifiés). Suit le
-- CREATE+GRANT de 20260625012518.
-- ════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.set_initial_role_and_context(text, text) FROM anon;
