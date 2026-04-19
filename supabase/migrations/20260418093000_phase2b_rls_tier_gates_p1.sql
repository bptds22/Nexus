-- Phase 2b: Tier-aware RLS policies on P1 tables
--
-- Completes the tier-gate coverage started in Phase 2a. Closes revenue
-- leaks on favorites (count cap), custom lists (Pro-only), and coach
-- athlete creation (count cap).
--
-- Pattern (same as Phase 2a):
-- - Drop existing permissive ALL policies and recreate per-command
-- - Tier/count gate on INSERT (and UPDATE where state transitions matter)
-- - Helpers from Phase 0.7:
--     * public.get_user_tier(uid UUID DEFAULT auth.uid())
--     * public.user_has_pro(uid UUID DEFAULT auth.uid())
--     * public.count_user_favorites(uid UUID DEFAULT auth.uid())
--     * public.count_coach_athletes(uid UUID DEFAULT auth.uid())
-- - Numeric caps (10 favorites, 30 athletes) come from the DB's
--   subscription_features_* tables and are hardcoded here per the workbook
--   defaults. If those caps ever change, update this migration too.

BEGIN;

-- ============================================================
-- RECRUITER_FAVORITES
-- Free: cap at 10. Pro+: unlimited.
-- Split from "Recruiters manage own favorites" ALL policy into
-- per-command policies. UPDATE restored as ownership-only so the
-- reassignation flow's .upsert() can still succeed on conflict.
-- ============================================================

DROP POLICY IF EXISTS "Recruiters manage own favorites" ON recruiter_favorites;

CREATE POLICY "recruiter_favorites_insert"
ON recruiter_favorites
FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_id = auth.uid()
  AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'RECRUTEUR')
  AND (
    public.user_has_pro()
    OR (public.get_user_tier() = 'free' AND public.count_user_favorites() < 10)
  )
);

CREATE POLICY "recruiter_favorites_update"
ON recruiter_favorites
FOR UPDATE
TO authenticated
USING (recruiter_id = auth.uid())
WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "recruiter_favorites_select"
ON recruiter_favorites
FOR SELECT
TO authenticated
USING (recruiter_id = auth.uid());

CREATE POLICY "recruiter_favorites_delete"
ON recruiter_favorites
FOR DELETE
TO authenticated
USING (recruiter_id = auth.uid());
-- Note: existing permissive SELECT policies "Athletes read own favorites",
-- "Coaches read favorites for their athletes", and "admins read all" remain
-- intact and OR with recruiter_favorites_select.

-- ============================================================
-- RECRUITER_LISTS
-- Lists are Pro+ only per workbook. INSERT and UPDATE both require
-- user_has_pro(); SELECT and DELETE remain ownership-only so users who
-- downgrade from Pro can still read or purge their existing lists (they
-- just can't create new ones or edit existing ones).
-- ============================================================

DROP POLICY IF EXISTS "Recruiters manage their own lists" ON recruiter_lists;

CREATE POLICY "recruiter_lists_insert"
ON recruiter_lists
FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_id = auth.uid()
  AND public.user_has_pro()
);

CREATE POLICY "recruiter_lists_update"
ON recruiter_lists
FOR UPDATE
TO authenticated
USING (recruiter_id = auth.uid())
WITH CHECK (
  recruiter_id = auth.uid()
  AND public.user_has_pro()
);

CREATE POLICY "recruiter_lists_select"
ON recruiter_lists
FOR SELECT
TO authenticated
USING (recruiter_id = auth.uid());

CREATE POLICY "recruiter_lists_delete"
ON recruiter_lists
FOR DELETE
TO authenticated
USING (recruiter_id = auth.uid());

-- ============================================================
-- RECRUITER_LIST_MEMBERS
-- Adding an athlete to a list requires Pro+ AND ownership of the parent
-- list. SELECT and DELETE are list-ownership-only (downgraded users can
-- still see and remove existing members from lists they own).
-- ============================================================

DROP POLICY IF EXISTS "Recruiters manage their own list members" ON recruiter_list_members;

CREATE POLICY "recruiter_list_members_insert"
ON recruiter_list_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_has_pro()
  AND EXISTS (
    SELECT 1 FROM recruiter_lists
    WHERE id = recruiter_list_members.list_id
      AND recruiter_id = auth.uid()
  )
);

CREATE POLICY "recruiter_list_members_select"
ON recruiter_list_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM recruiter_lists
    WHERE id = recruiter_list_members.list_id
      AND recruiter_id = auth.uid()
  )
);

CREATE POLICY "recruiter_list_members_delete"
ON recruiter_list_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM recruiter_lists
    WHERE id = recruiter_list_members.list_id
      AND recruiter_id = auth.uid()
  )
);

-- ============================================================
-- ATHLETES — coach INSERT only
-- Free coach: max 30 athletes. Pro+ coach: unlimited.
-- Replaces the prior "coaches can insert athletes" policy. The
-- "athletes can insert own profile" policy remains intact so athlete
-- self-registration still works (tier-agnostic).
-- ============================================================

DROP POLICY IF EXISTS "coaches can insert athletes" ON athletes;

CREATE POLICY "athletes_insert"
ON athletes
FOR INSERT
TO authenticated
WITH CHECK (
  coach_id = auth.uid()
  AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'COACH')
  AND (
    public.user_has_pro()
    OR (public.get_user_tier() = 'free' AND public.count_coach_athletes() < 30)
  )
);

COMMIT;
