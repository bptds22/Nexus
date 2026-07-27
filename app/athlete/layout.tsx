"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NexusLogo from "@/components/ui/NexusLogo";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PlaybookBackground from "../components/PlaybookBackground";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";
import DevTierSwitcher from "@/components/dev/DevTierSwitcher";
import WrongRoutePage from "./_components/WrongRoutePage";
import MobileTabBar from "@/app/_components/mobile/MobileTabBar";
import { AnimatedRoute } from "../recruteur/_components/AnimatedRoute";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
/* ─────────────────────────────────────────────────────────────────
   Nexus — Athlete Portal Layout
   Sidebar nav + main content. Simplified for 16-18 year old athletes.
───────────────────────────────────────────────────────────────── */

const NAV_ITEMS = [
  {
    label: "Tableau de bord",
    href: "/athlete/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "Messages",
    href: "/athlete/messages",
    badgeKey: "messages" as const,
    badgeColor: "#22C55E" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    label: "Mon parcours",
    href: "/athlete/mon-parcours",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  {
    label: "Mon profil",
    href: "/athlete/profil",
    badgeKey: "profil" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    href: "/athlete/notifications",
    badgeKey: "notifications" as const,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
  {
    // Déplacée du groupe primaire vers le groupe secondaire (avec Notifications
    // / Paramètres) — Messages occupe désormais le slot primaire (#2).
    label: "Ma visibilité",
    href: "/athlete/visibilite",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Paramètres",
    href: "/athlete/parametres",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

function AthleteSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [userInfo, setUserInfo] = useState<{ firstName: string; lastName: string; school: string; sport: string; position: string; verified: boolean }>({ firstName: "", lastName: "", school: "", sport: "", position: "", verified: false });

  const loadBadges = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: athlete } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, verified, sports!sport_id(nom), positions!position_id(abreviation), schools!school_id(name), team_athletes(teams!team_id(name))")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!athlete) return;

    // Civil/scolaire discriminator — mirror 5.3b pattern (separate
    // users.context query, no shared hook). Drives the sidebar label
    // so civil athletes don't see an empty school field.
    const { data: userRow } = await supabase
      .from("users")
      .select("context")
      .eq("id", user.id)
      .single();
    const isCivil = userRow?.context === "ligue_civile";

    // Affiliation label: école = school name; civil with team =
    // team name; civil without team = "Ligue Civile" placeholder.
    // The userInfo.school field is overloaded the same way
    // schoolName is overloaded on PlayerCard tickets per 5.3d-fix
    // (P3 logged for proper consolidation).
    const aRec = athlete as Record<string, unknown>;
    const schoolRel = aRec.schools as { name?: string } | null;
    // Phase 6.2.h : team name read from team_athletes junction (replaces
    // legacy league_teams!league_team_id embed).
    const taRel = aRec.team_athletes;
    const taRow = (Array.isArray(taRel) ? taRel[0] : taRel) as { teams?: unknown } | null;
    const teamRelRaw = taRow?.teams;
    const teamRow = (Array.isArray(teamRelRaw) ? teamRelRaw[0] : teamRelRaw) as { name?: string } | null;
    const affiliationLabel = isCivil
      ? (teamRow?.name ?? "Ligue Civile")
      : (schoolRel?.name ?? "");

    setUserInfo({
      firstName: (athlete as any).first_name || "",
      lastName: (athlete as any).last_name || "",
      school: affiliationLabel,
      sport: (athlete as any).sports?.nom || "",
      position: (athlete as any).positions?.abreviation || "",
      verified: (athlete as any).verified || false,
    });

    // Unread notifications count
    const { count: unreadNotifs } = await supabase
      .from("athlete_notifications")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("read", false);

    // 5.5e-iv-c: pending Flow A invitations roll into the
    // Notifications sidebar badge. Same key the existing
    // 'notifications-updated' event already refreshes — 5.5e-iv-b
    // accept/reject handlers dispatch that event so the count
    // stays in sync without any new wiring.
    const { count: pendingInvitations } = await supabase
      .from("team_invitations")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("status", "PENDING");

    // Pending suggestions count
    const { count: pendingSuggs } = await supabase
      .from("athlete_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athlete.id)
      .eq("status", "EN_ATTENTE");

    // Unread athlete↔coach messages (inbound, read_at IS NULL). The
    // mark_conversation_read RPC keeps read_at current for this surface.
    let msgUnread = 0;
    const { data: myConvs } = await supabase
      .from("conversations")
      .select("id")
      .eq("conversation_type", "ATHLETE_COACH")
      .eq("athlete_id", athlete.id);
    const convIds = (myConvs || []).map((c: { id: string }) => c.id);
    if (convIds.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .is("read_at", null)
        .neq("sender_id", user.id);
      msgUnread = count || 0;
    }

    setBadges({
      notifications: (unreadNotifs || 0) + (pendingInvitations || 0),
      profil: pendingSuggs || 0,
      messages: msgUnread,
    });
  }, []);

  useEffect(() => {
    loadBadges();
  }, [pathname, loadBadges]);

  useEffect(() => {
    const handler = () => loadBadges();
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, [loadBadges]);

  const handleLogout = () => router.push("/");

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo + portal label */}
      <div className="px-5 py-6 border-b border-[#1e2128]">
        <NexusLogo variant="white" height={34} href="/athlete/dashboard" priority />
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mt-2">Mon espace athlète</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.12em] transition-all ${
                isActive ? "bg-[#E63946]/12 text-[#E63946]" : "text-[#8a8d96] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={isActive ? "text-[#E63946]" : "text-[#6b7280]"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {(item as any).badgeKey && badges[(item as any).badgeKey] > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-white text-[10px] font-black"
                  style={{ backgroundColor: (item as any).badgeColor || "#E63946" }}
                >
                  {badges[(item as any).badgeKey]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — athlete card */}
      <div className="px-4 py-5 border-t border-[#1e2128]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center">
            <span className="text-[12px] font-bold text-white/30">{userInfo.firstName?.[0] || ""}{userInfo.lastName?.[0] || ""}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-white truncate">{userInfo.firstName} {userInfo.lastName}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={userInfo.verified ? "#3B82F6" : "#6B7280"} stroke="none" className="shrink-0" aria-label={userInfo.verified ? "Profil vérifié" : "Profil non vérifié"}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <p className="text-[11px] text-[#6b7280] truncate">{userInfo.school}</p>
            {(userInfo.sport || userInfo.position) && (
              <div className="flex items-center gap-1.5 mt-1">
                {userInfo.sport && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#E63946]/15 text-[#E63946]">{userInfo.sport}</span>}
                {userInfo.position && <span className="text-[10px] font-bold text-[#9CA3AF]">{userInfo.position}</span>}
              </div>
            )}
          </div>
        </div>
        <button type="button" onClick={handleLogout} className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] hover:text-[#E63946] transition-colors">
          Déconnexion
        </button>
      </div>
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

export default function AthleteLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "ok" | "wrong-role">("loading");
  const [wrongRole, setWrongRole] = useState<"COACH" | "RECRUTEUR" | null>(null);

  useEffect(() => {
    async function checkAccess() {
      try {
      const supabase = createClient();
      // trailingSlash:true (export statique) → le pathname runtime a un slash
      // final ("/athlete/onboarding/"). On le normalise AVANT toute comparaison
      // exacte, sinon le garde se croit "ailleurs" et boucle en redirect.
      const normalizedPath = pathname.replace(/\/+$/, "") || "/";
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth");
        return;
      }

      // Role comes from the session JWT metadata (set at signup via
      // signUp()'s options.data and surfaced by Supabase on every
      // session refresh). Zero DB hit, zero RLS timing race —
      // critical for the moment right after signup where the JWT
      // cookie hasn't fully propagated yet and a SELECT on
      // public.users returns 403, which used to silently bounce the
      // user back to /auth via the `if (!data)` branch.
      const role = (session.user.user_metadata?.role as string) ?? "ATHLETE";

      if (role === "COACH" || role === "RECRUTEUR") {
        setWrongRole(role as "COACH" | "RECRUTEUR");
        setState("wrong-role");
        return;
      }

      if (role !== "ATHLETE") {
        // Unexpected role (ADMIN, etc.) — punt back to auth rather
        // than render the athlete shell.
        router.replace("/auth");
        return;
      }

      // onboarding_complete IS NOT in metadata (the trigger only
      // sets DB fields), so this read is still required. On any
      // error (RLS timing race, missing row), default to routing to
      // the wizard — /athlete/onboarding's own init re-checks
      // profile completion against the athletes table and bounces
      // to /athlete/dashboard if the user is actually done.
      const { data, error } = await supabase
        .from("users")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .single();

      // Distinguish a NETWORK/RLS failure from a genuinely incomplete profile.
      // A failed read must NEVER eject a logged-in athlete to the onboarding
      // wizard — that is exactly how a transient DB slowdown (statement timeout
      // under load) wiped the screen and bounced the user mid-session. Only a
      // SUCCESSFUL read of onboarding_complete === false is a real "go to the
      // wizard" signal. On error, render the shell and let each page re-fetch
      // its own data (the athletes-table check in onboarding/dashboard is the
      // backstop for a truly-incomplete profile).
      if (error) {
        console.warn("[AthleteLayout] onboarding_complete read failed — rendering shell, NOT redirecting:", error.message);
        setState("ok");
        return;
      }

      const isComplete = data?.onboarding_complete === true;

      if (!isComplete && normalizedPath !== "/athlete/onboarding") {
        router.replace("/athlete/onboarding");
        return;
      }

      if (isComplete && normalizedPath === "/athlete/onboarding") {
        router.replace("/athlete/dashboard");
        return;
      }

      setState("ok");
      } catch (err) {
        // Filet de sécurité : une lecture qui rejette (réseau, RLS) ne doit
        // PLUS figer le layout en "loading" — on dévoile l'app, la page
        // onboarding/dashboard re-vérifie l'état réel. (try/catch et NON
        // finally : un finally écraserait les états wrong-role / redirect
        // intentionnels ci-dessus.)
        console.error("[AthleteLayout] checkAccess failed:", err);
        setState("ok");
      }
    }
    checkAccess();
  }, [router, pathname]);

  if (state === "loading") {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "wrong-role") return <WrongRoutePage role={wrongRole} />;

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <DeactivationGuard />
      <PlaybookBackground />
      <AthleteSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <PreMaintenanceBanner />
        {/* Mobile top bar — masquée en Capacitor (la tab bar prend le relais) */}
        {!IS_CAPACITOR && (
          <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 h-16 flex items-center justify-between">
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="text-[#8a8d96] hover:text-white transition-colors" aria-label="Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></svg>
            </button>
            <span className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Mon espace athlète</span>
            <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
              <span className="text-[11px] font-bold text-[#8a8d96]">MT</span>
            </div>
          </div>
        )}
        <main
          className="relative z-10 flex-1"
          style={
            IS_CAPACITOR
              ? {
                  // App-shell : conteneur scroll borné unique (body verrouillé
                  // via globals .is-capacitor). flex:none pour que height:100dvh
                  // prime sur flex-1. Pas de padding-top (headers sticky safe-area).
                  height: "100dvh",
                  flex: "none",
                  overflowY: "auto",
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: "calc(env(safe-area-inset-bottom) + 88px)",
                  overflowX: "hidden",
                }
              : undefined
          }
        >
          <AnimatedRoute>{children}</AnimatedRoute>
        </main>
      </div>
      <DevTierSwitcher />

      {/* Tab bar mobile — Capacitor uniquement. Web inchangé. */}
      <MobileTabBar role="athlete" />
    </div>
  );
}
