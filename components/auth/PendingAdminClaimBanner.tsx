"use client";

import { useAdminClaim } from "@/lib/hooks/useAdminClaim";

/* ─────────────────────────────────────────────────────────────────
   PendingAdminClaimBanner — Item 11-Security

   Top-of-portal banner that surfaces the PENDING_VERIFICATION state
   to users whose Directeur / Interim claim is still being reviewed
   by a platform admin.

   Rendered from app/coach/layout.tsx (placed beneath the existing
   PreMaintenanceBanner) so it persists across every coach route the
   pending user can reach. The banner suppresses itself for APPROVED
   / REJECTED claims and for users with no claim at all (e.g. coaches
   who picked "Entraîneur seulement" at onboarding).

   The companion ReadOnlyIfPending wrapper disables mutation surfaces
   while this banner is visible.
───────────────────────────────────────────────────────────────── */

export default function PendingAdminClaimBanner() {
  const { claim, loading } = useAdminClaim();
  if (loading || !claim || claim.status !== "PENDING") return null;

  const roleLabel = claim.claim_type === "DIRECTEUR" ? "Directeur sportif" : "Directeur intérimaire";
  const target = claim.school_name ? ` pour ${claim.school_name}` : "";

  return (
    <div
      role="alert"
      className="bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 px-4 py-3 text-[13px] text-[#FCD34D]"
    >
      <div className="max-w-[1280px] mx-auto flex items-start gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="leading-snug">
          <strong className="font-bold uppercase tracking-wider text-[12px]">Compte en attente d&apos;approbation</strong>{" "}
          <span>
            Ton rôle de {roleLabel}{target} est en cours de révision par l&apos;équipe Nexus.
            Tu as accès en lecture seule pendant la vérification — généralement sous 24h.
          </span>
        </div>
      </div>
    </div>
  );
}
