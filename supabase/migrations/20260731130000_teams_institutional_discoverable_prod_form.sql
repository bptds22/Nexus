-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — policy « Institutional teams discoverable during
-- onboarding » sur public.teams (forme PROD)
--
-- ⚠️ PRÉFIXE NEUF, COMME POUR 20260731120000, ET POUR LA MÊME RAISON.
-- Cette policy n'est enregistrée sous AUCUNE version de
-- supabase_migrations.schema_migrations : elle résulte d'un apply hors
-- migration. Il n'y a donc pas de version existante à réutiliser comme préfixe.
-- 20260731130000 a été vérifié libre partout avant usage :
--   • absent de supabase_migrations.schema_migrations (max = 20260729194041)
--   • absent de supabase/migrations/ sur dev
--   • absent de supabase/migrations/ sur origin/feat/messaging-athlete-coach
--   • absent du disque
--
-- ── LE FAIT ────────────────────────────────────────────────────
-- État PROD constaté le 2026-07-30 (pg_policy, rôles résolus) :
--   polname     : Institutional teams discoverable during onboarding
--   polcmd      : SELECT            polpermissive : true
--   polroles    : {authenticated}   (aucun pseudo-rôle PUBLIC/0)
--   USING       : (EXISTS ( SELECT 1
--                    FROM schools s
--                   WHERE ((s.id = teams.school_id)
--                      AND (s.type = ANY (ARRAY['CEGEP'::text, 'SECONDAIRE'::text])))))
--   WITH CHECK  : NULL
--   COMMENT     : aucun
--   md5(USING sans blancs) = e8fea4d709c99aa4372c5c22b4e7494a
--
-- ── ORPHELINE ABSOLUE ──────────────────────────────────────────
-- `grep "Institutional teams discoverable"` sur les 239 fichiers de
-- supabase/migrations/ des deux refs (dev + origin/feat/messaging-athlete-coach)
-- ne renvoie RIEN. Aucun fichier ne l'a jamais créée. C'est la seule policy de
-- prod, sur les 278 du schéma public, dans ce cas — toutes les autres sont
-- produites par au moins un fichier (vérifié au gate du 2026-07-30 ; le cas
-- _deprecated_profile_views_2026_05 s'explique par un RENAME de table, ses
-- policies venant du baseline sous l'ancien nom profile_views).
--
-- ── RECOUVREMENT FONCTIONNEL — À SAVOIR AVANT DE TOUCHER À CETTE POLICY ──
-- Elle expose en lecture les teams des écoles de type CEGEP **ET** SECONDAIRE.
-- Deux policies VERSIONNÉES couvrent déjà chacune une moitié de ce périmètre :
--
--   • « Cegep teams readable for search »
--     -> supabase/migrations/20260728161531_cegep_teams_readable_for_search.sql
--     -> USING : EXISTS (… s.id = teams.school_id AND s.type = 'CEGEP')
--
--   • « Secondary teams readable for onboarding »
--     -> supabase/migrations/20260607150000_teams_onboarding_readable.sql
--     -> USING : EXISTS (… s.id = teams.school_id AND s.type = 'SECONDAIRE')
--
-- Les policies PERMISSIVE se combinent en OR : à elles trois, elles rendent le
-- même ensemble de lignes que les deux versionnées seules. La présente policy
-- est donc, en l'état actuel du schéma, REDONDANTE — elle n'élargit rien.
-- Ce fichier ne tranche PAS s'il faut la garder ou la supprimer : il la fige
-- telle qu'elle est en prod, pour que toute reconstruction (db reset, base
-- neuve, probe local) parte du même état que prod. Le nettoyage éventuel est
-- une décision séparée et assumée, pas ce fichier-ci.
--
-- ── PORTÉE ─────────────────────────────────────────────────────
-- TO authenticated : anon est exclu. Reproduit tel quel — ne PAS omettre la
-- clause TO, qui retomberait sur PUBLIC et élargirait la portée à anon.
--
-- IDEMPOTENT : DROP POLICY IF EXISTS / CREATE POLICY.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Institutional teams discoverable during onboarding" ON public.teams;
CREATE POLICY "Institutional teams discoverable during onboarding" ON public.teams
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
     FROM schools s
    WHERE ((s.id = teams.school_id) AND (s.type = ANY (ARRAY['CEGEP'::text, 'SECONDAIRE'::text]))))));
