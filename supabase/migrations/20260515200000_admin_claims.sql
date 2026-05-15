-- ────────────────────────────────────────────────────────────────
-- admin_claims — Item 11-Security
-- ────────────────────────────────────────────────────────────────
-- Tracks coach onboarding requests to take a Directeur or Interim
-- admin role on a school. New signups that pick an admin role
-- INSERT a row here with status='PENDING'. A platform admin reviews
-- the claim from /admin/approvals and either APPROVES (which the
-- companion trigger — added in 20260515210000_admin_claim_approval_trigger.sql —
-- promotes to users.is_school_admin = true + profile_data.admin_type)
-- or REJECTS (user stays Coach-only).
--
-- This migration ships the table, RLS, and indexes only. The
-- approval trigger is intentionally split into its own migration so
-- it can land alongside the /admin/approvals UI without locking the
-- table during the first migration's deploy.
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('DIRECTEUR', 'INTERIM')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

-- Only one PENDING claim per (user, school). Approved/rejected
-- claims can coexist as historical record.
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_claims_one_pending_per_user_school
  ON public.admin_claims (user_id, school_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_admin_claims_pending_status
  ON public.admin_claims (status)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_admin_claims_user
  ON public.admin_claims (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_claims_school
  ON public.admin_claims (school_id);

ALTER TABLE public.admin_claims ENABLE ROW LEVEL SECURITY;

-- Platform admins can read every claim — they need the full review
-- queue to triage.
CREATE POLICY admin_claims_admin_select ON public.admin_claims
  FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- Platform admins can update status / reviewed_at / reviewer_id /
-- rejection_reason. The approval trigger fires on status changes.
CREATE POLICY admin_claims_admin_update ON public.admin_claims
  FOR UPDATE
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- Users see only their own claim — used by the PendingAdminClaimBanner
-- hook to determine if a banner should render.
CREATE POLICY admin_claims_user_select_own ON public.admin_claims
  FOR SELECT
  USING (user_id = auth.uid());

-- Wizard insert: a user can only insert a claim for themselves.
-- school_id is not gated here — the wizard already requires the user
-- to have selected an institution via canProceed() before reaching
-- finish().
CREATE POLICY admin_claims_user_insert_own ON public.admin_claims
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.admin_claims IS
  'Item 11-Security: PENDING_VERIFICATION queue for coach signups claiming Directeur/Interim admin roles. Reviewed from /admin/approvals.';
