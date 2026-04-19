"use client";

import { useSubscription } from "@/lib/hooks/useSubscription";
import UpgradePlaceholder from "./UpgradePlaceholder";

/* ═══════════════════════════════════════════════════════════════
   CegepGate — wraps CÉGEP management pages.

   Access: recruteur All Star OR any user flagged is_school_admin.

   When the user fails the check, CegepGate REPLACES the children
   with UpgradePlaceholder — no blur, no backdrop overlay, no
   offscreen mount. The gated page never runs its data fetches.

   Source of truth: useSubscription() hook (DB-backed).
═══════════════════════════════════════════════════════════════ */

export default function CegepGate({ children }: { children: React.ReactNode }) {
  const { tier, isSchoolAdmin, loading } = useSubscription();

  if (loading) return null;

  const hasAccess = isSchoolAdmin || tier === "all_star";

  if (!hasAccess) {
    return <UpgradePlaceholder tier="all_star" featureName="cegep_management" />;
  }

  return <>{children}</>;
}
