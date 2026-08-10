-- ═══════════════════════════════════════════════════════════════
-- CÉGEP admin RLS layer (recruiter-side oversight)
--
-- CÉGEP admins = users.role='RECRUTEUR' + is_school_admin=true + school_id
-- (type CEGEP). L'UII CÉGEP (stats, recruteurs, réassignation) lit/écrit déjà
-- les données des recruteurs COLLÈGUES de la même école, mais AUCUNE RLS ne le
-- permet : toutes les tables recruteur sont own-row (recruiter_id=auth.uid()).
-- Ça « marche » aujourd'hui uniquement parce que chaque CÉGEP a 1 recruteur.
--
-- Cette migration AJOUTE des branches permissives « admin CÉGEP » (les policies
-- own-row existantes sont INCHANGÉES). Modèle plat : lien via users.school_id,
-- pas de table de liaison ni de hiérarchie.
--
-- ⚠️ Le helper exige me.role='RECRUTEUR' → un directeur d'école (COACH +
--    is_school_admin) n'obtient AUCUN pouvoir côté recruteur (check #7).
-- ═══════════════════════════════════════════════════════════════

-- ── helpers (pattern maison : SECURITY DEFINER, row_security off, search_path)
CREATE OR REPLACE FUNCTION public.is_cegep_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET row_security TO 'off' SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'RECRUTEUR'::public.user_role
      AND u.is_school_admin = true
      AND u.school_id IS NOT NULL
  );
$$;

-- True quand : le user courant est admin CÉGEP ET le recruteur cible partage
-- la même école (et est bien un RECRUTEUR).
CREATE OR REPLACE FUNCTION public.is_cegep_admin_over_recruiter(p_recruiter_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET row_security TO 'off' SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users me
    JOIN public.users target ON target.id = p_recruiter_id
    WHERE me.id = auth.uid()
      AND me.role = 'RECRUTEUR'::public.user_role
      AND me.is_school_admin = true
      AND me.school_id IS NOT NULL
      AND target.role = 'RECRUTEUR'::public.user_role
      AND target.school_id = me.school_id
  );
$$;

-- Idempotence : re-jouable sans erreur (les branches own-row ne sont PAS visées).
DROP POLICY IF EXISTS "cegep admin read pipeline"       ON public.recruiter_pipeline;
DROP POLICY IF EXISTS "cegep admin read favorites"      ON public.recruiter_favorites;
DROP POLICY IF EXISTS "cegep admin read athlete_views"  ON public.recruiter_athlete_views;
DROP POLICY IF EXISTS "cegep admin read activity_log"   ON public.recruiter_activity_log;
DROP POLICY IF EXISTS "cegep admin read notes"          ON public.recruiter_notes;
DROP POLICY IF EXISTS "cegep admin update pipeline"     ON public.recruiter_pipeline;
DROP POLICY IF EXISTS "cegep admin insert favorites"    ON public.recruiter_favorites;
DROP POLICY IF EXISTS "cegep admin update favorites"    ON public.recruiter_favorites;
DROP POLICY IF EXISTS "cegep admin insert notes"        ON public.recruiter_notes;
DROP POLICY IF EXISTS "cegep admin read school recruiters" ON public.users;

-- ── 1b. READ branches (SELECT permissif) — own-row policies inchangées.
CREATE POLICY "cegep admin read pipeline" ON public.recruiter_pipeline
  FOR SELECT TO authenticated USING (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin read favorites" ON public.recruiter_favorites
  FOR SELECT TO authenticated USING (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin read athlete_views" ON public.recruiter_athlete_views
  FOR SELECT TO authenticated USING (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin read activity_log" ON public.recruiter_activity_log
  FOR SELECT TO authenticated USING (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin read notes" ON public.recruiter_notes
  FOR SELECT TO authenticated USING (public.is_cegep_admin_over_recruiter(recruiter_id));

-- ── 1c. WRITE branches — strictement ce que réassignation écrit :
--   pipeline UPDATE (recruiter_id source→dest), favorites upsert (INSERT +
--   conflit-UPDATE), notes INSERT (copie). Le WITH CHECK contraint le NOUVEAU
--   recruiter_id à un recruteur de la MÊME école → pas de transfert hors CÉGEP.
CREATE POLICY "cegep admin update pipeline" ON public.recruiter_pipeline
  FOR UPDATE TO authenticated
  USING (public.is_cegep_admin_over_recruiter(recruiter_id))
  WITH CHECK (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin insert favorites" ON public.recruiter_favorites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin update favorites" ON public.recruiter_favorites
  FOR UPDATE TO authenticated
  USING (public.is_cegep_admin_over_recruiter(recruiter_id))
  WITH CHECK (public.is_cegep_admin_over_recruiter(recruiter_id));

CREATE POLICY "cegep admin insert notes" ON public.recruiter_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_cegep_admin_over_recruiter(recruiter_id));

-- ── 1d. users — le roster recruteurs de l'école + le retrait de membre.
-- SELECT : un admin CÉGEP lit les lignes users des RECRUTEURS de son école.
CREATE POLICY "cegep admin read school recruiters" ON public.users
  FOR SELECT TO authenticated
  USING (
    role = 'RECRUTEUR'::public.user_role
    AND school_id = public.current_user_school_id()
    AND public.is_cegep_admin()
  );

-- Retrait de membre : PAS de policy UPDATE sur users (une policy RLS ne peut
-- pas restreindre QUELLES colonnes changent → trop large). À la place, une RPC
-- SECURITY DEFINER qui fait EXACTEMENT le retrait (school_id = NULL) après
-- vérif d'autorisation. Aucun chemin UPDATE users pour un admin CÉGEP → les
-- autres colonnes d'un collègue sont intouchables.
CREATE OR REPLACE FUNCTION public.remove_cegep_member(p_target_recruiter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Autorisation : même contrôle que le helper — l'appelant est admin CÉGEP
  -- ET la cible est un RECRUTEUR de la même école.
  IF NOT public.is_cegep_admin_over_recruiter(p_target_recruiter_id) THEN
    RAISE EXCEPTION 'not authorized to remove this member'
      USING ERRCODE = '42501';
  END IF;

  -- Exactement l'écriture du retrait (parametres) — rien d'autre.
  UPDATE public.users
  SET school_id = NULL
  WHERE id = p_target_recruiter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_cegep_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_cegep_member(uuid) TO authenticated;
