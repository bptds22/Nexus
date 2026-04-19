-- Phase 2a: Tier-aware RLS policies on P0 tables
--
-- Closes the revenue-critical gates identified in the actions audit:
-- - messages: only Pro+ recruiters can send
-- - conversations: only Pro+ recruiters can initiate
-- - recruiter_pipeline: Free limited to IDENTIFIE/CONTACTE stages; Pro+ full range
--
-- Architecture notes:
-- - Per-command policies (no catch-all ALL) -- keeps gate surface explicit
-- - Helpers from 20260417150000_tier_helper_functions.sql:
--     * public.user_has_pro(uid UUID DEFAULT auth.uid())
-- - Admin override: is_school_admin flag does NOT override tier.
--   Admins pay for their tier like every other user (per business rule:
--   "Admin CEGEP does NOT receive free All Star -- everyone must subscribe")

BEGIN;

-- ============================================================
-- MESSAGES
-- Only Pro+ recruiters can insert messages.
-- Coaches always free. Athletes have no messaging UI (out of scope).
-- ============================================================

DROP POLICY IF EXISTS "messages_insert" ON messages;

CREATE POLICY "messages_insert"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND (
    (SELECT role FROM users WHERE id = auth.uid()) = 'COACH'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'RECRUTEUR'
      AND public.user_has_pro()
    )
  )
  AND EXISTS (
    SELECT 1 FROM conversations
    WHERE id = messages.conversation_id
    AND (recruiter_id = auth.uid() OR coach_id = auth.uid())
  )
);

-- ============================================================
-- CONVERSATIONS
-- Split the existing ALL policy into per-command, add tier-gated INSERT.
-- Existing permissive ALL would OR-allow Free recruiters through
-- if we added INSERT-only policy on top. Split is the clean fix.
-- ============================================================

DROP POLICY IF EXISTS "recruiter_conversations_all" ON conversations;

CREATE POLICY "recruiter_conversations_select"
ON conversations
FOR SELECT
TO authenticated
USING (recruiter_id = auth.uid());

CREATE POLICY "recruiter_conversations_update"
ON conversations
FOR UPDATE
TO authenticated
USING (recruiter_id = auth.uid())
WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "recruiter_conversations_delete"
ON conversations
FOR DELETE
TO authenticated
USING (recruiter_id = auth.uid());

CREATE POLICY "conversations_insert"
ON conversations
FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_id = auth.uid()
  AND public.user_has_pro()
);

-- ============================================================
-- RECRUITER PIPELINE
-- Split existing "Recruiters manage own pipeline" ALL into per-command.
-- INSERT: Free can write IDENTIFIE/CONTACTE; Pro+ any stage.
-- UPDATE: same stage-level gate.
-- DELETE: ownership only (Free can remove own rows).
-- SELECT: ownership + admin override (coach SELECT policy preserved elsewhere).
-- ============================================================

DROP POLICY IF EXISTS "Recruiters manage own pipeline" ON recruiter_pipeline;

CREATE POLICY "recruiter_pipeline_insert"
ON recruiter_pipeline
FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_id = auth.uid()
  AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'RECRUTEUR')
  AND (
    (public.get_user_tier() = 'free' AND stage IN ('IDENTIFIE', 'CONTACTE'))
    OR public.user_has_pro()
  )
);

CREATE POLICY "recruiter_pipeline_update"
ON recruiter_pipeline
FOR UPDATE
TO authenticated
USING (
  recruiter_id = auth.uid()
  AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'RECRUTEUR')
)
WITH CHECK (
  recruiter_id = auth.uid()
  AND (
    (public.get_user_tier() = 'free' AND stage IN ('IDENTIFIE', 'CONTACTE'))
    OR public.user_has_pro()
  )
);

CREATE POLICY "recruiter_pipeline_delete"
ON recruiter_pipeline
FOR DELETE
TO authenticated
USING (recruiter_id = auth.uid());

CREATE POLICY "recruiter_pipeline_select"
ON recruiter_pipeline
FOR SELECT
TO authenticated
USING (recruiter_id = auth.uid());
-- Note: additional SELECT permissions (admin_read_all, coaches read pipeline
-- for own athletes) are kept intact via their separate policies.

COMMIT;
