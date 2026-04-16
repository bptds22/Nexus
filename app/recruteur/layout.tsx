"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import RecruiterSidebar from "./_components/RecruiterSidebar";
import PlaybookBackground from "../components/PlaybookBackground";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";
import DevTierSwitcher from "@/components/dev/DevTierSwitcher";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Shell Layout
   Sidebar nav + main content area.
   Same dark bg as coach, with PlaybookBackground.
───────────────────────────────────────────────────────────────── */

export default function RecruteurLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RecruteurLayoutInner>{children}</RecruteurLayoutInner>
    </Suspense>
  );
}

function RecruteurLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <DeactivationGuard />
      <PlaybookBackground />

      {/* Sidebar — hidden in preview mode */}
      {!isPreview && (
        <RecruiterSidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-h-screen">
        <PreMaintenanceBanner />
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="text-[#8a8d96] hover:text-white transition-colors"
            aria-label="Menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18" />
              <path d="M3 6h18" />
              <path d="M3 18h18" />
            </svg>
          </button>
          <span className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">
            Portail recruteur
          </span>
          <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#8a8d96]">PD</span>
          </div>
        </div>

        {/* Page content */}
        <main className="relative z-10 flex-1">
          {children}
        </main>
      </div>
      <DevTierSwitcher />
    </div>
  );
}
