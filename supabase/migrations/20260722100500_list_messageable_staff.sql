-- ═══════════════════════════════════════════════════════════════════════
-- Addendum Phase A : source UNIQUE de « qui un athlète peut contacter ».
--
-- Le picker (SchoolStaffPicker) lisait school_coaches/team_coaches DIRECTEMENT
-- côté client (rôle athlète). Si l'athlète n'a pas SELECT RLS sur school_coaches,
-- le picker revient VIDE alors que l'INSERT serait autorisé (mismatch UI↔RLS).
--
-- On expose un RPC SECURITY DEFINER qui retourne l'ensemble hydraté, et on
-- REFACTORISE athlete_messageable_coach pour dériver du MÊME ensemble interne
-- (_messageable_staff_ids) → une seule source de vérité pour la garde RLS ET le
-- picker. Signature/ sémantique booléenne d'athlete_messageable_coach INCHANGÉES
-- → les policies restent intactes.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Ensemble d'IDs — LA source unique de la logique de rattachement. Interne
--    (appelé uniquement par les 2 fonctions definer ci-dessous).
CREATE OR REPLACE FUNCTION public._messageable_staff_ids(p_uid uuid)
RETURNS TABLE (coach_id uuid, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH anchor AS (
    -- école effective = école scolaire OU école (LIGUE_CIVILE) du team civil
    SELECT a.league_team_id,
           COALESCE(a.school_id, t.school_id) AS eff_school_id
    FROM public.athletes a
    LEFT JOIN public.teams t ON t.id = a.league_team_id
    WHERE a.user_id = p_uid
  )
  SELECT sc.coach_id, sc.role::text
  FROM public.school_coaches sc
  JOIN anchor ON sc.school_id = anchor.eff_school_id
  WHERE sc.role IN ('COACH','DIRECTEUR','DIRECTEUR_INTERIM')   -- exclut PENDING
  UNION
  SELECT tc.coach_id, 'COACH'::text
  FROM public.team_coaches tc
  JOIN anchor ON tc.team_id = anchor.league_team_id;
$$;
REVOKE ALL ON FUNCTION public._messageable_staff_ids(uuid) FROM public, anon, authenticated;

-- 2. Liste HYDRATÉE pour le picker. Sans paramètre → toujours auth.uid() (un
--    athlète ne peut énumérer QUE le staff de sa propre école). Directeur
--    prioritaire pour le libellé si rattachements multiples.
CREATE OR REPLACE FUNCTION public.list_messageable_staff()
RETURNS TABLE (coach_id uuid, first_name text, last_name text, photo_url text, role_label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH ids AS (
    SELECT s.coach_id,
           bool_or(s.role IN ('DIRECTEUR','DIRECTEUR_INTERIM')) AS is_director
    FROM public._messageable_staff_ids(auth.uid()) s
    GROUP BY s.coach_id
  )
  SELECT u.id, u.first_name, u.last_name, u.photo_url,
         CASE WHEN ids.is_director THEN 'Directeur sportif' ELSE 'Entraîneur' END
  FROM ids
  JOIN public.users u ON u.id = ids.coach_id;
$$;
REVOKE ALL ON FUNCTION public.list_messageable_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_messageable_staff() TO authenticated;

-- 3. Refactor : athlete_messageable_coach dérive du MÊME ensemble (source unique).
CREATE OR REPLACE FUNCTION public.athlete_messageable_coach(p_coach uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public._messageable_staff_ids(p_uid) s WHERE s.coach_id = p_coach
  );
$$;
