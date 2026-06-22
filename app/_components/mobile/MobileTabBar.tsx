"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSubscription } from "@/lib/hooks/useSubscription";
import UpgradeModal from "@/components/ui/UpgradeModal";
import MorePanel from "./MorePanel";
import { loadCoachTaskCounts } from "@/lib/coach/tasks";

/* ─────────────────────────────────────────────────────────────────
   MobileTabBar — bottom navigation bar for Capacitor mobile builds.
   Supports the 3 user roles : recruteur, coach, athlete.

   Affichée UNIQUEMENT si NEXT_PUBLIC_CAPACITOR_BUILD === "true".
   Sur le web, ce composant retourne null → zéro impact.

   Réutilise (dupliqué localement le temps de stabiliser le pattern,
   à factoriser une fois les 3 rôles validés) :
   - meetsRequiredTier + TIER_RANK : copié de RecruiterSidebar
   - LockIcon : copié de RecruiterSidebar
   - Queries de badge : copiées de RecruiterSidebar / CoachSidebar /
     AthleteSidebar (selon le rôle)
───────────────────────────────────────────────────────────────── */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ── Tier gating (dupliqué de RecruiterSidebar — à factoriser étape 3) ── */
const TIER_RANK: Record<"free" | "pro" | "all_star", number> = {
  free: 0,
  pro: 1,
  all_star: 2,
};

function meetsRequiredTier(
  userTier: "free" | "pro" | "all_star",
  requiredTier: "pro" | "all_star" | undefined,
  isSchoolAdmin: boolean,
  adminBypass: boolean = false,
): boolean {
  if (!requiredTier) return true;
  if (isSchoolAdmin && adminBypass) return true;
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/* ── LockIcon (dupliqué de RecruiterSidebar — à factoriser étape 3) ── */
const LockIcon = () => (
  <svg
    width="9"
    height="9"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6B7280"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0 absolute -top-0.5 -right-1"
    aria-hidden
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/* ── Icons (26px, strokeWidth 1.5 — look léger/aéré façon ESPN/NFL) ── */
const SVG_BASE = "26";
const SVG_PROPS = { width: SVG_BASE, height: SVG_BASE, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  dashboard: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  search: (
    <svg {...SVG_PROPS}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
  ),
  kanban: (
    <svg {...SVG_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  envelope: (
    <svg {...SVG_PROPS}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  more: (
    <svg {...SVG_PROPS}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  ),
  /* ── Coach ── */
  users: (
    <svg {...SVG_PROPS}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  layers: (
    <svg {...SVG_PROPS}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  checklist: (
    <svg {...SVG_PROPS}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  /* ── Athlete ── */
  flag: (
    <svg {...SVG_PROPS}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  user: (
    <svg {...SVG_PROPS}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  eye: (
    <svg {...SVG_PROPS}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

interface TabConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredTier?: "pro" | "all_star";
  adminBypass?: boolean;
  /** Substring d'URL pour considérer le tab actif (fallback href). */
  activeMatch?: string;
}

const RECRUTEUR_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/recruteur/tableau-de-bord", icon: Icons.dashboard, activeMatch: "/recruteur/tableau-de-bord" },
  { key: "recherche", label: "Recherche", href: "/recruteur/recherche", icon: Icons.search, activeMatch: "/recruteur/recherche|/recruteur/athletes" },
  { key: "pipeline", label: "Processus", href: "/recruteur/pipeline", icon: Icons.kanban, requiredTier: "pro" },
  { key: "messages", label: "Messages", href: "/recruteur/messages", icon: Icons.envelope, requiredTier: "pro" },
];

const COACH_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/coach/tableau-de-bord", icon: Icons.dashboard, activeMatch: "/coach/tableau-de-bord" },
  // /coach/athletes couvre la liste + les sous-routes [id] (profil, modifier, apercu)
  { key: "athletes", label: "Mes athlètes", href: "/coach/athletes", icon: Icons.users, activeMatch: "/coach/athletes" },
  { key: "a-traiter", label: "À traiter", href: "/coach/a-traiter", icon: Icons.checklist, activeMatch: "/coach/a-traiter" },
  { key: "messages", label: "Messages", href: "/coach/demandes", icon: Icons.envelope, activeMatch: "/coach/demandes" },
];

const ATHLETE_TABS: TabConfig[] = [
  { key: "dashboard", label: "Accueil", href: "/athlete/dashboard", icon: Icons.dashboard, activeMatch: "/athlete/dashboard" },
  { key: "parcours", label: "Parcours", href: "/athlete/mon-parcours", icon: Icons.flag, activeMatch: "/athlete/mon-parcours" },
  { key: "profil", label: "Profil", href: "/athlete/profil", icon: Icons.user, activeMatch: "/athlete/profil" },
  { key: "visibilite", label: "Visibilité", href: "/athlete/visibilite", icon: Icons.eye, activeMatch: "/athlete/visibilite" },
];

const TABS_BY_ROLE: Record<"recruteur" | "coach" | "athlete", TabConfig[]> = {
  recruteur: RECRUTEUR_TABS,
  coach: COACH_TABS,
  athlete: ATHLETE_TABS,
};

interface MobileTabBarProps {
  role: "recruteur" | "coach" | "athlete";
}

export default function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();
  // trailingSlash:true → le pathname runtime a un slash final. Normalisé pour
  // les comparaisons EXACTES ci-dessous (les .startsWith restent sur pathname,
  // safe). Sans ça, les guards onboarding/messages se trompent d'écran.
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const router = useRouter();
  const { tier, isSchoolAdmin } = useSubscription();

  const [moreOpen, setMoreOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ tierId: string; lockedFeatureTitle: string } | null>(null);

  // Stacking-context fix — portal the tab bar to document.body so its z-40
  // escapes the `.hero-playbook` `isolation: isolate` trap created by the
  // athlete/coach/recruiter layout roots. Without this, the local z-40 is
  // sealed inside `.hero-playbook` (auto/0 at body root), so any other
  // body-level portal (editor sticky CTAs, sheets) at z-30+ paints over it.
  // `mounted` is the SSR-safe gate : first render returns null, then after
  // useEffect fires the portal renders client-side only, avoiding hydration
  // mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Iter 7.42 — Signal global "nx-more-panel" écouté par SaveBarPortal et tout
  // composant body-level qui doit céder la place au panel Plus (sans Context).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("nx-more-panel", { detail: { open: moreOpen } }));
  }, [moreOpen]);

  /* ── Badges per rôle ──
     - msgBadge : compteur sur le tab Messages (recruteur uniquement)
     - actBadge : compteur affiché à côté de l'item correspondant dans le panel Plus
                  ET drive le dot rouge sur le bouton Plus
     - moreDotActive : indique si le dot doit s'afficher (peut inclure des
                       items hors actBadge, ex: suggestions athlète) */
  const [msgBadge, setMsgBadge] = useState(0);
  const [actBadge, setActBadge] = useState(0);
  // À traiter : non-vérifiés + suggestions EN_ATTENTE. Source/filtres IDENTIQUES
  // au dashboard coach ActionBar (page.tsx L118-122, L141, L153-159) — un seul
  // "à traiter" pour tout le coach mobile.
  const [aTraiterBadge, setATraiterBadge] = useState(0);
  const [moreDotActive, setMoreDotActive] = useState(false);

  useEffect(() => {
    if (!IS_CAPACITOR) return;
    let cancelled = false;

    const loadBadges = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      if (role === "recruteur") {
        const { data: convs } = await supabase
          .from("conversations")
          .select("id")
          .eq("recruiter_id", user.id)
          .eq("status", "ACTIVE");
        const convIds = convs?.map((c) => c.id) || [];
        let msgCount = 0;
        if (convIds.length > 0) {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", convIds)
            .neq("sender_id", user.id)
            .is("read_at", null);
          msgCount = count ?? 0;
        }
        const { count: actCount } = await supabase
          .from("recruiter_activity_log")
          .select("*", { count: "exact", head: true })
          .eq("recruiter_id", user.id)
          .eq("is_read", false);
        if (cancelled) return;
        setMsgBadge(msgCount);
        setActBadge(actCount ?? 0);
        setMoreDotActive((actCount ?? 0) > 0);
        return;
      }

      if (role === "coach") {
        const { count: actCount } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", user.id)
          .eq("read", false);

        // ÉTAPE 3c — convergence "à traiter" : on consomme le helper partagé
        // (lib/coach/tasks.loadCoachTaskCounts) à la place de l'ancien calcul
        // inline. Le badge inclut maintenant missingEval (était absent avant),
        // donc le compteur monte chez les coachs qui n'ont pas évalué tous
        // leurs athlètes — intentionnel : le badge doit matcher /coach/a-traiter.
        const counts = await loadCoachTaskCounts(supabase, user.id);

        if (cancelled) return;
        setMsgBadge(0);
        setActBadge(actCount ?? 0);
        setATraiterBadge(counts.total);
        setMoreDotActive((actCount ?? 0) > 0);
        return;
      }

      if (role === "athlete") {
        // Need athlete.id from athletes table (queries are keyed on athlete_id)
        const { data: athlete } = await supabase
          .from("athletes")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        const athleteId = athlete?.id as string | undefined;
        if (!athleteId || cancelled) {
          setMsgBadge(0);
          setActBadge(0);
          setMoreDotActive(false);
          return;
        }
        const [{ count: notifs }, { count: invs }, { count: suggs }] = await Promise.all([
          supabase.from("athlete_notifications").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("read", false),
          supabase.from("team_invitations").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("status", "PENDING"),
          supabase.from("athlete_suggestions").select("id", { count: "exact", head: true }).eq("athlete_id", athleteId).eq("status", "EN_ATTENTE"),
        ]);
        if (cancelled) return;
        const notifsCount = (notifs ?? 0) + (invs ?? 0);
        setMsgBadge(0);
        setActBadge(notifsCount); // affiché sur l'item "Notifications" du panel
        setMoreDotActive(notifsCount + (suggs ?? 0) > 0);
      }
    };

    loadBadges();

    // Listeners d'events window — chaque rôle a son canal de refresh.
    const handler = () => loadBadges();
    if (role === "coach") window.addEventListener("activities-updated", handler);
    if (role === "athlete") window.addEventListener("notifications-updated", handler);
    return () => {
      cancelled = true;
      if (role === "coach") window.removeEventListener("activities-updated", handler);
      if (role === "athlete") window.removeEventListener("notifications-updated", handler);
    };
  }, [pathname, role]);

  if (!IS_CAPACITOR) return null;

  // Iter 7.60 — masquer la TabBar sur les drill-down conversation (canon iOS
  // Messages : la TabBar disparaît pendant qu'on lit une conversation pour
  // laisser le composer respirer + éviter qu'elle cache la dernière bulle).
  // /recruteur/messages → liste (TabBar visible)
  // /recruteur/messages/[id] → thread (TabBar masquée)
  // /recruteur/messages/nouveau → wizard (TabBar masquée aussi, même pattern).
  const messagesDrillDown =
    role === "recruteur" &&
    normalizedPath.startsWith("/recruteur/messages/") &&
    normalizedPath !== "/recruteur/messages";
  if (messagesDrillDown) return null;

  // Phase 2 — mirror du drill-down recruteur pour le coach. La mobile coach
  // consomme MessagesListShell + MessageThreadShell exactement comme le
  // recruteur, donc même UX iOS : TabBar visible sur la liste, masquée
  // pendant le thread / le wizard nouveau message.
  // /coach/demandes → liste (TabBar visible)
  // /coach/demandes/[id] → thread (TabBar masquée)
  // /coach/demandes/nouveau → wizard (TabBar masquée).
  const coachDemandesDrillDown =
    role === "coach" &&
    normalizedPath.startsWith("/coach/demandes/") &&
    normalizedPath !== "/coach/demandes";
  if (coachDemandesDrillDown) return null;

  // Coach parametres drill-downs (profil edit, école edit, admin école).
  // Le top-level Paramètres reste accessible via /coach/settings ; les
  // sous-écrans pleins-écran masquent la tab bar comme le pattern messages.
  const coachParametresDrillDown =
    role === "coach" &&
    normalizedPath.startsWith("/coach/parametres/");
  if (coachParametresDrillDown) return null;

  // Coach reputation drill-downs (career editor, etc.). Le top-level
  // /coach/reputation garde la tab bar ; les drill-downs (carriere) la
  // masquent — même pattern que /coach/parametres/*.
  const coachReputationDrillDown =
    role === "coach" &&
    normalizedPath.startsWith("/coach/reputation/");
  if (coachReputationDrillDown) return null;

  // Run 3 — Mes Équipes drill-down (detail d'une équipe + sous-routes).
  // Le top-level /coach/equipes garde la tab bar (page liste pleine
  // largeur) ; /coach/equipes/[teamId] et sous-écrans (modifier, etc.)
  // la masquent pour donner le canon iOS "détail plein écran".
  const coachEquipesDrillDown =
    role === "coach" &&
    normalizedPath.startsWith("/coach/equipes/");
  if (coachEquipesDrillDown) return null;

  // Iter 7.50-a5 — masquer la TabBar pendant le wizard d'onboarding athlète
  // plein écran (canon iOS : pas de nav globale durant un flow de capture
  // critique). Sans ce guard, la TabBar z-40 couvre le CTA "Continuer" z-30
  // de AthleteOnboardingMobile → l'utilisateur tap un onglet au lieu du CTA
  // → rebond vers dashboard → re-mount onboarding → boucle (DIAG 7.50-a4).
  // L'athlète en onboarding (onboarding_complete=false) n'a aucun usage de
  // la TabBar puisque le layout shell le bounce vers /athlete/onboarding
  // dès qu'il tente d'aller ailleurs. Même pattern que messagesDrillDown.
  const athleteOnboarding =
    role === "athlete" && normalizedPath === "/athlete/onboarding";
  if (athleteOnboarding) return null;

  // Iter coach-3 — même guard pour le coach pendant son onboarding.
  // Route /onboarding (le wizard coach/recruteur web — branche mobile
  // coach école via dispatch IS_CAPACITOR). Couvre automatiquement le
  // sprint coach-4 (civil) et le sprint recruteur mobile à venir.
  const coachOnboarding =
    role === "coach" && normalizedPath === "/onboarding";
  if (coachOnboarding) return null;

  // Iter recruteur-onboarding-mobile — même guard pour le recruteur en
  // onboarding. /onboarding route → wizard recruteur web ou natif via
  // dispatch IS_CAPACITOR. Note : TabBar utilise 'recruteur' (FR) en
  // interne alors que user.role est 'recruiter' (EN) côté front.
  const recruiterOnboarding =
    role === "recruteur" && normalizedPath === "/onboarding";
  if (recruiterOnboarding) return null;

  // SSR-safe portal mount gate — comes AFTER every existing pathname guard
  // so the guards still run on first render (avoiding unnecessary work) and
  // the `mounted` check fires last, right before we try to access
  // `document.body`.
  if (!mounted) return null;

  const tabs = TABS_BY_ROLE[role];

  function isActive(tab: TabConfig): boolean {
    const matchStr = tab.activeMatch ?? tab.href;
    const parts = matchStr.split("|");
    return parts.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  function handleTabClick(e: React.MouseEvent, tab: TabConfig) {
    const locked = !meetsRequiredTier(tier, tab.requiredTier, isSchoolAdmin, tab.adminBypass);
    if (locked && tab.requiredTier) {
      e.preventDefault();
      setUpgradeModal({
        tierId: tab.requiredTier === "all_star" ? "rec_allstar" : "rec_pro",
        lockedFeatureTitle: tab.label,
      });
    }
  }

  // Index actif : 0..n-1 si un tab matche, n si Plus est ouvert, -1 sinon.
  const totalSlots = tabs.length + 1;
  const activeIndex: number = (() => {
    if (moreOpen) return tabs.length;
    for (let i = 0; i < tabs.length; i++) {
      if (isActive(tabs[i])) return i;
    }
    return -1;
  })();
  const slotWidthPct = 100 / totalSlots;

  return createPortal(
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-[#1A1D24] flex"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          // Séparation douce avec le contenu : bordure top subtile (rgba blanc 6%)
          // + ombre légère portée vers le haut pour un effet "flottant" à la ESPN.
          borderTop: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 -1px 14px rgba(0,0,0,0.35)",
          position: "fixed", // déjà via la classe, mais on assure pour le contexte relatif des enfants absolute
        }}
        aria-label="Navigation principale"
      >
        {/* Indicateur d'actif unique — glisse horizontalement entre les onglets.
            Material standard easing pour un feel premium type ESPN/Stripe. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${slotWidthPct}%`,
            height: 2,
            pointerEvents: "none",
            transform: `translateX(${activeIndex * 100}%)`,
            transition: "transform 280ms cubic-bezier(0.4, 0.0, 0.2, 1), opacity 200ms",
            opacity: activeIndex >= 0 ? 1 : 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div style={{ width: 32, height: 2, borderRadius: 9999, background: "#E63946" }} />
        </div>

        {tabs.map((tab) => {
          const locked = !meetsRequiredTier(tier, tab.requiredTier, isSchoolAdmin, tab.adminBypass);
          const active = isActive(tab);
          // Badge par tab key : messages (recruteur), a-traiter (coach).
          const tabBadgeCount =
            tab.key === "messages" ? msgBadge
            : tab.key === "a-traiter" ? aTraiterBadge
            : 0;
          const showBadge = tabBadgeCount > 0 && !locked;
          const color = active ? "text-[#E63946]" : locked ? "text-[#8a8d96]/60" : "text-[#8a8d96]";
          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(e, tab)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 pt-2.5 pb-2 min-h-[64px] ${color} active:bg-white/[0.04] transition-colors`}
              aria-current={active ? "page" : undefined}
            >
              <span className="relative">
                {tab.icon}
                {locked && tab.requiredTier && <LockIcon />}
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#E63946] text-white text-[9px] font-black leading-none">
                    {tabBadgeCount > 99 ? "99+" : tabBadgeCount}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-medium tracking-[0.04em] whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}

        {/* "Plus" — ouvre le bottom sheet */}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 pt-2.5 pb-2 min-h-[64px] ${moreOpen ? "text-[#E63946]" : "text-[#8a8d96]"} active:bg-white/[0.04] transition-colors`}
          aria-label="Plus d'options"
          aria-expanded={moreOpen}
        >
          <span className="relative">
            {Icons.more}
            {moreDotActive && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#E63946]" aria-hidden />
            )}
          </span>
          <span className="text-[11px] font-medium tracking-[0.04em] whitespace-nowrap">Plus</span>
        </button>
      </nav>

      <MorePanel
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        role={role}
        tier={tier}
        isSchoolAdmin={isSchoolAdmin}
        actBadge={actBadge}
        onLockedClick={(tierId, label) => setUpgradeModal({ tierId, lockedFeatureTitle: label })}
      />

      {upgradeModal && (
        <UpgradeModal
          open={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
          role="recruteur"
          tierId={upgradeModal.tierId}
          lockedFeatureTitle={upgradeModal.lockedFeatureTitle}
        />
      )}
    </>,
    document.body,
  );
}
