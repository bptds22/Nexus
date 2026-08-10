-- ============================================================================
-- FIX 5 — RLS : accès recruteur à l'appartenance d'équipe, pour le calendrier
--
-- Constat de l'audit : la policy existante « Recruiters read verified team
-- athletes » exige a.verified = true AND a.status = 'ACTIF'. Le calendrier
-- recruteur, qui a besoin de team_athletes → teams → games, était donc
-- plafonné par la VÉRIFICATION COACH : 1 athlète ACTIF vérifié sur 9 en base.
-- Une cible ajoutée au pipeline mais pas encore vérifiée n'avait aucun match
-- affichable, sans que rien ne l'explique côté UI.
--
-- Décision retenue (parmi : tout ouvrir aux ACTIF / statu quo / scoper) :
-- policy DÉDIÉE, bornée aux cibles que le recruteur a DÉJÀ dans son propre
-- pipeline, ses favoris ou ses listes. Minimisation Loi 25 — on n'ouvre pas
-- l'appartenance d'équipe de tous les athlètes actifs à tous les recruteurs,
-- on la débloque uniquement là où le recruteur a déjà une relation de suivi
-- explicite. status='ACTIF' reste exigé (jamais de compte supprimé/suspendu) ;
-- seul `verified` saute.
--
-- ADDITIVE : les policies RLS se combinent en OR. « Recruiters read verified
-- team athletes » reste en place et continue de servir la recherche. Cette
-- policy n'en retire aucune, elle ajoute un cas.
--
-- Dry-run avant write : policy actuelle = 1 ligne team_athletes exposée,
-- nouvelle policy = 2 lignes sur 5 au total. Périmètre volontairement étroit.
-- ============================================================================

DROP POLICY IF EXISTS "Recruiters read own target team rows" ON public.team_athletes;

CREATE POLICY "Recruiters read own target team rows"
ON public.team_athletes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'RECRUTEUR'::public.user_role
  )
  AND EXISTS (
    SELECT 1 FROM public.athletes a
    WHERE a.id = team_athletes.athlete_id
      AND a.status = 'ACTIF'::public.account_status
  )
  AND (
    EXISTS (
      SELECT 1 FROM public.recruiter_pipeline rp
      WHERE rp.recruiter_id = auth.uid()
        AND rp.athlete_id = team_athletes.athlete_id
    )
    OR EXISTS (
      SELECT 1 FROM public.recruiter_favorites rf
      WHERE rf.recruiter_id = auth.uid()
        AND rf.athlete_id = team_athletes.athlete_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.recruiter_list_members rlm
      JOIN public.recruiter_lists rl ON rl.id = rlm.list_id
      WHERE rl.recruiter_id = auth.uid()
        AND rlm.athlete_id = team_athletes.athlete_id
    )
  )
);

COMMENT ON POLICY "Recruiters read own target team rows" ON public.team_athletes IS
  'FIX 5 — débloque le calendrier recruteur : lecture de l''appartenance '
  'd''équipe pour les seuls athlètes que CE recruteur suit déjà (pipeline, '
  'favoris ou listes), sans exiger verified. Additive : ne remplace pas '
  '"Recruiters read verified team athletes", qui reste la porte de la recherche.';

-- Index de soutien : les trois EXISTS filtrent par athlete_id côté
-- team_athletes. team_athletes_athlete_sport_uidx (FIX 4) est athlete_id-first
-- et sert déjà ce prédicat — rien à ajouter ici.
