-- F6-C1 CRITICAL: consume_invitation_token can modify ANY user's school_id
--
-- VULNERABILITY: The function takes p_new_user_id as a parameter with NO
-- auth.uid() check. Any authenticated user who knows a valid invitation
-- token can call rpc('consume_invitation_token', { p_token, p_new_user_id })
-- with ANY user's UUID → sets the victim's school_id to the invitation's
-- school. This bypasses the intended flow (only called by handle_new_auth_user
-- during signup with NEW.id).
--
-- FIX: Add auth.uid() enforcement. The function should only allow setting
-- school_id on the caller's own account. The trigger path (handle_new_auth_user)
-- calls this as SECURITY DEFINER → auth.uid() may not be set during signup
-- trigger. Use: if auth.uid() IS NOT NULL (RPC call), enforce p_new_user_id =
-- auth.uid(). If auth.uid() IS NULL (trigger context), allow (the trigger is
-- already privileged).

CREATE OR REPLACE FUNCTION public.consume_invitation_token(p_token text, p_new_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = 'off'
SET search_path = 'public'
AS $function$
DECLARE
  v_invitation_id uuid;
  v_school_id uuid;
  v_caller uuid;
BEGIN
  -- AUTH GUARD: if called via RPC (auth.uid() is set), only allow
  -- consuming for yourself. In trigger context (signup), auth.uid()
  -- is NULL — allow the trigger to set any user_id.
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller != p_new_user_id THEN
    RAISE EXCEPTION 'consume_invitation_token: cannot consume for another user';
  END IF;

  UPDATE public.invitations
  SET
    status = 'CONSUMED',
    consumed_by_user_id = p_new_user_id,
    consumed_at = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING id, school_id INTO v_invitation_id, v_school_id;

  IF v_school_id IS NOT NULL THEN
    UPDATE public.users
    SET school_id = v_school_id
    WHERE id = p_new_user_id;
  END IF;

  RETURN v_invitation_id;
END;
$function$;
