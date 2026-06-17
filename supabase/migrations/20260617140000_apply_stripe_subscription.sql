-- Atomic subscription write for the Stripe webhook.
--
-- INSERT new rows with tier_source='stripe'.
-- ON CONFLICT (user_id): only UPDATE if existing row has tier_source='stripe'.
-- Rows with tier_source='admin_grant' are NEVER modified — the WHERE clause
-- on DO UPDATE silently skips them (0 rows affected, no error).
--
-- Edge case: admin-granted user also pays via Stripe → webhook is ignored,
-- admin grant takes precedence. If admin wants Stripe to take over, they
-- manually flip tier_source to 'stripe' in the admin portal.
--
-- Called from app/api/stripe/webhook/route.ts via service-role client.
-- Locked to service_role only (same pattern as upsert_stripe_customer).

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription(
  p_user_id uuid,
  p_tier text,
  p_status text,
  p_billing_cycle text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean DEFAULT false,
  p_canceled_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $$
  INSERT INTO public.subscriptions (
    user_id, tier, status, billing_cycle,
    stripe_subscription_id, stripe_price_id,
    current_period_start, current_period_end,
    cancel_at_period_end, canceled_at,
    tier_source, updated_at
  ) VALUES (
    p_user_id, p_tier, p_status, p_billing_cycle,
    p_stripe_subscription_id, p_stripe_price_id,
    p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_canceled_at,
    'stripe', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier                    = EXCLUDED.tier,
    status                  = EXCLUDED.status,
    billing_cycle           = EXCLUDED.billing_cycle,
    stripe_subscription_id  = EXCLUDED.stripe_subscription_id,
    stripe_price_id         = EXCLUDED.stripe_price_id,
    current_period_start    = EXCLUDED.current_period_start,
    current_period_end      = EXCLUDED.current_period_end,
    cancel_at_period_end    = EXCLUDED.cancel_at_period_end,
    canceled_at             = EXCLUDED.canceled_at,
    tier_source             = 'stripe',
    updated_at              = now()
  WHERE subscriptions.tier_source = 'stripe';
$$;

REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(
  uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) FROM public;
REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(
  uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stripe_subscription(
  uuid, text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) FROM anon;
