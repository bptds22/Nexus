-- F5: Close anon INSERT on users table (admin escalation risk)
--
-- PROBLEM: The policy "Service role can insert users" is set to
-- roles={public} with with_check=true, meaning ANY user (including
-- unauthenticated anon key) can POST to /rest/v1/users and create
-- arbitrary rows — including role='ADMIN', is_platform_admin=true.
--
-- WHY IT'S SAFE TO DROP: The service role bypasses RLS entirely — it
-- never needs an RLS policy. User creation on signup goes through the
-- on_auth_user_created trigger → handle_new_auth_user() which is
-- SECURITY DEFINER (runs as postgres, bypasses RLS). Dropping this
-- policy removes the anon hole without affecting signup.
--
-- VERIFIED: handle_new_auth_user() confirmed as SECURITY DEFINER with
-- search_path='public'. It INSERTs into public.users with role from
-- raw_user_meta_data, status='ACTIF'. ON CONFLICT (id) DO NOTHING.

BEGIN;

DROP POLICY IF EXISTS "Service role can insert users" ON public.users;

COMMIT;
