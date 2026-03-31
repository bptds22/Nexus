-- ============================================================
-- NEXUS — Migration 003: Auth & JWT Role Claims
-- Run in Supabase Studio SQL Editor
-- ============================================================

-- ============================================================
-- 1. AUTO-CREATE users row when auth.users is created
--    (links Supabase Auth to our public.users table)
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'ATHLETE'
    ),
    'ACTIF'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================
-- 2. JWT CUSTOM CLAIMS
--    Adds role to the JWT token so middleware can read it
--    without querying the DB on every request
-- ============================================================

CREATE OR REPLACE FUNCTION custom_jwt_claims(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims    jsonb;
  user_role TEXT;
BEGIN
  claims := event -> 'claims';

  SELECT role::TEXT INTO user_role
  FROM public.users
  WHERE id = (event->>'userId')::UUID;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. HELPER: get current user role from JWT
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'user_role',
    'ATHLETE'
  );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- 4. HELPER: check if current user is admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'ADMIN';
$$ LANGUAGE sql STABLE;

-- ============================================================
-- VERIFY
-- ============================================================
-- After running, test with:
-- SELECT handle_new_auth_user(); -- should exist
-- SELECT get_my_role();          -- returns role from JWT