-- ═══════════════════════════════════════════════════════════════
-- Phase A — Groupe chat réel. MIGRATION 3/3 : RLS.
--
-- Cœur mineur-safety : la visibilité asymétrique athlète→staff.
--   • staff  : voit TOUT (annonces + réponses privées de chaque athlète)
--   • athlète: voit les annonces staff (audience='ALL') + SES envois ;
--              JAMAIS la réponse (audience='STAFF') d'un coéquipier.
-- audience est estampillé par le trigger DEFINER (migration 2), pas le client.
-- Helpers is_group_participant / group_member_role = DEFINER (opaques).
-- Preuve per-rôle exécutée avant apply (leak-check = 0).
-- ═══════════════════════════════════════════════════════════════

-- conversations : un participant voit sa conversation de groupe.
DROP POLICY IF EXISTS group_conversations_select ON public.conversations;
CREATE POLICY group_conversations_select ON public.conversations
  FOR SELECT USING (
    conversation_type = 'GROUP' AND public.is_group_participant(id, (select auth.uid()))
  );

-- messages : SELECT asymétrique (le leak-check).
DROP POLICY IF EXISTS group_messages_select ON public.messages;
CREATE POLICY group_messages_select ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.conversation_type = 'GROUP')
    AND public.is_group_participant(messages.conversation_id, (select auth.uid()))
    AND (
      public.group_member_role(messages.conversation_id, (select auth.uid())) = 'STAFF'  -- staff voit tout
      OR messages.audience = 'ALL'                                                        -- annonces staff
      OR messages.sender_id = (select auth.uid())                                         -- ses propres réponses
    )
  );

-- messages : INSERT — staff ET athlètes écrivent, GRATUIT (pas de garde Pro).
-- audience est forcé par le trigger, jamais par le client.
DROP POLICY IF EXISTS group_messages_insert ON public.messages;
CREATE POLICY group_messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.conversation_type = 'GROUP')
    AND public.is_group_participant(messages.conversation_id, (select auth.uid()))
  );

-- participants : un athlète ne peut PAS énumérer les user_id des coéquipiers.
DROP POLICY IF EXISTS group_participants_select ON public.conversation_participants;
CREATE POLICY group_participants_select ON public.conversation_participants
  FOR SELECT USING (
    public.is_group_participant(conversation_id, (select auth.uid()))
    AND (
      public.group_member_role(conversation_id, (select auth.uid())) = 'STAFF'  -- staff voit tous les membres
      OR member_role = 'STAFF'                                                   -- athlète : voit le staff
      OR user_id = (select auth.uid())                                          -- et soi
    )
  );

-- participants : chaque membre met à jour SA ligne (last_read_at).
DROP POLICY IF EXISTS group_participants_update_read ON public.conversation_participants;
CREATE POLICY group_participants_update_read ON public.conversation_participants
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- NB : pas de policy INSERT directe sur conversations/participants pour GROUP —
-- la création passe par un RPC DEFINER (Phase 2) qui seed les participants
-- serveur, roster résolu par l'autorité légale (mineur-safety).
