-- Phase 0.2 + 0.2.5: Rename recruteur tier enums + normalize all tier values to lowercase

BEGIN;

-- ============================================================
-- Part A: Rename recruteur tier values
-- starter -> pro, pro -> all_star, free -> free
-- ============================================================

ALTER TABLE subscription_features_recruteur ADD COLUMN tier_new TEXT;

UPDATE subscription_features_recruteur SET tier_new = CASE
  WHEN tier = 'free'    THEN 'free'
  WHEN tier = 'starter' THEN 'pro'
  WHEN tier = 'pro'     THEN 'all_star'
  ELSE tier
END;

ALTER TABLE subscription_features_recruteur DROP COLUMN tier;
ALTER TABLE subscription_features_recruteur RENAME COLUMN tier_new TO tier;
ALTER TABLE subscription_features_recruteur ALTER COLUMN tier SET NOT NULL;
ALTER TABLE subscription_features_recruteur ADD PRIMARY KEY (tier);

-- ============================================================
-- Part B: Rename recruteur tiers in subscriptions table
-- (single CASE to avoid two-pass ordering bug)
-- ============================================================

UPDATE subscriptions SET tier = CASE
  WHEN tier = 'pro'     THEN 'all_star'
  WHEN tier = 'starter' THEN 'pro'
  ELSE tier
END
WHERE user_id IN (SELECT id FROM users WHERE role = 'RECRUTEUR')
  AND tier IN ('starter', 'pro');

-- ============================================================
-- Part C: Normalize all tier values to lowercase
-- ============================================================

UPDATE subscriptions SET tier = LOWER(tier) WHERE tier != LOWER(tier);
UPDATE subscription_features_coach SET tier = LOWER(tier) WHERE tier != LOWER(tier);
UPDATE subscription_features_athlete SET tier = LOWER(tier) WHERE tier != LOWER(tier);
UPDATE subscription_features_recruteur SET tier = LOWER(tier) WHERE tier != LOWER(tier);

-- ============================================================
-- Part D: CHECK constraints to prevent future casing drift
-- ============================================================

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_tier_lowercase
  CHECK (tier = LOWER(tier));

ALTER TABLE subscription_features_coach
  ADD CONSTRAINT coach_features_tier_lowercase
  CHECK (tier = LOWER(tier));

ALTER TABLE subscription_features_athlete
  ADD CONSTRAINT athlete_features_tier_lowercase
  CHECK (tier = LOWER(tier));

ALTER TABLE subscription_features_recruteur
  ADD CONSTRAINT recruteur_features_tier_lowercase
  CHECK (tier = LOWER(tier));

COMMIT;
