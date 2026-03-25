"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   ManageSubscriptionButton — Shows current plan + CTA
   Used in every portal's Paramètres page under "Abonnement" section.
═══════════════════════════════════════════════════════════════ */

const TIER_LABELS: Record<string, string> = {
  free: "Gratuit",
  coach_pro: "Coach Pro",
  recruteur_pro: "Recruteur Pro",
  athlete_pro: "Athlète Pro",
};

const BILLING_LABELS: Record<string, string> = {
  monthly: "mensuel",
  annual: "annuel",
};

export default function ManageSubscriptionButton() {
  const [tier, setTier] = useState("free");
  const [billingCycle, setBillingCycle] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user.tier) setTier(user.tier);
        if (user.billingCycle) setBillingCycle(user.billingCycle);
        if (user.renewalDate) setRenewalDate(user.renewalDate);
      }
    } catch {
      // noop
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isPro = tier !== "free";
  const tierLabel = TIER_LABELS[tier] || tier;

  return (
    <div>
      {/* Current plan display */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[13px] text-[#9CA3AF]">Plan actuel :</span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
          isPro
            ? "bg-[#DAB65A]/15 text-[#DAB65A]"
            : "bg-[#6B7280]/15 text-[#6B7280]"
        }`}>
          {isPro && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
          {tierLabel}
          {billingCycle && ` (${BILLING_LABELS[billingCycle] || billingCycle})`}
        </span>
      </div>

      {/* Renewal info */}
      {isPro && renewalDate && (
        <p className="text-[12px] text-[#6B7280] mb-4">
          Prochain renouvellement : {new Date(renewalDate).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      )}

      {/* Action button */}
      {isPro ? (
        <button
          type="button"
          onClick={() => showToast("Redirection vers Stripe Customer Portal (Phase 2)")}
          className="h-10 px-5 rounded-lg border border-white/15 text-white font-bold text-[12px] uppercase tracking-wider hover:bg-white/5 transition-colors"
        >
          Gérer mon abonnement
        </button>
      ) : (
        <Link
          href="/tarifs"
          className="inline-flex items-center h-10 px-5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
        >
          Passer à Pro
        </Link>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
