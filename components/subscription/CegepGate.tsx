"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   CegepGate — wraps CÉGEP management pages.

   Access: recruteur All Star OR any user flagged is_school_admin
   (the latter grants Pro/All Star-equivalent access via their role,
   mirroring the SchoolGate pattern).

   Source of truth: useSubscription() hook (DB-backed). Reading
   localStorage is no longer allowed — the gate cannot be bypassed
   by editing client state.

   NOTE: children still render (blurred) inside the DOM. Converting
   this to a conditional render is a Phase 4 concern — do NOT change
   that behaviour here.
═══════════════════════════════════════════════════════════════ */

export default function CegepGate({ children }: { children: React.ReactNode }) {
  const { tier, role, isSchoolAdmin, loading } = useSubscription();
  const [toast, setToast] = useState<string | null>(null);

  if (loading) return null;

  const hasAccess = isSchoolAdmin || tier === "all_star";
  if (hasAccess) return <>{children}</>;

  const userIsPro = tier === "pro";
  const userIsRecruiter = role === "recruiter";

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none" style={{ filter: "blur(8px)" }} aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#E63946]/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          <h3 className="font-head text-lg font-black text-white mb-2">Fonctionnalité All Star</h3>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-4">
            {userIsRecruiter
              ? "Supervise tes recruteurs, suis les recrues confirmées et gère ton CÉGEP directement depuis ton portail recruteur."
              : "Cette section est réservée aux administrateurs CÉGEP."}
          </p>
          {userIsPro && userIsRecruiter && (
            <p className="text-[11px] text-[#DAB65A] mb-3">Tu es Pro — passe à All Star pour débloquer la gestion CÉGEP</p>
          )}
          <button
            type="button"
            onClick={() => { setToast("Redirection vers Stripe Checkout (Phase 2)"); setTimeout(() => setToast(null), 3000); }}
            className="w-full h-11 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors mb-2"
          >
            Passer à All Star — 29,99$/mois →
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
