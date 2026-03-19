"use client";

import { useState } from "react";
import DirectorSidebar from "@/components/director/DirectorSidebar";
import PlaybookBackground from "../components/PlaybookBackground";

export default function DirecteurEcoleLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <PlaybookBackground />
      <DirectorSidebar portalType="ecole" mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 h-16 flex items-center justify-between">
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="text-[#8a8d96] hover:text-white transition-colors" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" />
            </svg>
          </button>
          <span className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Directeur sportif — École</span>
          <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#8a8d96]">FB</span>
          </div>
        </div>
        <main className="relative z-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
