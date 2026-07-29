-- ═══════════════════════════════════════════════════════════════════════════
-- get_coach_athletes — LA source canonique unique de « mes athlètes »
--
-- Règle (BP, GO 2026-08) :
--   • athlètes d'un coach = coach_id = moi  ∪  athlètes des équipes que je
--     coache (team_coaches → team_athletes)
--   • athlètes d'un directeur = ci-dessus  ∪  school_id ∈ mes écoles/clubs
--     où je suis DIRECTEUR / DIRECTEUR_INTERIM  (l'élargissement est GATÉ sur
--     le statut directeur réel — un coach ordinaire n'obtient jamais l'école)
--   • statuts : ACTIF (+ EN_ATTENTE si p_include_pending) — DESACTIVE / DIPLOME
--     / SUPPRIME toujours exclus
--
-- SÉCURITÉ : SECURITY DEFINER + auth.uid() interne (AUCUN paramètre uid
-- injectable) → l'appelant n'obtient JAMAIS que SON propre périmètre. Un
-- recruteur / athlète sans relation coach reçoit l'ensemble vide. REVOKE anon.
--
-- Retour : (athlete_id, relation OWNER|TEAM|SCHOOL, status) — `relation`
-- permet aux surfaces de partitionner « mes » vs « école » sans requête de plus.
-- Additif et inerte (aucune surface ne l'appelle encore) — ne touche AUCUNE RLS.
--
-- Contrat ledger : toute nouvelle surface « quels athlètes ce coach voit-il »
-- DOIT consommer cette fonction. Jamais de requête parallèle .from("athletes")
-- qui redéfinit le périmètre.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_coach_athletes(p_include_pending boolean DEFAULT true)
RETURNS TABLE(athlete_id uuid, relation text, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_coach_athletes(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_coach_athletes(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_coach_athletes(boolean) TO authenticated;
