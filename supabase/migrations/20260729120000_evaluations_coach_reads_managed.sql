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
-- GÈRE (coach_can_manage_athlete = SECURITY DEFINER, déjà utilisé pour le
-- UPDATE athletes — couvre coach de l'équipe/école + directeur). Purement
-- additif (SELECT), aucune écriture élargie, aucun accès cross-tenant : le
-- helper borne à l'autorité du coach sur CET athlète.
--
-- Checklist : additif (expand), helper DEFINER (pas de sous-requête users
-- brute), preuve per-rôle avant prod. Prod sur GO explicite de BP.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;

CREATE POLICY "authenticated read evaluations" ON public.evaluations
  FOR SELECT
  USING (
    (coach_id = (select auth.uid()))
    OR public.is_director_of_athlete_school(athlete_id)
    OR public.coach_can_manage_athlete(athlete_id)   -- ← AJOUT #1 : coach gestionnaire lit toutes les évals de son athlète
    OR (public.is_recruiter() AND public.athlete_is_active(athlete_id))
    OR (EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = evaluations.athlete_id AND a.user_id = (select auth.uid())
    ))
    OR public.is_admin()
  );

-- Preuve per-rôle à exécuter avant apply prod (SET ROLE authenticated +
-- request.jwt.claims) :
--   • coach primaire de l'athlète : voit SA ligne ET celle du directeur ✅
--   • coach d'une AUTRE école : ne voit rien de cet athlète (deny) ✅
--   • recruteur : inchangé (athlete_is_active) ✅
--   • athlète lui-même : inchangé ✅
