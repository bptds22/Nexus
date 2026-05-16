"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NexusLogo from "@/components/ui/NexusLogo";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SidebarUpgradeCard from "@/components/subscription/SidebarUpgradeCard";
import UpgradeModal from "@/components/ui/UpgradeModal";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ─────────────────────────────────────────────────────────────────
   RecruiterSidebar — vertical nav for the recruiter portal.
   Free section (top) + Pro "Gestion CÉGEP" section + bottom nav.
   Adapts for Admin CÉGEP (invited director) vs Recruteur Pro vs Free.
───────────────────────────────────────────────────────────────── */

/* Numeric ranks for tier comparison. Higher = more access. */
const TIER_RANK: Record<"free" | "pro" | "all_star", number> = {
  free: 0,
  pro: 1,
  all_star: 2,
};

function meetsRequiredTier(
  userTier: "free" | "pro" | "all_star",
  requiredTier: "pro" | "all_star" | undefined,
  isSchoolAdmin: boolean,
  adminBypass: boolean = false
): boolean {
  if (!requiredTier) return true;
  // Per-item admin bypass: school admins unlock items flagged as
  // operational (Inviter, Réassignation, Recruteurs) regardless
  // of tier. Items without the flag still require the tier.
  if (isSchoolAdmin && adminBypass) return true;
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

type NavItem = {
  label: string;
  href: string;
  badge?: number;
  icon: React.ReactNode;
  requiredTier?: "pro" | "all_star";  // undefined = Free OK
  /** When true, school admins bypass the tier requirement.
   *  Used for operational CÉGEP items (Inviter, Réassignation,
   *  Recruteurs) that directors must access regardless of tier.
   *  Analytics items (Mon CÉGEP, Stats, Recrues) leave this
   *  unset — no bypass. */
  adminBypass?: boolean;
};

const RECRUITER_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord", href: "/recruteur/tableau-de-bord",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
  },
  {
    label: "Recherche", href: "/recruteur/recherche",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>,
  },
  {
    label: "Mes favoris", href: "/recruteur/favoris",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
  },
  {
    label: "Mon processus", href: "/recruteur/pipeline",
    requiredTier: "pro",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>,
  },
  {
    label: "Listes", href: "/recruteur/listes",
    requiredTier: "pro",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>,
  },
  {
    label: "Messages", href: "/recruteur/messages",
    requiredTier: "pro",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  },
];

const CEGEP_ITEMS: NavItem[] = [
  {
    label: "Mon CÉGEP", href: "/recruteur/cegep",
    requiredTier: "all_star",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>,
  },
  {
    label: "Recruteurs", href: "/recruteur/cegep/recruteurs",
    requiredTier: "all_star",
    adminBypass: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  },
  {
    label: "Stats recrutement", href: "/recruteur/cegep/stats",
    requiredTier: "all_star",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  },
  {
    label: "Recrues confirmées", href: "/recruteur/cegep/recrues",
    requiredTier: "all_star",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>,
  },
  {
    label: "Réassignation", href: "/recruteur/cegep/reassignation",
    requiredTier: "all_star",
    adminBypass: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8l4 4-4 4" /><path d="M2 12h20" /><path d="M6 16l-4-4 4-4" /></svg>,
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  {
    label: "Mon profil", href: "/recruteur/profil",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  },
  {
    label: "Activités", href: "/recruteur/activites",
    requiredTier: "pro",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  },
  {
    label: "Paramètres", href: "/recruteur/parametres",
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  },
];

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

interface RecruiterSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function RecruiterSidebar({ mobileOpen, onClose }: RecruiterSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { tier, isSchoolAdmin } = useSubscription();
  const [userName, setUserName] = useState("Pierre Dufour");
  const [userSub, setUserSub] = useState("Recruteur \u2014 C\u00c9GEP Garneau");
  const [userInitials, setUserInitials] = useState("PD");
  const [isAlsoRecruiter, setIsAlsoRecruiter] = useState(true);
  const [portalLabel, setPortalLabel] = useState("Portail recruteur");

  /* Subscription/admin flags come from the DB-backed hook (single source of truth). */
  const hasProAccess = tier === "all_star" || isSchoolAdmin;
  const isAdmin = isSchoolAdmin;

  /* Name/initials/institution are profile-level (not subscription) and still
     come from the onboarding localStorage bag. Safe: not a tier-gated read. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.firstName && u.lastName) {
          setUserName(`${u.firstName} ${u.lastName}`);
          setUserInitials(`${u.firstName[0]}${u.lastName[0]}`);
          const inst = u.institution?.name || "";
          setUserSub(`Recruteur${inst ? ` \u2014 ${inst}` : ""}`);
        }
        setIsAlsoRecruiter(u.is_also_recruiter !== false);
        if (isSchoolAdmin && u.is_also_recruiter === false) {
          setPortalLabel("Directeur sportif \u2014 C\u00c9GEP");
          setUserSub(`Directeur${u.institution?.name ? ` \u2014 ${u.institution.name}` : ""}`);
        }
      }
    } catch { /* use defaults */ }
  }, [isSchoolAdmin]);

  // Real badge counts from Supabase
  const [msgBadge, setMsgBadge] = useState(0);
  const [actBadge, setActBadge] = useState(0);

  useEffect(() => {
    async function loadBadges() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Unread messages: messages.read_at IS NULL means not yet read
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .eq("recruiter_id", user.id)
        .eq("status", "ACTIVE");
      const convIds = convs?.map((c) => c.id) || [];
      if (convIds.length > 0) {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .neq("sender_id", user.id)
          .is("read_at", null);
        setMsgBadge(count ?? 0);
      }

      // Unread activities — auto-marked as read when user visits /recruteur/activites
      const { count: actCount } = await supabase
        .from("recruiter_activity_log")
        .select("*", { count: "exact", head: true })
        .eq("recruiter_id", user.id)
        .eq("is_read", false);
      setActBadge(actCount ?? 0);
    }
    loadBadges();
  }, []);

  const [upgradeModal, setUpgradeModal] = useState<{ tierId: string; lockedFeatureTitle: string } | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("nexus_user");
    router.push("/");
  };

  function handleLockedClick(e: React.MouseEvent, requiredTier: "pro" | "all_star", featureLabel: string) {
    e.preventDefault();
    setUpgradeModal({
      tierId: requiredTier === "pro" ? "rec_pro" : "rec_allstar",
      lockedFeatureTitle: featureLabel,
    });
  }

  const showRecruiterItems = isAlsoRecruiter || !isAdmin;

  function renderNavItem(item: NavItem) {
    const locked = !meetsRequiredTier(tier, item.requiredTier, isSchoolAdmin, item.adminBypass);
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const lockTitle = item.requiredTier === "all_star"
      ? "Fonctionnalité Recruteur All Star"
      : "Fonctionnalité Recruteur Pro";

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={(e) => {
          if (locked && item.requiredTier) {
            handleLockedClick(e, item.requiredTier, item.label);
            return;
          }
          onClose();
        }}
        className={`
          flex items-center gap-3 px-3.5 py-3 rounded-lg
          text-[13px] font-bold uppercase tracking-[0.12em] transition-all
          ${isActive
            ? "bg-[#E63946]/12 text-[#E63946]"
            : locked
              ? "text-[#8a8d96]/60 hover:text-[#8a8d96]/80 hover:bg-white/[0.02]"
              : "text-[#8a8d96] hover:text-white hover:bg-white/5"
          }
        `}
        title={locked ? lockTitle : undefined}
      >
        <span className={isActive ? "text-[#E63946]" : locked ? "text-[#6b7280]/50" : "text-[#6b7280]"}>
          {item.icon}
        </span>
        <span className="flex-1">{item.label}</span>
        {locked && <LockIcon />}
        {!locked && item.badge !== undefined && item.badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-black">
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + portal label */}
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <NexusLogo variant="white" height={34} href="/recruteur/tableau-de-bord" priority />
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">
          {portalLabel}
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {/* ── Free section (recruiter items) ── */}
        {showRecruiterItems && RECRUITER_ITEMS.map((item) => {
          const badgeOverride = item.href === "/recruteur/messages" ? msgBadge : item.badge;
          return renderNavItem({ ...item, badge: badgeOverride });
        })}

        {/* ── Pro section separator ── */}
        <div className="pt-3 pb-1 px-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-[#1e2128]" />
            <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-[#6B7280] shrink-0">
              Gestion CÉGEP
            </span>
            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[8px] font-black uppercase tracking-wider">
              All Star
            </span>
            <div className="flex-1 border-t border-[#1e2128]" />
          </div>
        </div>

        {/* ── Pro section (CÉGEP items) ── */}
        {CEGEP_ITEMS.map((item) => renderNavItem(item))}

        {/* ── Bottom section ── */}
        <div className="pt-2" />
        {showRecruiterItems && BOTTOM_ITEMS.filter((i) => i.label !== "Paramètres").map((item) => {
          const badgeOverride = item.href === "/recruteur/activites" ? actBadge : item.badge;
          return renderNavItem({ ...item, badge: badgeOverride });
        })}
        {BOTTOM_ITEMS.filter((i) => i.label === "Paramètres").map((item) => renderNavItem(item))}
      </nav>

      {/* Upgrade prompt (only for free tier) */}
      {!hasProAccess && <SidebarUpgradeCard />}

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
          Déconnexion
        </button>
      </div>

      {upgradeModal && (
        <UpgradeModal
          open={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          role="recruteur"
          tierId={upgradeModal.tierId}
          lockedFeatureTitle={upgradeModal.lockedFeatureTitle}
        />
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-[260px] bg-[#111317]/80 backdrop-blur-sm border-r border-[#1e2128] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>
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
