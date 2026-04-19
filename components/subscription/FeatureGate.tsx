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
   table). School/CÉGEP admins bypass.
═══════════════════════════════════════════════════════════════ */

export type GatedFeature =
  | "messaging" | "analytics" | "export_pdf" | "detailed_eval"
  | "video_upload" | "who_viewed" | "bulk_message"
  | "unlimited_pipeline" | "unlimited_favorites" | "unlimited_profiles"
  | "school_management" | "cegep_management";

interface FeatureGateProps {
  feature: GatedFeature;
  requiredTier: "pro" | "all_star";
  children: React.ReactNode;
}

export default function FeatureGate({ feature, requiredTier, children }: FeatureGateProps) {
  const { tier, isSchoolAdmin, loading } = useSubscription();

  if (loading) return null;

  // admins always bypass; all_star bypasses everything; pro bypasses pro-level gates
  const hasAccess =
    isSchoolAdmin ||
    tier === "all_star" ||
    (requiredTier === "pro" && tier === "pro");

  if (!hasAccess) {
    return <UpgradePlaceholder tier={requiredTier} featureName={feature} />;
  }

  return <>{children}</>;
}
