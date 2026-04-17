"use client";

import { useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   ManageSubscriptionButton — Shows current plan + CTA.
   Used in every portal's Paramètres page under "Abonnement" section.
═══════════════════════════════════════════════════════════════ */

const BILLING_LABELS: Record<string, string> = {
  monthly: "mensuel",
  annual: "annuel",
};

export default function ManageSubscriptionButton() {
  const { tier, tierLabel, billing, periodEnd, loading } = useSubscription();
  const [toast, setToast] = useState<string | null>(null);

  if (loading) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const isPaid = tier !== "free";
  const label = tierLabel();

  return (
    <div>
      {/* Current plan display */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[13px] text-[#9CA3AF]">Plan actuel :</span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
          isPaid
            ? "bg-[#DAB65A]/15 text-[#DAB65A]"
            : "bg-[#6B7280]/15 text-[#6B7280]"
        }`}>
          {isPaid && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
          {label}
          {billing && ` (${BILLING_LABELS[billing] || billing})`}
        </span>
      </div>

      {/* Renewal info */}
      {isPaid && periodEnd && (
        <p className="text-[12px] text-[#6B7280] mb-4">
          Prochain renouvellement : {new Date(periodEnd).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      )}

      {/* Action button */}
      {isPaid ? (
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
