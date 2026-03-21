"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────
   DirectorSidebar — vertical nav for the director portal.
   Adapts navigation items, portal label, and user card based on
   portalType ("ecole" or "cegep").
───────────────────────────────────────────────────────────────── */

type NavItem = { label: string; href: string; badge?: number; icon: React.ReactNode };

/* ── Inline SVG icons (18×18, stroke="currentColor", strokeWidth="2") ── */

const iconDashboard = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const iconUsers = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const iconTrophy = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 19.24 7 20h10c0-.76-.85-1.25-2.03-1.79C14.47 17.98 14 17.55 14 17v-2.34" />
    <path d="M18 2H6v7a6 6 0 0012 0V2z" />
  </svg>
);

const iconBarChart = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const iconBell = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const iconUserPlus = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const iconReassign = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5" />
    <path d="M4 20L21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);

const iconSettings = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/* ── Nav items per portal type ── */

const ECOLE_NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/directeur-ecole/dashboard", icon: iconDashboard },
  { label: "Mes coachs", href: "/directeur-ecole/coachs", icon: iconUsers },
  { label: "Placements", href: "/directeur-ecole/placements", icon: iconTrophy },
  { label: "Stats recrutement", href: "/directeur-ecole/stats", icon: iconBarChart },
  { label: "Activités", href: "/directeur-ecole/activites", badge: 3, icon: iconBell },
  { label: "Réassignation", href: "/directeur/reassignation", badge: 6, icon: iconReassign },
  { label: "Inviter", href: "/directeur-ecole/inviter", icon: iconUserPlus },
];

const CEGEP_NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/directeur-cegep/dashboard", icon: iconDashboard },
  { label: "Mes entraîneurs", href: "/directeur-cegep/entraineurs", icon: iconUsers },
  { label: "Recrues confirmées", href: "/directeur-cegep/recrues", icon: iconTrophy },
  { label: "Stats recrutement", href: "/directeur-cegep/stats", icon: iconBarChart },
  { label: "Activités", href: "/directeur-cegep/activites", badge: 5, icon: iconBell },
  { label: "Réassignation", href: "/directeur-cegep/reassignation", badge: 14, icon: iconReassign },
  { label: "Inviter", href: "/directeur-cegep/inviter", icon: iconUserPlus },
];

const LIGUE_NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/directeur-ecole/dashboard", icon: iconDashboard },
  { label: "Mes entraîneurs", href: "/directeur-ecole/coachs", icon: iconUsers },
  { label: "Placements", href: "/directeur-ecole/placements", icon: iconTrophy },
  { label: "Stats recrutement", href: "/directeur-ecole/stats", icon: iconBarChart },
  { label: "Activités", href: "/directeur-ecole/activites", badge: 2, icon: iconBell },
  { label: "Inviter", href: "/directeur-ecole/inviter", icon: iconUserPlus },
];

/* ── Portal-specific config ── */

const PORTAL_CONFIG = {
  ecole: {
    navItems: ECOLE_NAV_ITEMS,
    portalLabel: "Directeur sportif — École",
    settingsHref: "/directeur-ecole/parametres",
    userInitials: "FB",
    userName: "François Bergeron",
    userSubtitle: "Dir. sportif — De Rochebelle",
    ownerLabel: "Directeur principal",
    collaboratorLabel: "Directeur collaborateur",
  },
  cegep: {
    navItems: CEGEP_NAV_ITEMS,
    portalLabel: "Directeur sportif — CÉGEP",
    settingsHref: "/directeur-cegep/parametres",
    userInitials: "NF",
    userName: "Nathalie Fortin",
    userSubtitle: "Dir. sportif — CÉGEP Garneau",
    ownerLabel: "Directeur principal",
    collaboratorLabel: "Directeur collaborateur",
  },
  ligue: {
    navItems: LIGUE_NAV_ITEMS,
    portalLabel: "Coordonnateur — Ligue",
    settingsHref: "/directeur-ecole/parametres",
    userInitials: "PR",
    userName: "Patrick Roy",
    userSubtitle: "Coord. — Wildcats Lanaudière",
    ownerLabel: "Coordonnateur principal",
    collaboratorLabel: "Coordonnateur adjoint",
  },
} as const;

interface DirectorSidebarProps {
  portalType: "ecole" | "cegep" | "ligue";
  mobileOpen: boolean;
  onClose: () => void;
}

export default function DirectorSidebar({ portalType, mobileOpen, onClose }: DirectorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const config = PORTAL_CONFIG[portalType];

  const [userName, setUserName] = useState<string>(config.userName);
  const [userSub, setUserSub] = useState<string>(config.userSubtitle);
  const [userInitials, setUserInitials] = useState<string>(config.userInitials);

  const [isOwner, setIsOwner] = useState(true); // default to owner for POC

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.firstName && u.lastName) {
          setUserName(`${u.firstName} ${u.lastName}`);
          setUserInitials(`${u.firstName[0]}${u.lastName[0]}`);
          const inst = u.institution?.name || "";
          const roleLabel = portalType === "ligue" ? "Coord." : "Dir. sportif";
          setUserSub(`${roleLabel}${inst ? ` \u2014 ${inst}` : ""}`);
        }
        if (u.directorRole === "collaborator") setIsOwner(false);
      }
    } catch { /* use defaults */ }
  }, [portalType]);

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
            src="/brand/White%20red%20logo%20@4x.png"
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
          {config.portalLabel}
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {config.navItems.map((item) => {
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

        {/* Separator + Paramètres */}
        <div className="border-t border-[#1e2128] my-2" />
        {(() => {
          const isActive =
            pathname === config.settingsHref || pathname.startsWith(config.settingsHref + "/");
          return (
            <Link
              href={config.settingsHref}
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
                {iconSettings}
              </span>
              <span className="flex-1">Paramètres</span>
            </Link>
          );
        })()}
      </nav>

      {/* Bottom — user card */}
      <div className="px-4 py-5 border-t border-[#1e2128]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#8a8d96]">{userInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-white truncate">{userName}</p>
              {isOwner && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#DAB65A" stroke="none" className="shrink-0">
                  <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
                  <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
                </svg>
              )}
            </div>
            <p className="text-[10px] text-[#6b7280] truncate">{isOwner ? config.ownerLabel : config.collaboratorLabel}</p>
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
