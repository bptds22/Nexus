-- ═══════════════════════════════════════════════════════════════
-- Secure athlete_view_details — close the Pro-PII bypass.
--
-- BEFORE this migration : the view athlete_view_details was OWNED by
-- postgres, GRANTed ALL to anon + authenticated, with no
-- security_invoker. The view exposes recruiter_name + cegep_name PII
-- joined from users + schools — the Pro paywall surface
-- (useAthleteVisibilityPro on /athlete/visibilite).
--
-- Because postgres views default to running with the OWNER's
-- privileges (not the invoker's) unless `security_invoker = on` is
-- set, the underlying RLS on recruiter_athlete_views ("athletes read
-- own views") was BYPASSED when accessing through the view. The UI
-- gate (FeatureGate) prevented rendering for free users, but a free
-- (or even anon) caller using the PostgREST endpoint could :
--   - Read recruiter PII for ANY athlete (cross-athlete leak)
--   - Bypass the tier paywall by querying directly
--
-- AFTER this migration :
--
-- 1. security_invoker = on on athlete_view_details. Defense in depth —
--    even if grants slip back later, the view honors the invoker's RLS
--    on the underlying recruiter_athlete_views table ("athletes read
--    own views" — auth.uid()-owned athletes only).
--
-- 2. anon is fully revoked. Athlete view data should NEVER be readable
--    unauthenticated.
--
-- 3. authenticated lost ALL access to the view, then was re-granted
--    SELECT ONLY on the PII-clean columns (athlete_id, cegep_region,
--    visit_count, last_viewed_at, first_viewed_at). The Free hook's
--    existing query `.select("cegep_region, visit_count")` still
--    works ; a determined user trying `.select("*")` now fails with
--    "permission denied for column recruiter_name".
--
-- 4. A new SECURITY DEFINER function get_my_athlete_view_details()
--    is the SOLE path to the PII (recruiter_name + cegep_name). It
--    double-filters :
--      (a) ownership : athlete_id IN (SELECT id FROM athletes
--          WHERE user_id = auth.uid())
--      (b) tier : public.user_has_pro(auth.uid())
--    Returns ZERO rows for : anon (auth.uid() null → user_has_pro
--    false), free users (user_has_pro false), other athletes' data
--    (ownership filter fails).
--
-- ADDITIVE-SAFE :
--   - The Free hook (useAthleteVisibility) at hooks/useAthleteVisibility.ts:101
--     only SELECTs cegep_region + visit_count → still works after the
--     column-grant restriction. Verified before this migration.
--   - The Pro hook (useAthleteVisibilityPro) at L179 is rewired in
--     the SAME commit to call .rpc("get_my_athlete_view_details").
--   - No other code path reads athlete_view_details (verified by
--     grep across app/, components/, hooks/, lib/). The remaining
--     references are .claude/settings.json (psql sandbox commands),
--     audit docs, and the baseline + repoint migrations themselves.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Defense-in-depth : honor invoker's RLS on the underlying table.
ALTER VIEW public.athlete_view_details SET (security_invoker = on);

-- ── 2. Lock down direct access.
REVOKE ALL ON TABLE public.athlete_view_details FROM anon;
REVOKE ALL ON TABLE public.athlete_view_details FROM authenticated;

-- ── 3. Re-grant SELECT on PII-CLEAN columns only.
--      The Free hook's existing `.select("cegep_region, visit_count")`
--      query still works. Any attempt to select recruiter_name or
--      cegep_name returns a column-level permission error.
GRANT SELECT (athlete_id, cegep_region, visit_count, last_viewed_at, first_viewed_at)
ON TABLE public.athlete_view_details TO authenticated;

-- ── 4. The tier-gated RPC : the only path to the PII columns.
--      SECURITY DEFINER + pinned search_path + STABLE matches the
--      existing tier-helper pattern (20260417150000). Ownership +
--      user_has_pro double-filter.
CREATE OR REPLACE FUNCTION public.get_my_athlete_view_details()
RETURNS TABLE (
  athlete_id      uuid,
  recruiter_id    uuid,
  recruiter_name  text,
  cegep_name      text,
  cegep_region    text,
  visit_count     bigint,
  last_viewed_at  timestamptz,
  first_viewed_at timestamptz
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    avd.athlete_id,
    avd.recruiter_id,
    avd.recruiter_name,
    avd.cegep_name,
    avd.cegep_region,
    avd.visit_count,
    avd.last_viewed_at,
    avd.first_viewed_at
  FROM public.athlete_view_details avd
  WHERE avd.athlete_id IN (
          SELECT id FROM public.athletes WHERE user_id = auth.uid()
        )
    AND public.user_has_pro(auth.uid());
$$;

-- ── 5. Execute grant. Authenticated only — never anon.
REVOKE ALL ON FUNCTION public.get_my_athlete_view_details() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_athlete_view_details() TO authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION (paste into psql to confirm) :
--
-- -- 1. View options should include (security_invoker=on)
-- SELECT reloptions FROM pg_class WHERE relname = 'athlete_view_details';
--
-- -- 2. View grants : authenticated should have SELECT only on the
-- --    5 safe columns, anon should have NO grants.
-- SELECT grantee, privilege_type, column_name
-- FROM information_schema.column_privileges
-- WHERE table_name = 'athlete_view_details' ORDER BY grantee, column_name;
--
-- -- 3. RPC exists + only authenticated has EXECUTE.
-- SELECT proname, prosecdef, proowner::regrole
-- FROM pg_proc WHERE proname = 'get_my_athlete_view_details';
--
-- -- 4. Exploit test (run as a FREE authenticated user via JWT) :
-- --    a) Direct view read with PII columns → permission denied.
-- SELECT recruiter_name FROM athlete_view_details LIMIT 1;
-- --       expected : ERROR: permission denied for column recruiter_name
-- --
-- --    b) Direct view read with safe columns → 0 rows (RLS, ownership).
-- SELECT cegep_region, visit_count FROM athlete_view_details LIMIT 1;
-- --       expected : 0 rows (no rows match auth.uid()'s athlete_id)
-- --
-- --    c) RPC call → 0 rows (user_has_pro false).
-- SELECT * FROM get_my_athlete_view_details();
-- --       expected : 0 rows
--
-- -- 5. Same test as a PRO authenticated user querying THEIR OWN athlete :
-- SELECT * FROM get_my_athlete_view_details();
-- --       expected : N rows of their own view details with PII intact
-- ═══════════════════════════════════════════════════════════════
