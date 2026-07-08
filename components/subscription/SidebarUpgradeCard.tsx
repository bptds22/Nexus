"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/hooks/useSubscription";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   SidebarUpgradeCard — Smart subscription block for all sidebars.
   Shows: upgrade nudge (free/pro) + plan status indicator.
   Adapts to: free, pro, allstar, trial, admin, past_due, canceled.
   Source of truth: useSubscription() hook (DB-backed).
═══════════════════════════════════════════════════════════════ */

type SidebarState = "free" | "pro" | "allstar" | "trial" | "admin" | "past_due" | "canceled";

function resolveState(
  tier: "free" | "pro" | "all_star",
  status: "active" | "trialing" | "past_due" | "canceled",
  isSchoolAdmin: boolean,
): SidebarState {
  if (isSchoolAdmin) return "admin";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  if (status === "trialing") return "trial";
  if (tier === "all_star") return "allstar";
  if (tier === "pro") return "pro";
  return "free";
}

export default function SidebarUpgradeCard() {
  const {
    tier, role, status, isSchoolAdmin,
    periodEnd, trialDaysRemaining, tierLabel,
    loading,
  } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [adminKind, setAdminKind] = useState<"school" | "cegep" | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("nexus_sidebar_upgrade_dismissed")) setDismissed(true);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (isSchoolAdmin) {
      setAdminKind(role === "recruiter" ? "cegep" : "school");
    } else {
      setAdminKind(null);
    }
  }, [isSchoolAdmin, role]);

  if (loading) return null;

  const state = resolveState(tier, status, isSchoolAdmin);
  const renewalDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })
    : null;
  const label = tierLabel();
  const isAthlete = role === "athlete";

  // Determine if we should show an upgrade card
  const showUpgrade = !dismissed && (state === "free" || state === "pro") && !isAthlete || (state === "free" && isAthlete);
  const showProUpgrade = state === "free";
  const showAllStarUpgrade = state === "pro" && !isAthlete;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("nexus_sidebar_upgrade_dismissed", "true"); } catch { /* noop */ }
  };

  const settingsHref = isAthlete
    ? "/athlete/parametres"
    : role === "coach"
    ? "/coach/settings"
    : "/recruteur/parametres";

  return (
    <div className="px-3 mb-1">
      {/* ── Upgrade nudge card ── (masquée sur iOS — 3.1.1) */}
      {!IS_CAPACITOR && showUpgrade && !dismissed && (
        <div className="relative group/upgrade mb-2">
          <Link
            href="/tarifs"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200"
            style={{
              background: showAllStarUpgrade ? "rgba(230,57,70,0.06)" : "rgba(218,182,90,0.08)",
              borderColor: showAllStarUpgrade ? "rgba(230,57,70,0.2)" : "rgba(218,182,90,0.2)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = showAllStarUpgrade ? "rgba(230,57,70,0.1)" : "rgba(218,182,90,0.12)"; e.currentTarget.style.borderColor = showAllStarUpgrade ? "rgba(230,57,70,0.35)" : "rgba(218,182,90,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = showAllStarUpgrade ? "rgba(230,57,70,0.06)" : "rgba(218,182,90,0.08)"; e.currentTarget.style.borderColor = showAllStarUpgrade ? "rgba(230,57,70,0.2)" : "rgba(218,182,90,0.2)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={showAllStarUpgrade ? "#E63946" : "#DAB65A"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="font-head font-bold text-[12px] leading-tight" style={{ color: showAllStarUpgrade ? "#E63946" : "#DAB65A" }}>
                {showProUpgrade ? "Passe à Pro" : "Passe à All Star"}
              </p>
              <p className="text-[9px] text-[#9CA3AF] leading-tight mt-0.5">Essai gratuit 14 jours</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={showAllStarUpgrade ? "#E63946" : "#DAB65A"} strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-40 group-hover/upgrade:opacity-100 transition-opacity"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <button type="button" onClick={handleDismiss} className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center opacity-0 group-hover/upgrade:opacity-100 transition-opacity duration-200 z-10" aria-label="Fermer">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ── Plan status indicator ── */}
      <Link href={settingsHref} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/5 transition-colors">
        {state === "free" && (
          <>
            <span className="w-2 h-2 rounded-full bg-[#6B7280] shrink-0" />
            <span className="text-[11px] text-[#6B7280]">Plan Gratuit</span>
          </>
        )}
        {state === "pro" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#DAB65A] shrink-0" />
              <span className="text-[11px] text-[#DAB65A] font-semibold">{label}</span>
            </div>
            {renewalDate && <span className="text-[10px] text-[#6B7280] ml-4">Renouvelle le {renewalDate}</span>}
          </div>
        )}
        {state === "allstar" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              <span className="text-[11px] text-[#E63946] font-bold">All Star</span>
            </div>
            {renewalDate && <span className="text-[10px] text-[#6B7280] ml-4">Renouvelle le {renewalDate}</span>}
          </div>
        )}
        {state === "trial" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0 animate-pulse" />
              <span className="text-[11px] text-[#22C55E] font-semibold">Essai {tier === "all_star" ? "All Star" : "Pro"}</span>
            </div>
            {trialDaysRemaining != null && (
              <span className={`text-[10px] ml-4 ${trialDaysRemaining <= 3 ? "text-[#EAB308]" : "text-[#6B7280]"}`}>
                {trialDaysRemaining} jours restants
              </span>
            )}
          </div>
        )}
        {state === "admin" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="1.5" strokeLinecap="round"><path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" /><circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" /></svg>
              <span className="text-[11px] text-[#DAB65A] font-semibold">{adminKind === "cegep" ? "Admin CÉGEP" : "Admin École"}</span>
            </div>
            <span className="text-[10px] text-[#6B7280] ml-4">Accès All Star inclus</span>
          </div>
        )}
        {state === "past_due" && (
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <p className="text-[11px] text-[#EF4444] font-semibold">Paiement échoué</p>
              <p className="text-[10px] text-[#EF4444]/70">Mets à jour ta carte →</p>
            </div>
          </div>
        )}
        {state === "canceled" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EAB308] shrink-0" />
              <span className="text-[11px] text-[#EAB308]">Annulé</span>
            </div>
            {renewalDate && <span className="text-[10px] text-[#6B7280] ml-4">Actif jusqu&apos;au {renewalDate}</span>}
          </div>
        )}
      </Link>
    </div>
  );
}
