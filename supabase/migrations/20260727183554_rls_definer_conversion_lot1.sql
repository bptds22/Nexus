-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — version 20260727183554
--
-- Cette migration a été APPLIQUÉE EN PROD le 2026-07-27 via execute_sql, sans
-- fichier dans le dépôt. Enregistrée dans schema_migrations sous
-- `20260727183554 | rls_definer_conversion_lot1`.
--
-- Ce fichier est reconstruit PAR LECTURE DU CATALOGUE PROD (2026-07-30) :
-- pg_get_functiondef() pour les helpers, pg_policies pour les policies. Le
-- périmètre a été établi en diffant public._rls_backup_20260727 (état AVANT,
-- capturé à 18:33:38) contre pg_policies (état actuel), puis en retirant les
-- objets attribuables à d'autres migrations (voir « HORS PÉRIMÈTRE » plus bas).
-- Le compte obtenu — 15 policies / 9 tables — correspond exactement à ce que
-- docs/flip-day-ledger.md attribue à cette migration.
--
-- CONTENU : conversion des sous-requêtes RLS inline en appels de helpers
-- SECURITY DEFINER (opaques au planner, pas de récursion RLS).
--   sous-requête « athlete m'appartient »        -> is_own_athlete(uuid)
--   sous-requête « je suis le coach de l'athlète » -> is_coach_of_athlete(uuid)
--
-- HORS PÉRIMÈTRE — à ne pas rapatrier ici :
--   • evaluations / « authenticated read evaluations » apparaît aussi dans le
--     diff backup↔prod, mais sa forme ACTUELLE est celle posée plus tard par
--     20260728181155 (evaluations_coach_reads_managed), dont le fichier existe
--     déjà : supabase/migrations/20260729120000_evaluations_coach_reads_managed.sql
--     (préfixe fichier ≠ version enregistrée — dette distincte, hors de ce lot).
--     Sa forme INTERMÉDIAIRE au moment du lot 1 n'est pas récupérable depuis
--     prod (prod ne garde que l'état final) : on ne l'invente pas. La rejouer
--     ici casserait d'ailleurs la chaîne, coach_can_read_athlete_evals()
--     n'existant pas encore à cet instant.
--   • team_invitations (5 policies) -> lot 2, fichier 20260727204403.
--
-- IDEMPOTENT : CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS / CREATE POLICY.
-- ═══════════════════════════════════════════════════════════════

-- ── Helpers SECURITY DEFINER ────────────────────────────────────
-- Copie conforme de pg_get_functiondef() en prod (2026-07-30).
-- Aucun de ces deux helpers n'existe dans un fichier de migration du dépôt :
-- ils ne sont référencés que par docs/flip-day-ledger.md.

CREATE OR REPLACE FUNCTION public.is_own_athlete(target_athlete uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists (select 1 from athletes a
                     where a.id = target_athlete and a.user_id = (select auth.uid())) $function$;

CREATE OR REPLACE FUNCTION public.is_coach_of_athlete(target_athlete uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists (select 1 from athletes a
                     where a.id = target_athlete and a.coach_id = (select auth.uid())) $function$;

-- Privilèges tels qu'observés en prod : EXECUTE pour anon, authenticated,
-- service_role (proacl = postgres=X | anon=X | authenticated=X | service_role=X).
-- Reproduit à l'identique — ce n'est PAS une version « améliorée » : un REVOKE
-- anon serait un durcissement, donc une divergence.
GRANT EXECUTE ON FUNCTION public.is_own_athlete(uuid)     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_coach_of_athlete(uuid) TO anon, authenticated, service_role;

-- ── 1. _deprecated_profile_views_2026_05 (2 policies) ───────────
DROP POLICY IF EXISTS "Athletes read own views" ON public._deprecated_profile_views_2026_05;
CREATE POLICY "Athletes read own views" ON public._deprecated_profile_views_2026_05
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches read views for their athletes" ON public._deprecated_profile_views_2026_05;
CREATE POLICY "Coaches read views for their athletes" ON public._deprecated_profile_views_2026_05
  AS PERMISSIVE FOR SELECT TO public
  USING (is_coach_of_athlete(athlete_id));

-- ── 2. athlete_notifications (2 policies) ───────────────────────
DROP POLICY IF EXISTS "Athletes read own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes read own notifications" ON public.athlete_notifications
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

-- with_check est NULL en prod : sur un UPDATE, l'omission fait retomber le
-- WITH CHECK sur l'expression USING. On omet donc la clause, à l'identique.
DROP POLICY IF EXISTS "Athletes update own notifications" ON public.athlete_notifications;
CREATE POLICY "Athletes update own notifications" ON public.athlete_notifications
  AS PERMISSIVE FOR UPDATE TO public
  USING (is_own_athlete(athlete_id));

-- ── 3. athlete_suggestions (3 policies) ─────────────────────────
DROP POLICY IF EXISTS "Athletes can read own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes can read own suggestions" ON public.athlete_suggestions
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_coach_of_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_coach_of_athlete(athlete_id));

-- ── 4. partner_card_downloads (1 policy) ────────────────────────
DROP POLICY IF EXISTS "Athletes read their own card downloads" ON public.partner_card_downloads;
CREATE POLICY "Athletes read their own card downloads" ON public.partner_card_downloads
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

-- ── 5. partner_profile_views (1 policy) ─────────────────────────
DROP POLICY IF EXISTS "Athletes read their own profile views" ON public.partner_profile_views;
CREATE POLICY "Athletes read their own profile views" ON public.partner_profile_views
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

-- ── 6. recruiter_activity_log (1 policy) ────────────────────────
DROP POLICY IF EXISTS "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log;
CREATE POLICY "Coaches read activity for their claimed athletes" ON public.recruiter_activity_log
  AS PERMISSIVE FOR SELECT TO public
  USING (is_coach_of_athlete(athlete_id));

-- ── 7. recruiter_athlete_views (2 policies) ─────────────────────
DROP POLICY IF EXISTS "Coaches read views for their athletes" ON public.recruiter_athlete_views;
CREATE POLICY "Coaches read views for their athletes" ON public.recruiter_athlete_views
  AS PERMISSIVE FOR SELECT TO public
  USING (is_coach_of_athlete(athlete_id));

-- Nom en minuscules en prod — conservé tel quel (les noms de policy sont
-- sensibles à la casse et un « Athletes » majuscule créerait un doublon).
DROP POLICY IF EXISTS "athletes read own views" ON public.recruiter_athlete_views;
CREATE POLICY "athletes read own views" ON public.recruiter_athlete_views
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

-- ── 8. recruiter_favorites (2 policies) ─────────────────────────
DROP POLICY IF EXISTS "Athletes read own favorites" ON public.recruiter_favorites;
CREATE POLICY "Athletes read own favorites" ON public.recruiter_favorites
  AS PERMISSIVE FOR SELECT TO public
  USING (is_own_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches read favorites for their athletes" ON public.recruiter_favorites;
CREATE POLICY "Coaches read favorites for their athletes" ON public.recruiter_favorites
  AS PERMISSIVE FOR SELECT TO public
  USING (is_coach_of_athlete(athlete_id));

-- ── 9. recruiter_pipeline (1 policy) ────────────────────────────
DROP POLICY IF EXISTS "coaches read pipeline for own athletes" ON public.recruiter_pipeline;
CREATE POLICY "coaches read pipeline for own athletes" ON public.recruiter_pipeline
  AS PERMISSIVE FOR SELECT TO public
  USING (is_coach_of_athlete(athlete_id));
