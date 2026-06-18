-- Add tier_source to subscriptions: distinguishes Stripe-paid vs admin-granted.
--
-- The webhook (built next) will ONLY update rows WHERE tier_source = 'stripe'.
-- Admin grants (tier_source = 'admin_grant') are protected: the webhook
-- never touches them, so an admin can grant Pro/All Star free without risk
-- of it being overwritten when the user's Stripe subscription changes.
--
-- Existing rows: 7 non-free rows with stripe_customer_id = NULL are admin
-- grants. The DEFAULT for the ALTER is 'stripe', but we immediately backfill
-- NULL-stripe rows to 'admin_grant'.

ALTER TABLE public.subscriptions
  ADD COLUMN tier_source text NOT NULL DEFAULT 'stripe'
  CHECK (tier_source IN ('stripe', 'admin_grant'));

-- Backfill: existing rows without stripe_customer_id are admin grants
UPDATE public.subscriptions
SET tier_source = 'admin_grant'
WHERE stripe_customer_id IS NULL
  AND tier != 'free';
