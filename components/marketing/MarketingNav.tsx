"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import NexusLogo from "@/components/ui/NexusLogo";

const DROPDOWN_ITEMS = [
  { label: "Pour les coachs", href: "/pour-les-coachs" },
  { label: "Pour les recruteurs", href: "/pour-les-recruteurs" },
  { label: "Pour les étudiants-athlètes", href: "/pour-les-etudiant-athlete" },
];

// Main nav links — mirrored into the mobile hamburger menu. The desktop <ul>
// below stays the source of truth for desktop and is left untouched.
const NAV_LINKS = [
  { label: "Comment ça marche", href: "/comment-ca-marche", accent: false },
  { label: "Tarifs", href: "/tarifs", accent: true },
  { label: "Roadmap", href: "/roadmap", accent: false },
  { label: "À propos", href: "/a-propos", accent: false },
];

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

export default function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <nav className="sticky top-0 z-50 bg-[#111317] border-b border-[#1E2D4A]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        <Link href="/" aria-label="Nexus" className="flex items-center">
          <NexusLogo variant="white" height={28} className="nx-logo-dark" priority />
          <NexusLogo variant="black-red" height={28} className="nx-logo-light" priority />
        </Link>

        <ul className="hidden md:flex items-center gap-8 list-none">
          {/* Dropdown — Coaches & Recruteurs */}
          <li className="relative group">
            <span className={`${label} text-[#9AA3B2] group-hover:text-white transition-colors cursor-default flex items-center gap-1`}>
              Découvrir Nexus
              <svg width="14" height="14" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="mt-px opacity-70 group-hover:opacity-100 transition-opacity">
                <path d="M2.5 4 5 6.5 7.5 4" />
              </svg>
            </span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 invisible translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-300 ease-out">
              <ul className="bg-[#0A0E18]/95 backdrop-blur-md border border-[#1E2D4A] rounded-lg py-2 min-w-[240px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] list-none overflow-hidden">
                {DROPDOWN_ITEMS.map((d, i) => (
                  <li key={d.href} style={{ animationDelay: `${i * 50}ms` }} className="group/item">
                    <Link href={d.href} className="flex items-center gap-3 px-5 py-3 text-[11px] font-bold tracking-[0.2em] uppercase text-[#9AA3B2] hover:text-white transition-all duration-200 relative overflow-hidden">
                      {/* Red accent line on hover */}
                      <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#E63946] scale-y-0 group-hover/item:scale-y-100 transition-transform duration-200 origin-top" />
                      {/* Hover background */}
                      <span className="absolute inset-0 bg-[#E63946]/[0.06] opacity-0 group-hover/item:opacity-100 transition-opacity duration-200" />
                      {/* Arrow that slides in */}
                      <span className="relative -translate-x-2 opacity-0 group-hover/item:translate-x-0 group-hover/item:opacity-100 transition-all duration-200 text-[#E63946]">
                        &rsaquo;
                      </span>
                      <span className="relative">{d.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </li>

          <li>
            <Link href="/comment-ca-marche" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              Comment ça marche
            </Link>
          </li>

          <li>
            <Link href="/tarifs" className={`${label} text-[#E63946] hover:text-white transition-colors`}>
              Tarifs
            </Link>
          </li>

          <li>
            <Link href="/roadmap" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              Roadmap
            </Link>
          </li>

          <li>
            <Link href="/a-propos" className={`${label} text-[#9AA3B2] hover:text-white transition-colors`}>
              À propos
            </Link>
          </li>
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { }}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium"
          >
            <span className="text-white font-semibold">FR</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-500">EN</span>
          </button>
          <Link href="/auth" className={`hidden sm:block ${label} text-wl-red transition-colors px-4 h-9 leading-9 hover:drop-shadow-[0_0_8px_rgba(232,72,72,0.6)]`}>
            Connexion
          </Link>
          <Link href="/auth?mode=signup" className="nx-ghost-btn h-9 px-5 border font-head font-black text-xs uppercase tracking-widest inline-flex items-center">
            S&apos;inscrire
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="md:hidden flex items-center justify-center w-9 h-9 -mr-1 text-white"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

      </div>

      {/* Mobile menu — hamburger drawer; mirrors the desktop nav links */}
      {menuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-[#1E2D4A] bg-[#111317] px-6 py-3">
          <p className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-[0.25em] uppercase text-[#475569]">
            Découvrir Nexus
          </p>
          {DROPDOWN_ITEMS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              onClick={closeMenu}
              className="block px-4 py-2.5 text-[12px] font-bold tracking-[0.18em] uppercase text-[#9AA3B2] hover:text-white transition-colors"
            >
              {d.label}
            </Link>
          ))}
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={closeMenu}
              className={`block px-2 py-2.5 text-[12px] font-bold tracking-[0.18em] uppercase transition-colors hover:text-white ${l.accent ? "text-[#E63946]" : "text-[#9AA3B2]"}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="border-t border-[#1E2D4A] my-2" />
          <Link
            href="/auth"
            onClick={closeMenu}
            className="block px-2 py-2.5 text-[12px] font-bold tracking-[0.18em] uppercase text-wl-red hover:text-white transition-colors"
          >
            Connexion
          </Link>
          <Link
            href="/auth?mode=signup"
            onClick={closeMenu}
            className="nx-ghost-btn mt-2 h-10 border font-head font-black text-xs uppercase tracking-widest flex items-center justify-center"
          >
            S&apos;inscrire
          </Link>
        </div>
      )}
    </nav>
  );
}
