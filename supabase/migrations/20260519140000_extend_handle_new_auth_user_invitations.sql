-- Extend handle_new_auth_user to consume invitation tokens when
-- signup metadata includes invitation_token. After the existing
-- INSERT into public.users (which is already idempotent via ON
-- CONFLICT DO NOTHING), call consume_invitation_token() to mark
-- the row CONSUMED and propagate school_id to the new user.
--
-- This is additive to the prior extension at
-- 20260516150000_extend_handle_new_auth_user_metadata. The body
-- of the function is reproduced in full here (since CREATE OR
-- REPLACE doesn't merge, it replaces).

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation_token text;
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

  -- Consume invitation token if present in signup metadata.
  -- consume_invitation_token is SECURITY DEFINER + row_security=off
  -- so it can write to invitations + users atomically.
  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_invitation_token IS NOT NULL AND v_invitation_token != '' THEN
    PERFORM public.consume_invitation_token(v_invitation_token, NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Mirrors auth.users → public.users on signup. Reads first_name, last_name, context, invitation_token from raw_user_meta_data (set by signUp() options.data). Consumes any provided invitation_token to propagate school_id. SECURITY DEFINER bypasses RLS + GRANT.';
