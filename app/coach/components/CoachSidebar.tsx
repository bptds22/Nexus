"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────
   CoachSidebar — vertical nav for the coach portal.
   Items: Tableau de bord, Mes athlètes, Créer un profil, Demandes,
   Paramètres.
───────────────────────────────────────────────────────────────── */

const NAV_ITEMS: { label: string; href: string; badge?: number; icon: React.ReactNode }[] = [
  {
    label: "Tableau de bord",
    href: "/coach/tableau-de-bord",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "Mes athlètes",
    href: "/coach/athletes",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: "Créer un profil",
    href: "/coach/athletes/create",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
  {
    label: "Demandes",
    href: "/coach/demandes",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    label: "Activités",
    href: "/coach/activites",
    badge: 3,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Ma réputation",
    href: "/coach/reputation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    label: "Paramètres",
    href: "/coach/settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

interface CoachSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function CoachSidebar({ mobileOpen, onClose }: CoachSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("Jean Dupont");
  const [userSub, setUserSub] = useState("Coach \u2014 De Mortagne");
  const [userInitials, setUserInitials] = useState("JD");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.firstName && u.lastName) {
          setUserName(`${u.firstName} ${u.lastName}`);
          setUserInitials(`${u.firstName[0]}${u.lastName[0]}`);
          const inst = u.institution?.name || "";
          setUserSub(`Coach${inst ? ` \u2014 ${inst}` : ""}`);
        }
      }
    } catch { /* use defaults */ }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("nexus_user");
    router.push("/");
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + portal label */}
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/Profile%20white%20trans@4x.png"
            alt="Nexus"
            width={30}
            height={30}
            className="object-contain"
          />
          <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase">
            Nexus
          </span>
        </Link>
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">
          Portail coach
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3.5 py-3 rounded-lg
                text-[13px] font-bold uppercase tracking-[0.12em] transition-all
                ${isActive
                  ? "bg-[#E63946]/12 text-[#E63946]"
                  : "text-[#8a8d96] hover:text-white hover:bg-white/5"
                }
              `}
            >
              <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-black">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — user card */}
      <div className="px-4 py-5 border-t border-[#1e2128]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#8a8d96]">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
            <p className="text-[11px] text-[#6b7280] truncate">{userSub}</p>
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] hover:text-[#E63946] transition-colors">
          D\u00e9connexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] lg:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
