-- Atomic upsert for stripe_customer_id — fixes TOCTOU race in checkout route.
--
-- On INSERT (new user, no subscriptions row): creates row with free/active/stripe defaults.
-- On CONFLICT (user already has a row — e.g. admin_grant all_star, or webhook already wrote):
--   ONLY updates stripe_customer_id + updated_at.
--   tier, tier_source, status are DELIBERATELY absent from the SET clause —
--   a webhook-set 'pro' or an admin_grant 'all_star' is NEVER clobbered.
--
-- Called from app/api/stripe/checkout/route.ts via service-role client (.rpc()).
-- SECURITY: REVOKE EXECUTE from public + authenticated — only service_role can call.

CREATE OR REPLACE FUNCTION public.upsert_stripe_customer(
  p_user_id uuid,
  p_customer_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $$
  INSERT INTO public.subscriptions (user_id, stripe_customer_id, tier, status, tier_source)
  VALUES (p_user_id, p_customer_id, 'free', 'active', 'stripe')
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    updated_at = now();
$$;

-- Lock down: only service_role can call this function.
-- PostgREST anon/authenticated roles cannot invoke it via .rpc().
REVOKE EXECUTE ON FUNCTION public.upsert_stripe_customer(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.upsert_stripe_customer(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_stripe_customer(uuid, text) FROM anon;
