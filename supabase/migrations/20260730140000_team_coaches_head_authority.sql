-- ═══════════════════════════════════════════════════════════════
-- #3 : gestion staff d'équipe par le head coach (« new row violates RLS »).
--
-- Bug prouvé : un HEAD COACH qui ajoute un autre coach (ex. le directeur) à SON
-- équipe est refusé — la policy INSERT team_coaches n'autorise que self-add
-- (coach_id=auth.uid()) ou un directeur-caller (is_director_of_team_school). Il
-- manque la branche « le head coach gère le staff de son équipe ».
-- (Le directeur-caller, lui, passait déjà : self-add ✅, add autrui ✅, update ✅.)
--
-- Fix : helper is_team_head_coach (DEFINER, opaque, REVOKE anon) ajouté en OR à
-- l'INSERT et à l'UPDATE, EN PLUS des branches existantes (directeur + membres
-- école) — aucune régression. Preuve per-rôle avant apply.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_team_head_coach(p_team uuid, p_uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = p_team AND tc.coach_id = p_uid AND tc.role = 'head_coach'
  );
$fn$;
REVOKE ALL ON FUNCTION public.is_team_head_coach(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_team_head_coach(uuid, uuid) TO authenticated;

-- INSERT : + le head coach de l'équipe peut ajouter du staff
DROP POLICY IF EXISTS "team_coaches scoped insert" ON public.team_coaches;
CREATE POLICY "team_coaches scoped insert" ON public.team_coaches
  FOR INSERT WITH CHECK (
    (coach_id = (select auth.uid()))
    OR public.is_director_of_team_school(team_id)
    OR public.is_team_head_coach(team_id, (select auth.uid()))
  );

-- UPDATE : + head coach + directeur (autorité école), en plus du membre-école existant
DROP POLICY IF EXISTS "team_coaches scoped update" ON public.team_coaches;
CREATE POLICY "team_coaches scoped update" ON public.team_coaches
  FOR UPDATE
  USING (
    (team_id IN (SELECT t.id FROM public.teams t WHERE t.school_id IN (SELECT u.school_id FROM public.users u WHERE u.id = (select auth.uid()))))
    OR public.is_team_head_coach(team_id, (select auth.uid()))
    OR public.is_director_of_team_school(team_id)
    OR public.is_admin()
  )
  WITH CHECK (
    (team_id IN (SELECT t.id FROM public.teams t WHERE t.school_id IN (SELECT u.school_id FROM public.users u WHERE u.id = (select auth.uid()))))
    OR public.is_team_head_coach(team_id, (select auth.uid()))
    OR public.is_director_of_team_school(team_id)
    OR public.is_admin()
  );
