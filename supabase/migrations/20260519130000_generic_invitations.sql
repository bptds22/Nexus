-- Generic invitations table — replaces the dead public.invitations
-- referenced by app/recruteur/parametres/page.tsx:223.
--
-- One-table-fits-all design per 2026-05-19 product decision:
--   - Any authenticated user can invite anyone else by email (UI
--     gates to directeur sportif via isAdmin; RLS keeps INSERT open
--     to authenticated since the helper enforces school scoping)
--   - Invitee receives a link with a token (copy-link UX for now,
--     Resend email send wires later)
--   - Clicking the link routes through normal onboarding; signup
--     page reads invitation_token from URL, pre-fills school_id +
--     locale; invitee picks their own role during onboarding
--   - On signup completion, handle_new_auth_user calls
--     consume_invitation_token() to mark the row CONSUMED and
--     propagate school_id to the new user
--
-- Canada-wide ready: locale column from day one (fr-CA / en-CA),
-- expandable CHECK. Loi 25 friendly: 30-day expiry, no PII beyond
-- email, audit trail via invited_by + consumed_by_user_id.

CREATE TYPE public.invitation_status AS ENUM (
  'PENDING',
  'CONSUMED',
  'EXPIRED',
  'REVOKED'
);

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  message text,
  locale text NOT NULL DEFAULT 'fr-CA'
    CHECK (locale IN ('fr-CA', 'en-CA')),
  status public.invitation_status NOT NULL DEFAULT 'PENDING',
  consumed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_token_idx ON public.invitations(token);
CREATE INDEX invitations_email_idx ON public.invitations(lower(email));
CREATE INDEX invitations_invited_by_idx ON public.invitations(invited_by);
CREATE INDEX invitations_status_idx ON public.invitations(status) WHERE status = 'PENDING';

CREATE TRIGGER trg_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users invite from their own school"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND status = 'PENDING'
  AND (
    school_id IS NULL
    OR school_id = public.current_user_school_id()
  )
);

CREATE POLICY "Users read their own invitations"
ON public.invitations
FOR SELECT
TO authenticated
USING (
  invited_by = auth.uid()
  OR consumed_by_user_id = auth.uid()
  OR public.is_admin()
);

CREATE POLICY "Users revoke their own pending invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  (invited_by = auth.uid() AND status = 'PENDING')
  OR public.is_admin()
)
WITH CHECK (
  (invited_by = auth.uid() AND status = 'REVOKED')
  OR public.is_admin()
);

CREATE POLICY "Admins delete invitations"
ON public.invitations
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.resolve_invitation_token(p_token text)
RETURNS TABLE(
  email text,
  school_id uuid,
  school_name text,
  locale text,
  message text,
  inviter_first_name text,
  inviter_last_name text,
  status public.invitation_status,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $func$
BEGIN
  RETURN QUERY
  SELECT
    i.email,
    i.school_id,
    s.name AS school_name,
    i.locale,
    i.message,
    u.first_name AS inviter_first_name,
    u.last_name AS inviter_last_name,
    i.status,
    i.expires_at
  FROM public.invitations i
  LEFT JOIN public.schools s ON s.id = i.school_id
  LEFT JOIN public.users u ON u.id = i.invited_by
  WHERE i.token = p_token
  LIMIT 1;
END;
$func$;

CREATE OR REPLACE FUNCTION public.consume_invitation_token(
  p_token text,
  p_new_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $func$
DECLARE
  v_invitation_id uuid;
  v_school_id uuid;
BEGIN
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
$func$;

COMMENT ON TABLE public.invitations IS
  'Generic platform invitations. One inviter, one email, one optional school. Invitee picks role during normal onboarding. Email send wires up via Resend; today UX is copy-link.';