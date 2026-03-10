"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Shell Layout
   Shared top-nav with portal tabs + Nexus branding.
   Dark navy bg, playbook overlay, nx-no-glow (no red ambient glow).
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* ── Portal navigation tabs ──────────────────────────────────── */

const PORTAL_TABS = [
  {
    label: "Découvrir",
    href: "/recruiter/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    label: "Favoris",
    href: "/recruiter/favorites",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    label: "Demandes",
    href: "/recruiter/requests",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: "Analytique",
    href: "/recruiter/analytics",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    ),
  },
];

export default function RecruiterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />

      {/* ══════════════════════════════════════════
          TOP NAV — recruiter portal
      ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[#060A14]/92 backdrop-blur-md border-b border-[#1E2D4A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Main nav row */}
          <div className="h-16 flex items-center justify-between">

            {/* Logo + portal label */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <Image
                  src="/brand/Profile%20white%20trans@4x.png"
                  alt="Nexus"
                  width={28}
                  height={28}
                  className="object-contain nx-logo-dark"
                />
                <Image
                  src="/brand/Profile%20trans@4x.png"
                  alt="Nexus"
                  width={28}
                  height={28}
                  className="object-contain nx-logo-light"
                />
                <span className="font-head font-black text-white text-sm tracking-[0.06em] uppercase hidden sm:block">
                  Nexus
                </span>
              </Link>
              <span className="hidden sm:block w-px h-5 bg-[#1E2D4A]" />
              <span className={`hidden sm:block ${label} text-[#475569]`}>
                Portail recruteur
              </span>
            </div>

            {/* Desktop tabs */}
            <div className="hidden md:flex items-center gap-1">
              {PORTAL_TABS.map((tab) => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href === "/recruiter/dashboard" &&
                    pathname === "/recruiter");
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`
                      relative flex items-center gap-2 px-4 h-16 font-head text-[11px] font-bold uppercase tracking-[0.15em] transition-colors
                      ${isActive
                        ? "text-white"
                        : "text-[#9AA3B2] hover:text-white"
                      }
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-wl-red rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side: theme toggle + user avatar placeholder */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {/* User avatar placeholder */}
              <div className="w-8 h-8 rounded-full bg-[#1E2D4A] border border-[#3D5578] flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#9AA3B2]">MR</span>
              </div>
              {/* Mobile hamburger */}
              <button
                type="button"
                className="md:hidden text-[#9AA3B2] hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileMenuOpen ? (
                    <>
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </>
                  ) : (
                    <>
                      <path d="M3 12h18" />
                      <path d="M3 6h18" />
                      <path d="M3 18h18" />
                    </>
                  )}
                </svg>
              </button>
            </div>

          </div>

          {/* Mobile tab menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-[#1E2D4A] pt-3 flex flex-col gap-1">
              {PORTAL_TABS.map((tab) => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href === "/recruiter/dashboard" &&
                    pathname === "/recruiter");
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg font-head text-[11px] font-bold uppercase tracking-[0.15em] transition-colors
                      ${isActive
                        ? "text-white bg-wl-red/10"
                        : "text-[#9AA3B2] hover:text-white hover:bg-white/5"
                      }
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </nav>

      {/* ══════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════ */}
      <main className="relative z-10 flex-1">
        {children}
      </main>

    </div>
  );
}
