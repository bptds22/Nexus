-- Coach-initiated conversations — RLS INSERT policy (Phase A).
--
-- Context :
--   - Today the ONLY conversations INSERT policy is `conversations_insert`
--     from 20260418090000_phase2a_rls_tier_gates_p0.sql, which requires
--     `recruiter_id = auth.uid() AND user_has_pro()` — only Pro+
--     recruiters can start a thread.
--   - Product extension : let coaches initiate a conversation with ANY
--     recruiter, about ONE OF THEIR OWN athletes. Coach messaging is
--     always free per CLAUDE.md (can_receive_messages: true on Free).
--
-- Policy shape :
--   - coach_id = auth.uid()           → only the coach themselves
--   - athletes.coach_id = auth.uid()  → athlete must be on coach's roster
--   - No tier gate                    → coach is canonically free
--   - recruiter_id unconstrained      → any recruiter user
--
-- Recruiter side untouched : `conversations_insert` still gates
-- recruiter-initiated INSERTs behind `recruiter_id = auth.uid() AND
-- user_has_pro()`. Multiple INSERT policies on a table are OR'd, so a
-- row only needs to satisfy ONE — the coach-INSERT path doesn't loosen
-- the recruiter-Pro gate.
--
-- Recruiter notification : the existing `log_coach_reply` trigger
-- (20260604120000_recruiter_activity_log_enrichment.sql §8) fires AFTER
-- INSERT on messages whenever sender_id = c.coach_id — including the
-- first message of a brand-new coach-initiated conversation — and
-- inserts a `COACH_REPLY` row into recruiter_activity_log. No extra
-- notification plumbing needed in app code.

BEGIN;

DROP POLICY IF EXISTS "coach_conversations_insert" ON public.conversations;

CREATE POLICY "coach_conversations_insert"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  coach_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.athletes a
    WHERE a.id = athlete_id
      AND a.coach_id = auth.uid()
  )
);

COMMIT;
