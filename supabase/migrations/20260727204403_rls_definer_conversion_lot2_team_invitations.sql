-- ═══════════════════════════════════════════════════════════════
-- MIROIR DE RATTRAPAGE — version 20260727204403
--
-- Cette migration a été APPLIQUÉE EN PROD le 2026-07-27 via execute_sql, sans
-- fichier dans le dépôt. Enregistrée dans schema_migrations sous
-- `20260727204403 | rls_definer_conversion_lot2_team_invitations`.
--
-- Ce fichier est reconstruit PAR LECTURE DU CATALOGUE PROD (2026-07-30) :
-- pg_get_functiondef() pour le helper, pg_policies pour les 5 policies.
-- Périmètre confirmé par diff public._rls_backup_20260727 ↔ pg_policies :
-- les 5 policies de team_invitations sont les seules de cette table à avoir
-- changé depuis la capture du 2026-07-27 18:33:38.
--
-- ⚠️ NE COUVRE QUE team_invitations. Le ledger (docs/flip-day-ledger.md)
-- appelle ce lot « LOT 2a » et note que le lot 2 complet — les 32 policies à
-- sous-requête inline restantes — n'a JAMAIS été appliqué nulle part. Ce fichier
-- ne reflète donc que ce qui est réellement en prod, pas l'intention du lot 2.
--
-- CONTENU : mêmes helpers DEFINER que le lot 1, plus coach_manages_team().
-- La clause métier `status = ANY (ARRAY['ACCEPTED','REJECTED'])` du WITH CHECK
-- de « Athletes update own invitations » est PRÉSERVÉE — c'est le point de
-- vérification n°3 du ledger.
--
-- IDEMPOTENT : CREATE OR REPLACE FUNCTION + DROP POLICY IF EXISTS / CREATE POLICY.
-- ═══════════════════════════════════════════════════════════════

-- ── Helper SECURITY DEFINER ─────────────────────────────────────
-- Copie conforme de pg_get_functiondef() en prod (2026-07-30). Absent de tout
-- fichier de migration du dépôt : seul docs/flip-day-ledger.md le mentionne.
-- Deux branches : coach membre de l'équipe (team_coaches) OU directeur /
-- directeur intérimaire de l'école qui porte l'équipe (school_coaches ⋈ teams).

CREATE OR REPLACE FUNCTION public.coach_manages_team(target_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from team_coaches tc
    where tc.coach_id = (select auth.uid()) and tc.team_id = target_team
  ) or exists (
    select 1 from school_coaches sc
    join teams t on t.school_id = sc.school_id
    where sc.coach_id = (select auth.uid())
      and t.id = target_team
      and sc.role = any (array['DIRECTEUR','DIRECTEUR_INTERIM']::coach_school_role[])
  )
$function$;

-- Privilèges tels qu'observés en prod (proacl = postgres=X | anon=X |
-- authenticated=X | service_role=X). Reproduit à l'identique.
GRANT EXECUTE ON FUNCTION public.coach_manages_team(uuid) TO anon, authenticated, service_role;

-- ── team_invitations : 5 policies ───────────────────────────────

DROP POLICY IF EXISTS "Athletes select own invitations" ON public.team_invitations;
CREATE POLICY "Athletes select own invitations" ON public.team_invitations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_own_athlete(athlete_id));

-- WITH CHECK explicite en prod (non NULL) : la clause statut est portée par le
-- WITH CHECK, pas par le USING. Reproduit tel quel.
DROP POLICY IF EXISTS "Athletes update own invitations" ON public.team_invitations;
CREATE POLICY "Athletes update own invitations" ON public.team_invitations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_own_athlete(athlete_id))
  WITH CHECK ((is_own_athlete(athlete_id) AND (status = ANY (ARRAY['ACCEPTED'::text, 'REJECTED'::text]))));

DROP POLICY IF EXISTS "Coaches cancel own invitations" ON public.team_invitations;
CREATE POLICY "Coaches cancel own invitations" ON public.team_invitations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (coach_manages_team(team_id))
  WITH CHECK (coach_manages_team(team_id));

DROP POLICY IF EXISTS "Coaches insert invitations on own teams" ON public.team_invitations;
CREATE POLICY "Coaches insert invitations on own teams" ON public.team_invitations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (coach_manages_team(team_id));

DROP POLICY IF EXISTS "Coaches select invitations on own teams" ON public.team_invitations;
CREATE POLICY "Coaches select invitations on own teams" ON public.team_invitations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (coach_manages_team(team_id));

-- Note : la policy « Admins manage all invitations » (FOR ALL, is_admin(), sans
-- sous-requête) n'est PAS touchée — conforme au ledger et au catalogue prod.
