"use client";

import { useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   SchoolGate — wraps school-management pages.
   Access = Coach Pro OR Admin école (is_school_admin).

   Reads from the DB-backed useSubscription hook (not localStorage),
   so it reflects live tier changes including the DevTierSwitcher.
═══════════════════════════════════════════════════════════════ */

export default function SchoolGate({ children }: { children: React.ReactNode }) {
  const { loading, tier, canSee, isSchoolAdmin } = useSubscription();
  const [toast, setToast] = useState<string | null>(null);

  console.log("[SchoolGate] tier:", tier, "canSee mon_ecole:", canSee("can_see_mon_ecole"), "isSchoolAdmin:", isSchoolAdmin);

  if (loading) return null;

  // Pass through for: Pro, All Star (via canSee) OR Admin école flag.
  const hasAccess = canSee("can_see_mon_ecole") || isSchoolAdmin;
  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none" style={{ filter: "blur(8px)" }} aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#DAB65A]/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          <h3 className="font-head text-lg font-black text-white mb-2">Gestion d&apos;école</h3>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
            Supervise tes coachs, suis les placements et gère ton école directement depuis ton portail coach.
          </p>
          <button
            type="button"
            onClick={() => { setToast("Redirection vers Stripe Checkout (Phase 2)"); setTimeout(() => setToast(null), 3000); }}
            className="w-full h-11 rounded-lg bg-[#DAB65A] text-[#111317] font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#c9a84f] transition-colors mb-2"
          >
            Passer à Pro — 14,99$/mois →
          </button>
          <Link href="/tarifs?role=coach" className="text-[12px] text-[#6B7280] hover:text-white transition-colors">
            Voir les plans
          </Link>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
