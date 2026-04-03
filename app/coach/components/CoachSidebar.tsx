"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   CoachSidebar — vertical nav for the coach portal.
   Core section (always visible) + Gestion École (admin only) + bottom nav.
   Data loaded from Supabase auth + users table.
───────────────────────────────────────────────────────────────── */

type NavItem = { label: string; href: string; icon: React.ReactNode };

const CORE_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord", href: "/coach/tableau-de-bord",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    label: "Mes athlètes", href: "/coach/athletes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  {
    label: "Messages", href: "/coach/demandes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
];

const SCHOOL_ITEMS: NavItem[] = [
  {
    label: "Mon école", href: "/coach/ecole",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>,
  },
  {
    label: "Coachs", href: "/coach/ecole/coachs",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  {
    label: "Stats école", href: "/coach/ecole/stats",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  },
  {
    label: "Analytique", href: "/coach/ecole/analytics",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  },
  {
    label: "Placements", href: "/coach/ecole/placements",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>,
  },
  {
    label: "Inviter", href: "/coach/ecole/inviter",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    label: "Ma réputation", href: "/coach/reputation",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  },
  {
    label: "Paramètres", href: "/coach/settings",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  },
];

interface CoachSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function CoachSidebar({ mobileOpen, onClose }: CoachSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userSub, setUserSub] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [portalLabel, setPortalLabel] = useState("Portail coach");

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, is_school_admin, school_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        const fn = profile.first_name || "";
        const ln = profile.last_name || "";
        setUserName(`${fn} ${ln}`.trim());
        setUserInitials(`${fn[0] || ""}${ln[0] || ""}`.toUpperCase());
        setIsAdmin(profile.is_school_admin || false);

        if (profile.school_id) {
          const { data: school } = await supabase
            .from("schools")
            .select("name")
            .eq("id", profile.school_id)
            .single();
          if (school) {
            setUserSub(`Coach — ${school.name}`);
          }
        }

        // Check for league context
        const { data: userCtx } = await supabase
          .from("users")
          .select("context")
          .eq("id", user.id)
          .single();

        console.log("[CoachSidebar] User context:", userCtx?.context);

        if (userCtx?.context === "ligue_civile") {
          // Get league info for subtitle
          const { data: leagueCoach } = await supabase
            .from("league_coaches")
            .select("league_id, league_team_id, leagues(name), league_teams(name)")
            .eq("coach_id", user.id)
            .limit(1)
            .maybeSingle();

          console.log("[CoachSidebar] League coach data:", leagueCoach);

          if (leagueCoach) {
            const leagueName = (leagueCoach as any).leagues?.name || "";
            const teamName = (leagueCoach as any).league_teams?.name || "";
            setUserSub(teamName ? `${teamName} — ${leagueName}` : leagueName);
          }
        } else {
          // School context — check school_coaches for role label
          const { data: coachEntry } = await supabase
            .from("school_coaches")
            .select("role, sport")
            .eq("coach_id", user.id)
            .single();
          if (coachEntry) {
            const ROLE_LABELS: Record<string, string> = {
              COACH: "Coach",
              DIRECTEUR: "Directeur sportif",
              DIRECTEUR_INTERIM: "Directeur sportif intérimaire",
            };
            setPortalLabel(ROLE_LABELS[coachEntry.role] || "Coach");
          }
        }
      }
    }
    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  function renderNavItem(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
      </Link>
    );
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + portal label */}
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={30} height={30} className="object-contain" />
          <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase">Nexus</span>
        </Link>
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">
          {portalLabel}
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {/* ── Core section ── */}
        {CORE_ITEMS.map((item) => renderNavItem(item))}

        {/* ── Gestion École section (admin only) ── */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-[#1e2128]" />
                <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#6B7280] shrink-0">
                  Gestion école
                </span>
                <div className="flex-1 border-t border-[#1e2128]" />
              </div>
            </div>
            {SCHOOL_ITEMS.map((item) => renderNavItem(item))}
          </>
        )}

        {/* ── Bottom section separator ── */}
        <div className="pt-2" />

        {/* ── Bottom items ── */}
        {BOTTOM_ITEMS.map((item) => renderNavItem(item))}
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
        <button type="button" onClick={handleLogout} className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] hover:text-[#E63946] transition-colors cursor-pointer">
          Déconnexion
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
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 z-50 w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] lg:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}
