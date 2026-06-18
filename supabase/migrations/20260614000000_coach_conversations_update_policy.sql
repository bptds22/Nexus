-- Coach conversations UPDATE policy — fills a gap left by Phase 2a.
--
-- Context :
--   - 20260418090000_phase2a_rls_tier_gates_p0.sql DROPPED the original
--     `recruiter_conversations_all` policy and replaced it with
--     per-command policies : recruiter_conversations_select / _update /
--     _delete, all gated `recruiter_id = auth.uid()`. No equivalent
--     coach UPDATE policy was created.
--   - Result : when the coach sends a message via useSendMessage, the
--     follow-up `UPDATE conversations SET last_message_at, updated_at
--     WHERE id = $1` matches zero rows under RLS (silently — PostgREST
--     returns count:0, no error). The bubble itself was the visible
--     symptom (fixed separately by the useSendMessage/useMessages race
--     fix), but the conversation row also never bumps its
--     last_message_at when the coach replies → coach's thread-list
--     ordering goes stale until the recruiter writes back.
--
-- Fix : mirror the recruiter_conversations_update shape on the coach
-- side. Pure participant policy ; no tier gate (coaches are always
-- free per CLAUDE.md + useSubscription.ts can_receive_messages: true).

BEGIN;

DROP POLICY IF EXISTS "coach_conversations_update" ON public.conversations;

CREATE POLICY "coach_conversations_update"
ON public.conversations
FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

COMMIT;
