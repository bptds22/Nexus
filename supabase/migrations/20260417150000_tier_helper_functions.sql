-- Phase 0.7: Tier-checking helper functions for use in RLS policies
-- All functions are SECURITY DEFINER STABLE with locked search_path

BEGIN;

-- ============================================================
-- Helper 1: get_user_tier — canonical tier reader
-- Returns 'free' if no active subscription found
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_tier(uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tier FROM subscriptions
     WHERE user_id = uid AND status = 'active'
     ORDER BY created_at DESC LIMIT 1),
    'free'
  );
$$;

-- ============================================================
-- Helper 2: user_has_pro — shortcut for Pro+ check
-- True for both 'pro' and 'all_star' tiers
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_pro(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_user_tier(uid) IN ('pro', 'all_star');
$$;

-- ============================================================
-- Helper 3: user_has_all_star — shortcut for All Star only
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_all_star(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.get_user_tier(uid) = 'all_star';
$$;

-- ============================================================
-- Helper 4: user_is_school_admin — reads is_school_admin flag
-- Note: being a school admin does NOT override tier; both checks apply
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_is_school_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_school_admin FROM users WHERE id = uid),
    false
  );
$$;

-- ============================================================
-- Helper 5: count_user_favorites — current favorites count
-- Used by max_favorites RLS policy
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_user_favorites(uid UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM recruiter_favorites WHERE recruiter_id = uid;
$$;

-- ============================================================
-- Helper 6: count_coach_athletes — current athletes count
-- Used by max_athletes RLS policy
-- ============================================================

CREATE OR REPLACE FUNCTION public.count_coach_athletes(uid UUID DEFAULT auth.uid())
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM athletes WHERE coach_id = uid;
$$;

-- ============================================================
-- Grants
-- All helpers callable by authenticated users
-- get_user_tier additionally callable by anon for public profile reads
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_user_tier(UUID)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_pro(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_all_star(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_school_admin(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_user_favorites(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_coach_athletes(UUID)  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_tier(UUID) TO anon;

COMMIT;
