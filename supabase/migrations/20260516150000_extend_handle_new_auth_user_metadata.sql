-- ────────────────────────────────────────────────────────────────
-- Extend handle_new_auth_user to read first_name / last_name / context
-- from raw_user_meta_data
-- ────────────────────────────────────────────────────────────────
-- Background:
--
-- The signUp() helper in lib/supabase/auth.actions.ts historically
-- did a defensive client-side upsert into public.users to land
-- first_name / last_name / context after this trigger fired with
-- only id+email+role+status. That upsert reliably emitted code 42501
-- ("permission denied for table users") for a subtle reason: the
-- only INSERT policy on public.users is "Service role can insert
-- users" gated TO service_role, and PostgREST's upsert always
-- evaluates the INSERT permission check even when the conflict
-- branch would take UPDATE. Authenticated couldn't satisfy it.
--
-- We tried swapping the client upsert to a pure update; that ran
-- into similar role/RLS layering issues we couldn't fully untangle
-- in psql simulation, so the swap was reverted (2070aaf).
--
-- The architectural fix: have THIS trigger (already SECURITY
-- DEFINER, bypasses RLS + GRANT) write everything atomically. The
-- raw_user_meta_data JSONB already carries first_name / last_name /
-- context from signUp()'s options.data — we just weren't reading
-- them out.
--
-- Post-migration the client-side upsert becomes redundant and is
-- removed in the same commit.
-- ────────────────────────────────────────────────────────────────
--
-- Changes vs prior definition :
--   • Adds first_name, last_name, context to the INSERT column list
--   • Reads first_name / last_name straight from raw_user_meta_data
--   • Context goes through a defensive CASE that maps to NULL for
--     any unexpected value — guards the users_context_check CHECK
--     constraint ('scolaire' | 'collegial' | 'ligue_civile') against
--     a future client passing a typo
--
-- Unchanged :
--   • role: still COALESCE with 'ATHLETE' fallback, still cast to
--     public.user_role enum
--   • status: still 'ACTIF'::public.account_status
--   • ON CONFLICT (id) DO NOTHING idempotency
--   • SECURITY DEFINER + SET search_path TO 'public'
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (
    id, email, role, status, first_name, last_name, context
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'ATHLETE'::public.user_role
    ),
    'ACTIF'::public.account_status,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE NEW.raw_user_meta_data->>'context'
      WHEN 'scolaire'     THEN 'scolaire'
      WHEN 'collegial'    THEN 'collegial'
      WHEN 'ligue_civile' THEN 'ligue_civile'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Mirrors auth.users → public.users on signup. Reads first_name, last_name, context from raw_user_meta_data (set by signUp() options.data). SECURITY DEFINER bypasses RLS — replaces the client-side upsert that hit 42501.';
