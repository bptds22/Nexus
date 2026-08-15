-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — version 20260727183338
--
-- Cette migration a été APPLIQUÉE EN PROD le 2026-07-27 18:33:38 UTC via
-- execute_sql, sans jamais avoir de fichier dans le dépôt. Elle est
-- enregistrée dans supabase_migrations.schema_migrations sous
-- `20260727183338 | rls_backup_before_definer_conversion`.
--
-- Ce fichier est reconstruit PAR LECTURE DU CATALOGUE PROD (2026-07-30).
-- Il ne « corrige » rien : il reproduit l'état prod tel quel.
--
-- OBJET PERSISTANT LAISSÉ EN PROD : OUI — la table public._rls_backup_20260727
-- existe toujours (vérifié : to_regclass('public._rls_backup_20260727') non NULL).
--
-- ⚠️ LIMITE CONNUE — LES DONNÉES NE SONT PAS REJOUABLES.
-- La table contient 47 lignes capturées à un instant précis
-- (captured_at = 2026-07-27 18:33:38.110016+00, un seul horodatage distinct),
-- soit les corps de policies AVANT la conversion DEFINER, sur 18 tables :
--   _deprecated_profile_views_2026_05, athlete_notifications,
--   athlete_suggestions, athlete_targets, athletes, conversations,
--   evaluations, messages, partner_card_downloads, partner_profile_views,
--   recruiter_activity_log, recruiter_athlete_views, recruiter_favorites,
--   recruiter_pipeline, school_coaches, team_athletes, team_invitations, users
-- Ces policies ont depuis été réécrites : un SELECT sur pg_policies aujourd'hui
-- ne redonnerait PAS le même contenu. Cette migration recrée donc la STRUCTURE
-- et les métadonnées, jamais les 47 lignes. Sur une base neuve (db reset), la
-- table sera vide — c'est le comportement voulu et assumé : le contenu est une
-- pièce d'archive propre à nexus-prod, pas un état de schéma.
--
-- NE PAS SUPPRIMER la table en prod : elle est le kit de revert des lots 1 et 2.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public._rls_backup_20260727 (
  schemaname  name,
  tablename   name,
  policyname  name,
  permissive  text,
  roles       name[],
  cmd         text,
  qual        text,
  with_check  text,
  captured_at timestamp with time zone
);

COMMENT ON TABLE public._rls_backup_20260727 IS
  'Backup des corps de policies AVANT la conversion DEFINER du 2026-07-27. Sert a regenerer les CREATE POLICY d origine. Ne pas supprimer avant validation complete.';

-- État prod : RLS activée, AUCUNE policy (donc inaccessible à anon/authenticated ;
-- seuls postgres et service_role, qui ont BYPASSRLS, y accèdent).
ALTER TABLE public._rls_backup_20260727 ENABLE ROW LEVEL SECURITY;

-- État prod des privilèges : postgres=arwdDxtm/postgres, service_role=arwdDxtm/postgres.
-- Aucun GRANT à anon ni authenticated — on ne fait qu'expliciter l'absence.
REVOKE ALL ON TABLE public._rls_backup_20260727 FROM anon, authenticated;
GRANT ALL ON TABLE public._rls_backup_20260727 TO service_role;
