-- ═══════════════════════════════════════════════════════════════
-- #1 éval désync — enabler RLS (LECTURE SEULE, additif)
--
-- Problème : un coach primaire ne lit que SA propre ligne evaluations
-- (policy "authenticated read evaluations" : coach_id = auth.uid()). Quand
-- un directeur ré-évalue son athlète, le coach voit la bonne COTE publique
-- (colonne dénormalisée athletes.cote_globale_entraineur, last-write) mais
-- NE PEUT PAS voir la ligne du directeur → ni son nom (« Évaluée par … »),
-- ni ses traits, ni l'attribution du bandeau Modifier.
--
-- Fix : autoriser un coach à LIRE toutes les évaluations d'un athlète qu'il
-- possède OU gère. « Possède » = athletes.coach_id (le cas primaire, que
-- coach_can_manage_athlete NE couvre PAS — il ne teste que team_coaches +
-- directeur). D'où un helper dédié coach_can_read_athlete_evals qui combine
-- les deux, en SECURITY DEFINER (opaque au planner, aucune sous-requête RLS
-- inline dans la policy — règle 4 du checklist), REVOKE anon (dette ledger).
-- Purement additif (SELECT), aucune écriture élargie, aucun cross-tenant.
--
-- Prod sur GO explicite de BP. Preuve per-rôle exécutée avant apply
-- (transaction annulée sur le cloud, faute de Postgres local ici).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.coach_can_read_athlete_evals(p_athlete_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET row_security TO 'off'
  SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = p_athlete_id AND a.coach_id = auth.uid()   -- coach PROPRIÉTAIRE (athletes.coach_id)
    )
    OR public.coach_can_manage_athlete(p_athlete_id);          -- coach d'équipe / directeur (helper existant)
$function$;

REVOKE ALL ON FUNCTION public.coach_can_read_athlete_evals(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.coach_can_read_athlete_evals(uuid) TO authenticated;

DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;

CREATE POLICY "authenticated read evaluations" ON public.evaluations
  FOR SELECT
  USING (
    (coach_id = (select auth.uid()))
    OR public.is_director_of_athlete_school(athlete_id)
    OR public.coach_can_read_athlete_evals(athlete_id)   -- ← AJOUT #1 : coach propriétaire/gestionnaire lit toutes les évals de son athlète
    OR (public.is_recruiter() AND public.athlete_is_active(athlete_id))
    OR (EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = evaluations.athlete_id AND a.user_id = (select auth.uid())
    ))
    OR public.is_admin()
  );
