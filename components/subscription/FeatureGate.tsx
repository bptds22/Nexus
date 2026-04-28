"use client";

import { useSubscription } from "@/lib/hooks/useSubscription";
import UpgradePlaceholder from "./UpgradePlaceholder";

/* ═══════════════════════════════════════════════════════════════
   FeatureGate — DB-backed gate that CONDITIONALLY RENDERS children.

   When the user's tier doesn't meet requiredTier, the children are
   REPLACED by UpgradePlaceholder — they are NOT rendered blurred,
   NOT mounted in the React tree, and their useEffect / Supabase
   calls never fire. This closes the "blur-leaks-data" class of bug
   where the Network tab revealed gated data despite the visual lock.

   Source of truth: useSubscription() hook (reads the `subscriptions`
   table). Admin bypass is OPT-IN per call via the adminBypass prop —
   set to true only for items directors need regardless of tier.
   Default behavior is tier-only.
═══════════════════════════════════════════════════════════════ */

export type GatedFeature =
  | "messaging" | "analytics" | "export_pdf" | "detailed_eval"
  | "video_upload" | "who_viewed" | "bulk_message"
  | "unlimited_pipeline" | "unlimited_favorites" | "unlimited_profiles"
  | "school_management" | "cegep_management"
  | "custom_lists" | "activity_feed";

interface FeatureGateProps {
  feature: GatedFeature;
  requiredTier: "pro" | "all_star";
  children: React.ReactNode;
  /** When true, school admins (is_school_admin=true) bypass the
   *  tier requirement. Default false. Use for operational items
   *  directors must access regardless of tier (e.g. CÉGEP
   *  Recruteurs/Réassignation/Inviter). Leave unset for tier-only
   *  features. */
  adminBypass?: boolean;
}

export default function FeatureGate({
  feature,
  requiredTier,
  children,
  adminBypass = false,
}: FeatureGateProps) {
  const { tier, isSchoolAdmin, loading } = useSubscription();

  if (loading) return null;

  // Per-call admin bypass (default false): only items that should
  // unlock for directors regardless of tier set this true.
  // all_star bypasses all tier gates; pro bypasses pro-level only.
  const hasAccess =
    (isSchoolAdmin && adminBypass) ||
    tier === "all_star" ||
    (requiredTier === "pro" && tier === "pro");

  if (!hasAccess) {
    return <UpgradePlaceholder tier={requiredTier} featureName={feature} />;
  }

  return <>{children}</>;
}
