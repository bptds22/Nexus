-- ═══════════════════════════════════════════════════════════════
-- Subscription auto-create trigger + self-read RLS policy.
-- The `subscriptions` table already exists (see seed/002_main_schema.sql)
-- so this is additive — no CREATE TABLE, no enum changes.
--
-- Run in Supabase Studio → SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- 1) Trigger: on every new row in public.users, insert a default
--    free subscription (status = active, tier = free).
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_subscription ON public.users;
CREATE TRIGGER on_user_created_subscription
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_subscription();

-- 2) Backfill: any existing user without a subscription row gets one.
INSERT INTO public.subscriptions (user_id, tier, status)
SELECT u.id, 'free', 'active'
FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL;

-- 3) RLS: users can read their own subscription.
--    (subscriptions already has RLS enabled in the base schema;
--     this adds a SELECT-own policy if missing.)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subscription" ON public.subscriptions;
CREATE POLICY "Users can read own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4) Dev convenience: allow a user to upsert their own subscription row
--    so DevTierSwitcher works without needing the service role key.
--    In production, remove this policy and drive tier changes through
--    a server-side Stripe webhook instead.
DROP POLICY IF EXISTS "Users can upsert own subscription (dev)" ON public.subscriptions;
CREATE POLICY "Users can upsert own subscription (dev)"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription (dev)" ON public.subscriptions;
CREATE POLICY "Users can update own subscription (dev)"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5) Verify.
SELECT
  (SELECT COUNT(*) FROM public.users)          AS users_total,
  (SELECT COUNT(*) FROM public.subscriptions)  AS subs_total,
  (SELECT COUNT(*) FROM public.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE s.id IS NULL)                        AS users_missing_sub;
