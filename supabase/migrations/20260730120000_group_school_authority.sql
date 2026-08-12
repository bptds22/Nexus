-- ═══════════════════════════════════════════════════════════════
-- Groupe chat — FIX #1 : directeur muet dans les groupes TEAM.
--
-- Bug : un DIRECTEUR/DIRECTEUR_INTERIM n'est pas seedé comme participant d'un
-- groupe TEAM (il n'est pas team_coach) → is_group_participant faux → il ne
-- peut ni lire ni écrire (« new row violates RLS for messages »). Les groupes
-- STAFF marchent (les directeurs sont dans school_coaches, donc seedés).
--
-- Fix : helper d'autorité école is_group_school_authority (DEFINER, opaque,
-- REVOKE anon), ajouté au BRANCH STAFF des policies GROUP (SELECT conv, SELECT
-- messages « voit tout », INSERT messages). L'ASYMÉTRIE ATHLÈTE EST INTACTE :
-- le helper ne matche que les directeurs ; le rôle athlète est inchangé, donc
-- un athlète ne voit toujours PAS la réponse privée d'un coéquipier. Un
-- directeur qui écrit n'est pas 'ATHLETE' → le trigger estampille 'ALL' (staff).
-- Preuve per-rôle avant apply (directeur écrit ✅ + leak athlète = 0 ✅).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_group_school_authority(p_conv uuid, p_uid uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET row_security TO 'off' SET search_path TO 'public'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.school_coaches sc ON sc.coach_id = p_uid
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role, 'DIRECTEUR_INTERIM'::public.coach_school_role)
    WHERE c.id = p_conv AND c.conversation_type = 'GROUP'
      AND (
        (c.group_scope = 'STAFF' AND sc.school_id = c.group_school_id)
        OR (c.group_scope = 'TEAM' AND sc.school_id = (SELECT t.school_id FROM public.teams t WHERE t.id = c.group_team_id))
      )
  );
$fn$;
REVOKE ALL ON FUNCTION public.is_group_school_authority(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_group_school_authority(uuid, uuid) TO authenticated;

-- conversations SELECT : + autorité école
DROP POLICY IF EXISTS group_conversations_select ON public.conversations;
CREATE POLICY group_conversations_select ON public.conversations
  FOR SELECT USING (
    conversation_type = 'GROUP'
    AND ( public.is_group_participant(id, (select auth.uid()))
       OR public.is_group_school_authority(id, (select auth.uid())) )
  );

-- messages SELECT : le directeur (autorité école) « voit tout » comme le staff
DROP POLICY IF EXISTS group_messages_select ON public.messages;
CREATE POLICY group_messages_select ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.conversation_type = 'GROUP')
    AND ( public.is_group_participant(messages.conversation_id, (select auth.uid()))
       OR public.is_group_school_authority(messages.conversation_id, (select auth.uid())) )
    AND (
      public.group_member_role(messages.conversation_id, (select auth.uid())) = 'STAFF'
      OR public.is_group_school_authority(messages.conversation_id, (select auth.uid()))  -- directeur = privilège staff
      OR messages.audience = 'ALL'
      OR messages.sender_id = (select auth.uid())
    )
  );

-- messages INSERT : le directeur peut écrire dans un groupe de son école
DROP POLICY IF EXISTS group_messages_insert ON public.messages;
CREATE POLICY group_messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.conversation_type = 'GROUP')
    AND ( public.is_group_participant(messages.conversation_id, (select auth.uid()))
       OR public.is_group_school_authority(messages.conversation_id, (select auth.uid())) )
  );
