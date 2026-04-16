"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   FeatureGate (DB-backed) — wraps gated content.

   Props:
     feature         — key in the feature flag table (see useSubscription)
     blurContent     — true (default): show blurred content + lock overlay
                       false: hide completely (for nav items, use opacity)
     placeholder     — optional alternate node to render instead of children
     upgradeMessage  — override the default "Passe à X pour débloquer"
═══════════════════════════════════════════════════════════════ */

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  blurContent?: boolean;
  upgradeMessage?: string;
}

export function FeatureGate({
  feature,
  children,
  placeholder,
  blurContent = true,
  upgradeMessage,
}: FeatureGateProps) {
  const { canSee, requiredTierFor, loading, role } = useSubscription();

  // Don't flash blurred content while the subscription loads.
  if (loading) return null;

  const hasAccess = canSee(feature);
  console.log("[FeatureGate] Checking:", feature, "→", hasAccess);

  if (hasAccess) return <>{children}</>;

  if (placeholder) return <>{placeholder}</>;

  const required = requiredTierFor(feature);
  const tierName = required === "all_star" ? "All Star" : "Pro";
  const message = upgradeMessage || `Passe à ${tierName} pour débloquer`;
  const tarifsHref = `/tarifs?role=${role === "recruiter" ? "recruteur" : role}`;

  if (!blurContent) return null;

  return (
    <div className="relative">
      <div className="filter blur-sm pointer-events-none select-none opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111317]/60 rounded-lg p-4 text-center">
        <Lock className="w-5 h-5 text-gray-400 mb-2" />
        <p className="text-sm text-gray-300">{message}</p>
        <Link
          href={tarifsHref}
          className="mt-2 text-xs font-semibold text-[#F59E0B] hover:text-[#D97706]"
        >
          Voir les plans →
        </Link>
      </div>
    </div>
  );
}

export default FeatureGate;
