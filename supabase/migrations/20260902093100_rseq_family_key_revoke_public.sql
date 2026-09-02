-- 20260902093100_rseq_family_key_revoke_public.sql
-- ============================================================================
-- Suite immédiate de 20260902093000. La vérification d'après-apply a montré
-- que `rseq_family_key` restait exécutable par `anon` — alors que le REVOKE
-- nominatif avait bien porté.
--
-- L'ACL disait pourquoi :
--   rseq_family_key      {=X/postgres, postgres=X/…, authenticated=X/…, service_role=X/…}
--   rseq_sync_apply_games {postgres=X/…, service_role=X/…}
--
-- Le `=X/postgres` en tête, sans rôle nommé à gauche, c'est PUBLIC. `anon`
-- n'avait plus de grant propre mais héritait par là. Les cinq fonctions
-- d'écriture, elles, avaient reçu un `revoke all … from public` dans leur
-- migration d'origine : leur ACL est propre.
--
-- Deux couches, deux gestes — il faut LES DEUX, et c'est la leçon à retenir
-- du correctif précédent :
--   1. `revoke … from anon, authenticated` — les grants explicites que
--      Supabase pose par défaut sur toute fonction neuve ;
--   2. `revoke … from public` — la couche héritée.
--
-- `authenticated` conserve son grant explicite : la vue
-- `rseq_ligues_a_appeler` est en `security_invoker` et appelle cette
-- fonction. La lui retirer casserait la lecture de la vue sans rien
-- protéger — c'est une fonction pure sur deux `text`.
-- ============================================================================

revoke execute on function public.rseq_family_key(text, text) from public;
grant execute on function public.rseq_family_key(text, text) to authenticated, service_role;
