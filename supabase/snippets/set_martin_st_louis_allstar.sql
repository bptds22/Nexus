-- ═══════════════════════════════════════════════════════════════
-- Dev helper: put Martin St-Louis on the All Star tier for testing.
-- Run in Supabase Studio → SQL Editor.
-- Schema: subscriptions has UNIQUE(user_id), tier TEXT DEFAULT 'free'.
-- ═══════════════════════════════════════════════════════════════

-- 1. Confirm which Martin St-Louis the script will target.
--    If this returns multiple rows, edit the WHERE clause below to
--    the exact id/email before running step 2.
SELECT id, email, first_name, last_name, role, status
FROM public.users
WHERE first_name ILIKE 'martin'
  AND (last_name ILIKE 'st-louis' OR last_name ILIKE 'st louis' OR last_name ILIKE 'saint-louis');

-- 2. Upsert Martin's subscription → All Star, active, annual cycle.
--    - If a subscriptions row exists for him (UNIQUE user_id), update it.
--    - If not, insert a new row.
WITH target AS (
  SELECT id
  FROM public.users
  WHERE first_name ILIKE 'martin'
    AND (last_name ILIKE 'st-louis' OR last_name ILIKE 'st louis' OR last_name ILIKE 'saint-louis')
  LIMIT 1
)
INSERT INTO public.subscriptions (
  user_id,
  tier,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  cancel_at_period_end
)
SELECT
  target.id,
  'allstar',
  'active',
  'annual',
  NOW(),
  NOW() + INTERVAL '1 year',
  FALSE
FROM target
ON CONFLICT (user_id) DO UPDATE
SET
  tier                  = EXCLUDED.tier,
  status                = EXCLUDED.status,
  billing_cycle         = EXCLUDED.billing_cycle,
  current_period_end    = EXCLUDED.current_period_end,
  cancel_at_period_end  = EXCLUDED.cancel_at_period_end,
  updated_at            = NOW();

-- 3. Verify the result.
SELECT u.id, u.email, u.first_name, u.last_name, s.tier, s.status, s.billing_cycle, s.current_period_end
FROM public.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE u.first_name ILIKE 'martin'
  AND (u.last_name ILIKE 'st-louis' OR u.last_name ILIKE 'st louis' OR u.last_name ILIKE 'saint-louis');
