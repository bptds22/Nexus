-- Fix 42501 on athletes SELECT caused by "athletes can read own orphan match"
-- policy reading auth.users directly. The authenticated role has no privileges
-- on auth.users, so the sub-query fails and cascades to 42501.
-- Pattern: wrap the auth.users read in a SECURITY DEFINER helper with
-- row_security=off + search_path=public, same approach as is_admin/is_coach etc.

CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $function$
  SELECT email::text FROM auth.users WHERE id = auth.uid();
$function$;

ALTER POLICY "athletes can read own orphan match" ON public.athletes
USING (
  user_id IS NULL
  AND email IS NOT NULL
  AND lower(email) = lower(public.current_user_email())
);