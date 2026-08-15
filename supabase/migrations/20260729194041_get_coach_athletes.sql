-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — version 20260729194041
--
-- Cette migration a été APPLIQUÉE EN PROD le 2026-07-29 à 19:40:41 via
-- execute_sql, sans fichier dans le dépôt. Enregistrée dans schema_migrations
-- sous `20260729194041 | get_coach_athletes`.
--
-- Ce fichier est reconstruit PAR LECTURE DU CATALOGUE PROD (2026-07-30) :
-- pg_get_functiondef(), prosecdef, proconfig, proacl. Aucune retouche.
--
-- ⚠️ ORPHELINE ABSOLUE : `git log --all --diff-filter=A -- "supabase/migrations/*get_coach_athletes*"`
-- ne renvoie RIEN. Aucune ref du dépôt (dev, feat/messaging-athlete-coach,
-- origin/*) n'a jamais porté de fichier pour cette migration. Elle n'existait
-- donc que dans prod avant ce miroir. Le commit qui décrit son effet côté
-- produit est `0d0247d fix(autorité équipe): les 3 rôles d'équipe voient les
-- athlètes de l'équipe (owned+team)`, sur origin/feat/messaging-athlete-coach.
--
-- CE QUE FAIT LA FONCTION — trois chemins d'accès, réunis par OR :
--   OWNER  : athletes.coach_id = auth.uid()
--   TEAM   : team_athletes ⋈ team_coaches sur auth.uid()
--            → AUCUN filtre sur team_coaches.role : head_coach, assistant et
--              coordinator ont exactement la même portée.
--   SCHOOL : école dont auth.uid() est DIRECTEUR / DIRECTEUR_INTERIM
-- La colonne `relation` est un CASE ORDONNÉ : OWNER l'emporte sur TEAM, et
-- SCHOOL est la branche ELSE (donc aussi le fourre-tout des cas non classés).
--
-- prosecdef = true (SECURITY DEFINER), proconfig = {search_path=public},
-- provolatile = 's' (STABLE), LANGUAGE sql.
--
-- IDEMPOTENT : CREATE OR REPLACE FUNCTION.
-- ⚠️ La signature inclut un DEFAULT. Un futur changement de signature exigera
-- un DROP FUNCTION explicite — CREATE OR REPLACE ne suffira pas.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_coach_athletes(p_include_pending boolean DEFAULT true)
 RETURNS TABLE(athlete_id uuid, relation text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  team_ath AS (
    SELECT DISTINCT ta.athlete_id
    FROM public.team_athletes ta
    JOIN public.team_coaches tc ON tc.team_id = ta.team_id
    JOIN me ON tc.coach_id = me.uid
  ),
  dir_schools AS (
    SELECT sc.school_id
    FROM public.school_coaches sc
    JOIN me ON sc.coach_id = me.uid
    WHERE sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
  SELECT
    a.id AS athlete_id,
    CASE
      WHEN a.coach_id = (SELECT uid FROM me)              THEN 'OWNER'
      WHEN a.id IN (SELECT athlete_id FROM team_ath)      THEN 'TEAM'
      ELSE 'SCHOOL'
    END AS relation,
    a.status::text AS status
  FROM public.athletes a
  WHERE a.status::text = ANY (
          CASE WHEN p_include_pending
               THEN ARRAY['ACTIF', 'EN_ATTENTE']
               ELSE ARRAY['ACTIF'] END)
    AND (
          a.coach_id = (SELECT uid FROM me)
       OR a.id IN (SELECT athlete_id FROM team_ath)
       OR a.school_id IN (SELECT school_id FROM dir_schools)
    );
$function$;

-- Privilèges tels qu'observés en prod :
--   proacl = postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- anon est ABSENT — c'est l'état prod, on le reproduit explicitement plutôt que
-- de compter sur le défaut PUBLIC de PostgreSQL (qui, lui, donnerait anon).
REVOKE ALL ON FUNCTION public.get_coach_athletes(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_coach_athletes(boolean) TO authenticated, service_role;
