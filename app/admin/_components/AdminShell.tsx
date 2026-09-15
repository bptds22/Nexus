"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";

/* ─────────────────────────────────────────────────────────────────
   AdminShell — client wrapper that holds the mobile menu state
   and renders the sidebar + chrome around server-rendered children.

   Lifted out of app/admin/layout.tsx so the layout itself can be
   an async server component and run the is_platform_admin guard
   server-side.
───────────────────────────────────────────────────────────────── */

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <DeactivationGuard />
      <PlaybookBackground />
      <AdminSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {/* min-w-0 : un élément flex a `min-width: auto` par défaut, donc il
          REFUSE de rétrécir sous la largeur de son contenu. Une page admin
          portant un tableau à largeur minimale (ex. /admin/ambassadeurs,
          min-w-[720px] dans un conteneur overflow-x-auto) forçait alors TOUTE
          la coquille à 770 px : à 390 px, c'est la PAGE entière qui défilait
          latéralement au lieu du seul tableau — mesuré 770 vs 390, ramené à
          390 par ce seul mot.
          Inerte pour les autres pages : vérifié à 390 px, /admin/utilisateurs
          et /admin/approvals rendent déjà 390 et n'ont donc rien à rétrécir. */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <PreMaintenanceBanner />
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/90 backdrop-blur-sm border-b border-[#1e2128] h-16 flex items-center px-4 gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            title="Menu"
            aria-label="Menu"
            className="text-white p-2"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="font-head text-sm font-bold text-white uppercase tracking-wider">Portail Admin</span>
        </div>
        <main className="relative z-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
