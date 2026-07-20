-- ═══════════════════════════════════════════════════════════════
-- Director RLS policies (Director oversight Part A, Step 3)
--
-- 3a. team_coaches : gérer les coachs des équipes de l'école = DIRECTEUR.
-- 3b. school_coaches SELECT : un coach voit tout le roster de coachs de SON
--     école (corrige le 406 du fan-out Mon École ; les directeurs voient tous
--     les coachs).
--
-- ⚠️ DÉVIATION à connaître (3a) : les policies "team_coaches scoped
--    insert/delete" existantes étaient ÉCOLE-LARGES — n'IMPORTE quel coach de
--    l'école pouvait ajouter/retirer n'importe quel coach de n'importe quelle
--    équipe de l'école — et s'appuyaient sur une sous-requête brute `users`
--    (smell récursion, cf. CLAUDE.md). Pour que « non-directeur → refusé » (ta
--    vérif) tienne, on les REMPLACE par : self (coach_id = uid, pour
--    rejoindre/quitter) OU directeur de l'école de l'équipe. C'est un
--    RESSERREMENT du modèle existant, pas un simple ajout.
-- ═══════════════════════════════════════════════════════════════

-- ── helper : le user courant est-il directeur/intérimaire de l'école de cette équipe ?
CREATE OR REPLACE FUNCTION public.is_director_of_team_school(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_coaches sc
    WHERE sc.coach_id = auth.uid()
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role,
                      'DIRECTEUR_INTERIM'::public.coach_school_role)
      AND sc.school_id = (SELECT t.school_id FROM public.teams t WHERE t.id = p_team_id)
  );
$$;

-- ── 3a. team_coaches — INSERT : self-join OU directeur de l'école de l'équipe.
DROP POLICY IF EXISTS "team_coaches scoped insert" ON public.team_coaches;
CREATE POLICY "team_coaches scoped insert"
ON public.team_coaches
FOR INSERT
TO authenticated
WITH CHECK (
  coach_id = auth.uid()                              -- rejoindre soi-même
  OR public.is_director_of_team_school(team_id)      -- directeur : gérer l'école
);

-- ── 3a. team_coaches — DELETE : se retirer soi-même OU directeur OU admin.
DROP POLICY IF EXISTS "team_coaches scoped delete" ON public.team_coaches;
CREATE POLICY "team_coaches scoped delete"
ON public.team_coaches
FOR DELETE
TO authenticated
USING (
  coach_id = auth.uid()                              -- quitter soi-même
  OR public.is_director_of_team_school(team_id)      -- directeur : retirer un coach
  OR public.is_admin()                               -- admin plateforme
);

-- ── 3b. school_coaches SELECT — un coach lit tout le roster de coachs de SON
--     école (en plus de "coach_read_own" qui reste). Corrige le 406 du fan-out
--     Mon École et donne aux directeurs la vue « tous les coachs ».
DROP POLICY IF EXISTS "coaches read school roster" ON public.school_coaches;
CREATE POLICY "coaches read school roster"
ON public.school_coaches
FOR SELECT
TO authenticated
USING (
  school_id = public.current_user_school_id()
);
