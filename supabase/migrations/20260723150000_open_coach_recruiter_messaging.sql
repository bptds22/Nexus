-- ═══════════════════════════════════════════════════════════════════════
-- Messagerie — OUVERTURE du coach→recruteur (retrait du favoris-gate)
--
-- Décision BP : le coach/directeur peut contacter N'IMPORTE QUEL recruteur au
-- sujet d'un de SES athlètes (motion sortante « vendre mes athlètes »), sans
-- que le recruteur ait d'abord mis l'athlète en favori. On REMPLACE la policy
-- coach_initiate_recruteur_coach : on retire la précondition
-- recruiter_favorited_athlete ; on GARDE l'ancre = athlète du coach + on ajoute
-- une garde « recruiter_id est bien un RECRUTEUR » (anti-mésusage).
--
-- SÛRETÉ : additif/réécriture d'UNE policy INSERT. Le recruteur lit/répond via
-- ses policies existantes ; le coach écrit via messages_insert (coach_id=moi).
-- coach_conversations_insert reste resserré (exclut RECRUTEUR_COACH). L'ancre
-- reste NOT NULL. La règle « anchor est mon athlète » demeure.
--
-- Ledger : reversal délibéré (docs/flip-day-ledger.md).
-- ═══════════════════════════════════════════════════════════════════════

-- Helper DEFINER : uid est-il un recruteur ? (bypass RLS → évite la récursion
-- users↔conversations qu'un EXISTS(users) brut déclenche dans la policy).
CREATE OR REPLACE FUNCTION public.user_is_recruiter(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_uid AND u.role = 'RECRUTEUR');
$$;
REVOKE ALL ON FUNCTION public.user_is_recruiter(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.user_is_recruiter(uuid) TO authenticated;

DROP POLICY IF EXISTS "coach_initiate_recruteur_coach" ON public.conversations;
CREATE POLICY "coach_initiate_recruteur_coach" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'RECRUTEUR_COACH'
    AND coach_id = auth.uid()
    AND recruiter_id IS NOT NULL
    AND parent_id IS NULL
    AND coach_b_id IS NULL
    AND athlete_id IS NOT NULL
    -- ancre = un athlète DU coach (règle ownership conservée)
    AND EXISTS (
      SELECT 1 FROM public.athletes a
      WHERE a.id = conversations.athlete_id AND a.coach_id = auth.uid()
    )
    -- garde anti-mésusage : recruiter_id est bien un recruteur (via helper
    -- DEFINER → pas de récursion users↔conversations)
    AND public.user_is_recruiter(recruiter_id)
    -- PLUS de précondition favoris (retirée) : coach → n'importe quel recruteur.
  );
