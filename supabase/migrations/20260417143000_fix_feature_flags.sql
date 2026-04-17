-- Phase 0.3 + 0.4: Fix feature flag inversions
-- can_send_auto_message was inverted; has_list_access aligned with workbook decision (Pro+)

BEGIN;

-- can_send_auto_message: Pro+ gets auto-messaging, Free does not
UPDATE subscription_features_recruteur SET can_send_auto_message = true
  WHERE tier IN ('pro', 'all_star');
UPDATE subscription_features_recruteur SET can_send_auto_message = false
  WHERE tier = 'free';

-- has_list_access: Custom lists are Pro+ (per workbook decision, not All Star as CLAUDE.md claimed)
UPDATE subscription_features_recruteur SET has_list_access = true
  WHERE tier IN ('pro', 'all_star');
UPDATE subscription_features_recruteur SET has_list_access = false
  WHERE tier = 'free';

COMMIT;
