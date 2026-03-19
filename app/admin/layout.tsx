"use client";

import { useState } from "react";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import AdminSidebar from "./_components/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <PlaybookBackground />
      <AdminSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/90 backdrop-blur-sm border-b border-[#1e2128] h-16 flex items-center px-4 gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-white p-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <span className="font-head text-sm font-bold text-white uppercase tracking-wider">Portail Admin</span>
        </div>
        <main className="relative z-10 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
