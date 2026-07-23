-- ═══════════════════════════════════════════════════════════════════════
-- P3 — Lot A (2/4) : RLS recruteur↔athlète
--
-- Décisions BP :
--   • Initiation : RECRUTEUR uniquement, précondition = athlète dans
--     recruiter_favorites du recruteur. + éligibilité (stub) + pas de black-out
--     (le black-out est appliqué par TRIGGER au lot 3, pas ici).
--   • L'ATHLÈTE peut RÉPONDRE, jamais initier.
--   • Le black-out « mute des deux côtés » (recruteur ET athlète) est géré par
--     le trigger BEFORE INSERT (lot 3) — pas dupliqué dans ces policies.
--
-- Note Pro : les messages du RECRUTEUR passent par la policy messages_insert
-- existante (rôle RECRUTEUR + user_has_pro()) → le gate Pro reste en place. On
-- n'AJOUTE ici que le chemin d'écriture de l'ATHLÈTE (réponse, gratuit).
-- ═══════════════════════════════════════════════════════════════════════

-- ── FIX : scoper la policy P0 conversations_insert ───────────────────────
-- conversations_insert était TYPE-AGNOSTIQUE : (recruiter_id=self AND
-- user_has_pro()). Comme les policies sont OR-combinées, un recruteur Pro
-- pouvait créer un fil RECRUTEUR_ATHLETE via CETTE policy en CONTOURNANT le
-- favoris-gate. On la scope à RECRUTEUR_COACH — seul type qu'un recruteur crée
-- avant P3 → recruteur↔coach INCHANGÉ, et RECRUTEUR_ATHLETE ne passe plus QUE
-- par la policy favoris-gate ci-dessous.
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    recruiter_id = auth.uid()
    AND conversation_type = 'RECRUTEUR_COACH'
    AND user_has_pro()
  );

-- ── CONVERSATIONS (RECRUTEUR_ATHLETE) ─────────────────────────────────────

-- Recruteur INITIE : favoris-gate + éligibilité (stub true). Black-out via trigger.
CREATE POLICY "recruteur_athlete_conversations_insert" ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_type = 'RECRUTEUR_ATHLETE'
    AND recruiter_id = auth.uid()
    AND coach_id IS NULL
    AND parent_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.recruiter_favorites f
      WHERE f.recruiter_id = auth.uid()
        AND f.athlete_id = conversations.athlete_id
    )
    AND public.is_athlete_contactable(conversations.athlete_id)
  );

-- Recruteur lit ses fils recruteur↔athlète.
CREATE POLICY "recruteur_athlete_conversations_select" ON public.conversations
  FOR SELECT
  USING (conversation_type = 'RECRUTEUR_ATHLETE' AND recruiter_id = auth.uid());

-- Athlète lit ses fils recruteur↔athlète (participant, jamais sujet-tiers ici).
CREATE POLICY "athlete_ra_conversations_select" ON public.conversations
  FOR SELECT
  USING (
    conversation_type = 'RECRUTEUR_ATHLETE'
    AND EXISTS (SELECT 1 FROM public.athletes a
                WHERE a.id = conversations.athlete_id AND a.user_id = auth.uid())
  );

-- Update (unread_count / last_message_at) pour les DEUX participants.
CREATE POLICY "recruteur_athlete_conversations_update" ON public.conversations
  FOR UPDATE
  USING (conversation_type = 'RECRUTEUR_ATHLETE' AND public.is_conversation_participant(id))
  WITH CHECK (conversation_type = 'RECRUTEUR_ATHLETE' AND public.is_conversation_participant(id));

-- ── MESSAGES ──────────────────────────────────────────────────────────────

-- Lecture : participants (is_conversation_participant gère déjà RECRUTEUR_ATHLETE
-- pour l'athlète ET le recruteur). Scopé authenticated (jamais anon → pas de
-- "permission denied for function" comme le fix athlete_messages_select).
CREATE POLICY "ra_messages_select" ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id));

-- Écriture ATHLÈTE (réponse). Le recruteur passe par messages_insert (Pro).
-- L'athlète répond dans un fil RA dont il est le participant athlète. Pas de
-- garde Pro (gratuit). Black-out appliqué par le trigger (lot 3).
CREATE POLICY "ra_athlete_messages_insert" ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      JOIN public.athletes a ON a.id = c.athlete_id
      WHERE c.id = messages.conversation_id
        AND c.conversation_type = 'RECRUTEUR_ATHLETE'
        AND a.user_id = auth.uid()
    )
  );
