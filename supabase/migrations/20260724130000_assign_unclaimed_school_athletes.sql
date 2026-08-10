-- ═══════════════════════════════════════════════════════════════════════
-- Transferts — assignation d'un athlète NON RÉCLAMÉ (correctif #1)
--
-- Bug : réassigner un athlète NON RÉCLAMÉ (coach_id IS NULL) vers un coach
-- AUTRE que soi-même échouait ("new row violates RLS for athletes"). La policy
-- existante « coaches can claim unclaimed school athletes » n'autorise le WITH
-- CHECK que vers SOI (coach_id = auth.uid()) ; coach_can_manage_athlete ne
-- couvre que directeur/team-coach. Donc un coach régulier ne pouvait pas
-- ASSIGNER un athlète du pool « Non assigné » à un collègue.
--
-- Règle (validée BP) : un athlète NON RÉCLAMÉ de MON école est assignable par
-- N'IMPORTE QUEL coach de l'école, à n'importe quel coach de l'école (ou laissé
-- au pool). Sémantique « À réclamer » étendue à l'assignation.
--
-- PORTÉE STRICTE : USING (coach_id IS NULL) → cette policy ne s'applique JAMAIS
-- aux athlètes DÉJÀ réclamés → la réassignation d'un athlète réclamé reste
-- inchangée (directeur/team-coach seulement). Additif, idempotent.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "coaches assign unclaimed school athletes" ON public.athletes;
CREATE POLICY "coaches assign unclaimed school athletes" ON public.athletes
  FOR UPDATE
  TO authenticated
  USING (
    coach_id IS NULL
    AND school_id = public.current_user_school_id()
  )
  WITH CHECK (
    -- L'athlète reste dans MON école ; nouveau coach = pool (NULL) OU un coach
    -- de mon école (jamais hors-école, jamais un non-coach).
    school_id = public.current_user_school_id()
    AND (
      coach_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.school_coaches sc
        WHERE sc.coach_id = athletes.coach_id
          AND sc.school_id = public.current_user_school_id()
      )
    )
  );
