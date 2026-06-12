-- Coaches can read the recruiter directory (Phase A·b).
--
-- Context :
--   - Phase A enabled coach-initiated conversations at the
--     conversations level (coach_conversations_insert policy in
--     20260614100000). But the composer's RECRUITER PICKER queries
--     `users WHERE role = 'RECRUTEUR'`, and that read is filtered
--     through the existing users SELECT policies :
--       · users read own                  → only the coach's own row
--       · Users read conversation participants
--                                          → only recruiters the coach
--                                            ALREADY converses with
--       · admins read all                 → admins only
--     For a brand-new coach with no existing conversations, the
--     recruiter picker is empty → the coach can't initiate.
--
-- This migration adds an additive (OR'd) SELECT policy : when the
-- viewer is a COACH, RECRUTEUR rows become readable. The existing
-- policies are untouched ; nothing the coach could read before
-- becomes hidden, and only coaches gain the new visibility.
--
-- ─── Loi 25 / PII note ─────────────────────────────────────────────
-- Postgres RLS is row-level, not column-level — granting SELECT on
-- a recruiter's row exposes ALL its columns to coaches, including
-- email and phone. The composer queries are minimized in the same
-- change set (the directory mapping only fetches id, first_name,
-- last_name, photo/avatar, and the joined school name — never email
-- or phone). The policy itself is broader than the queries by
-- necessity ; column scoping is enforced at the query layer.
-- Future tightening (a SECURITY DEFINER RPC returning only the
-- directory columns) remains an option if column-level control
-- becomes required.

BEGIN;

DROP POLICY IF EXISTS "coaches read recruiter directory" ON public.users;

CREATE POLICY "coaches read recruiter directory"
ON public.users
FOR SELECT
TO authenticated
USING (
  role = 'RECRUTEUR'
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.id = auth.uid()
      AND me.role = 'COACH'
  )
);

COMMIT;
