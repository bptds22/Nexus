-- Phase 0.5: Standardize "unlimited" as -1 (was NULL) + add max_athletes cap for coaches

BEGIN;

-- ============================================================
-- Part A: NULL -> -1 for unlimited sentinel in recruteur limits
-- (avoids the "null >= 10 is false" landmine)
-- ============================================================

UPDATE subscription_features_recruteur SET max_favorites = -1
  WHERE max_favorites IS NULL;

UPDATE subscription_features_recruteur SET max_search_results = -1
  WHERE max_search_results IS NULL;

UPDATE subscription_features_recruteur SET coaches_per_team = -1
  WHERE coaches_per_team IS NULL;

-- ============================================================
-- Part B: Add max_athletes cap to coach features
-- Free coaches cap at 30 athletes; Pro/All Star unlimited (-1)
-- ============================================================

ALTER TABLE subscription_features_coach ADD COLUMN IF NOT EXISTS max_athletes INTEGER;

UPDATE subscription_features_coach SET max_athletes = 30  WHERE tier = 'free';
UPDATE subscription_features_coach SET max_athletes = -1  WHERE tier IN ('pro', 'all_star');

ALTER TABLE subscription_features_coach ALTER COLUMN max_athletes SET NOT NULL;

COMMIT;
