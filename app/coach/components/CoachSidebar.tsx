"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NexusLogo from "@/components/ui/NexusLogo";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────
   CoachSidebar — vertical nav for the coach portal.
   Core section (always visible) + Gestion École (admin only) + bottom nav.
   Data loaded from Supabase auth + users table.
───────────────────────────────────────────────────────────────── */

type NavItem = { label: string; href: string; icon: React.ReactNode; badgeKey?: "activites" };

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
    label: "Mes équipes", href: "/coach/equipes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
  },
  {
    label: "Transferts", href: "/coach/transferts",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>,
  },
  {
    label: "Messages", href: "/coach/demandes",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
  },
  {
    label: "Activités", href: "/coach/activites",
    badgeKey: "activites",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
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
];

// Phase 6.2.e : civil + école coaches now share CORE_ITEMS post-
// unification. "Mes athlètes" est visible aux civils aussi (la page
// supporte le flow invitation par email via 6.2.c-2). SCHOOL_ITEMS
// reste gaté sur !isCivil pour les features admin école (Mon école,
// Coachs école, Stats, Analytique, Placements, Inviter coachs).

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
  // 5.5e-i: civil context flag drives sidebar item set + hides
  // "Gestion école" group entirely. Default false → école behavior
  // preserved when context is NULL (un-onboarded users).
  const [isCivil, setIsCivil] = useState(false);
  const [portalLabel, setPortalLabel] = useState("Portail coach");
  const [badges, setBadges] = useState<Record<string, number>>({});

  const fetchBadges = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", user.id)
      .eq("read", false);
    setBadges({ activites: count || 0 });
  }, []);

  useEffect(() => {
    fetchBadges();
    const handler = () => fetchBadges();
    window.addEventListener("activities-updated", handler);
    return () => window.removeEventListener("activities-updated", handler);
  }, [fetchBadges]);

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

        if (userCtx?.context === "ligue_civile") {
          setIsCivil(true);
          // Phase 6.2.e : league info for subtitle via unified tables.
          // school_coaches gives us the LIGUE_CIVILE school (= ligue);
          // team_coaches gives us the team. Pick first non-null pair.
          const { data: scRow } = await supabase
            .from("school_coaches")
            .select("school_id, schools!school_id(name, type)")
            .eq("coach_id", user.id)
            .limit(1)
            .maybeSingle();
          const { data: tcRow } = await supabase
            .from("team_coaches")
            .select("team_id, teams!team_id(name)")
            .eq("coach_id", user.id)
            .limit(1)
            .maybeSingle();

          const schoolRel = scRow ? (scRow as Record<string, unknown>).schools : null;
          const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; type?: string } | null;
          const leagueName = school?.name || "";

          const teamRel = tcRow ? (tcRow as Record<string, unknown>).teams : null;
          const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as { name?: string } | null;
          const teamName = team?.name || "";

          setUserSub(teamName ? `${teamName} — ${leagueName}` : leagueName);
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
        {item.badgeKey && badges[item.badgeKey] > 0 && (
          <span className="bg-[#E63946] text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center leading-none">
            {badges[item.badgeKey]}
          </span>
        )}
      </Link>
    );
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + portal label */}
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <NexusLogo variant="white" height={34} href="/coach" priority />
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">
          {portalLabel}
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {/* ── Core section: unified post-Phase 6.2.e — CORE_ITEMS for
            école/scolaire/NULL. Civil swaps "Mes athlètes" for
            "Découvrir" and hides the Gestion école group below. ── */}
        {CORE_ITEMS.map((item) => renderNavItem(item))}

        {/* ── Gestion École section (école admin only — never for civil) ── */}
        {!isCivil && isAdmin && (
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
