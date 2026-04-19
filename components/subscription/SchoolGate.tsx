"use client";

import { useSubscription } from "@/lib/hooks/useSubscription";
import UpgradePlaceholder from "./UpgradePlaceholder";

/* ═══════════════════════════════════════════════════════════════
   SchoolGate — wraps school-management pages.
   Access = Coach Pro OR Admin école (is_school_admin).

   When the user fails the check, SchoolGate REPLACES the children
   with UpgradePlaceholder — no blur, no offscreen mount. The gated
   page's useEffects and Supabase calls never execute.

   Source of truth: useSubscription() hook (DB-backed).
═══════════════════════════════════════════════════════════════ */

export default function SchoolGate({ children }: { children: React.ReactNode }) {
  const { loading, canSee, isSchoolAdmin } = useSubscription();

  if (loading) return null;

  // Pass through for: Pro, All Star (via canSee) OR Admin école flag.
  const hasAccess = canSee("can_see_mon_ecole") || isSchoolAdmin;

  if (!hasAccess) {
    return <UpgradePlaceholder tier="pro" featureName="school_management" />;
  }

  return <>{children}</>;
}
