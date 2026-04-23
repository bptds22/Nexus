-- Restore missing trigger that mirrors auth.users → public.users on signup
--
-- The handle_new_auth_user() function already exists (created in baseline)
-- but the trigger that calls it is missing. Without the trigger, every
-- signup creates an auth.users row but no public.users row, leaving the
-- user in a phantom state.
--
-- This was discovered during Phase 5 manual testing — 100% of signups
-- on a fresh DB were failing to create public.users rows.
--
-- The trigger fires AFTER INSERT so the auth.users row is fully committed
-- before the function tries to mirror it.

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
