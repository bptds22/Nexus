-- F6-C2 MEDIUM: 8 parameterized helpers leak cross-user info via RPC
--
-- VULNERABILITY: get_user_tier(uid), user_has_pro(uid), user_has_all_star(uid),
-- user_is_school_admin(uid), count_coach_athletes(uid), count_user_favorites(uid),
-- is_platform_admin(uid), is_approved_partner(uid) all accept an arbitrary uid
-- parameter. Any authenticated user can call e.g. rpc('get_user_tier', { uid: X })
-- to discover another user's subscription tier, admin status, or counts.
--
-- FIX: Ignore the param — always use auth.uid() internally. The parameter
-- signature is preserved for backward compatibility (RLS policies call these
-- with default auth.uid()), but the body always reads auth.uid().
-- Exception: is_approved_partner is called from athletes RLS as
-- is_approved_partner(auth.uid()) — same fix applies.

-- 1. get_user_tier — always use auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_tier(uid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT tier FROM subscriptions
     WHERE user_id = auth.uid() AND status = 'active'
     ORDER BY created_at DESC LIMIT 1),
    'free'
  );
$function$;

-- 2. user_has_pro — delegates to get_user_tier (which now uses auth.uid())
CREATE OR REPLACE FUNCTION public.user_has_pro(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT public.get_user_tier() IN ('pro', 'all_star');
$function$;

-- 3. user_has_all_star — same
CREATE OR REPLACE FUNCTION public.user_has_all_star(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT public.get_user_tier() = 'all_star';
$function$;

-- 4. user_is_school_admin
CREATE OR REPLACE FUNCTION public.user_is_school_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_school_admin FROM users WHERE id = auth.uid()),
    false
  );
$function$;

-- 5. count_coach_athletes
CREATE OR REPLACE FUNCTION public.count_coach_athletes(uid uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COUNT(*)::INTEGER FROM athletes WHERE coach_id = auth.uid();
$function$;

-- 6. count_user_favorites
CREATE OR REPLACE FUNCTION public.count_user_favorites(uid uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT COUNT(*)::INTEGER FROM recruiter_favorites WHERE recruiter_id = auth.uid();
$function$;

-- 7. is_platform_admin — must keep the uid param (no default) for callers,
--    but enforce auth.uid() when called via RPC
CREATE OR REPLACE FUNCTION public.is_platform_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET row_security = 'off'
SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$function$;

-- 8. is_approved_partner — lock to auth.uid()
CREATE OR REPLACE FUNCTION public.is_approved_partner(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM media_partners
    WHERE user_id = auth.uid() AND status = 'APPROVED'
  );
$function$;
