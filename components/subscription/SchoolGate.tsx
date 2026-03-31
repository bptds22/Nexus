"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   SchoolGate — Wraps school management pages
   Access: Coach Pro OR Coach All Star OR Admin École
═══════════════════════════════════════════════════════════════ */

export default function SchoolGate({ children }: { children: React.ReactNode }) {
  const [hasAccess, setHasAccess] = useState(false);
  const [checked, setChecked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
      const tier = user.subscription?.tier || "free";
      if (tier === "coach_pro" || tier === "coach_allstar" || user.is_school_admin === true) {
        setHasAccess(true);
      }
    } catch { /* noop */ }
    setChecked(true);
  }, []);

  if (!checked) return null;
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
            Passer à Pro — 5,99$/mois →
          </button>
          <Link href="/tarifs" className="text-[12px] text-[#6B7280] hover:text-white transition-colors">
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
