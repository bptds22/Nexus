"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SidebarUpgradeCard from "@/components/subscription/SidebarUpgradeCard";
import { useMobileToast } from "@/components/mobile/MobileToast";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
const PUBLIC_BASE = "https://nexussports.ca";

async function openExternal(url: string) {
  try {
    if (IS_CAPACITOR) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch { /* fallthrough */ }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ─────────────────────────────────────────────────────────────────
   MorePanel — bottom sheet "Plus" pour la tab bar mobile.
   Contient les items overflow non visibles dans la tab bar.
   Supports les 3 rôles : recruteur, coach, athlete.
───────────────────────────────────────────────────────────────── */

/* ── Tier gating (dupliqué — à factoriser étape 3) ── */
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

const LockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6B7280"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
    aria-hidden
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

/* ── Icons (18px pour le panel) ── */
const I_PROPS = { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  heart: <svg {...I_PROPS}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
  lists: <svg {...I_PROPS}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>,
  calendar: <svg {...I_PROPS}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  activity: <svg {...I_PROPS}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  bell: <svg {...I_PROPS}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  eye: <svg {...I_PROPS}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  cegep: <svg {...I_PROPS}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>,
  recruteurs: <svg {...I_PROPS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  users: <svg {...I_PROPS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  stats: <svg {...I_PROPS}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  layers: <svg {...I_PROPS}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
  shield: <svg {...I_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  trendingUp: <svg {...I_PROPS}><path d="M3 17l6-6 4 4 8-8" /><polyline points="14 7 21 7 21 14" /></svg>,
  barChart: <svg {...I_PROPS}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  trophy: <svg {...I_PROPS}><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" /><path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" /><path d="M6 3h12v6a6 6 0 01-12 0V3z" /><path d="M12 15v3M8 21h8" /></svg>,
  reassign: <svg {...I_PROPS}><path d="M18 8l4 4-4 4" /><path d="M2 12h20" /><path d="M6 16l-4-4 4-4" /></svg>,
  profile: <svg {...I_PROPS}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  settings: <svg {...I_PROPS}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  star: <svg {...I_PROPS}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  school: <svg {...I_PROPS}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22V12h6v10" /><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01" /></svg>,
  logout: <svg {...I_PROPS}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
};

interface PanelItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredTier?: "pro" | "all_star";
  adminBypass?: boolean;
  /** badge count à afficher (>0 = visible) */
  badge?: number;
  /** iter 7.39 — si true, tap → Capacitor Browser.open vers le web public.
   *  Sert pour les pages CÉGEP/Transfert non portées en mobile. */
  external?: boolean;
  /** Indicateur visuel pur : montre l'icône "ouvre le web" à droite,
   *  indépendamment du flag `external` ci-dessus (qui contrôle le
   *  tap-trigger). Utilisé par Gestion École : la ligne a un custom
   *  onClick (smart-tap qui peut openExternal OU router.push selon
   *  l'accès), mais on veut que le coach voie l'icône external
   *  uniquement quand le tap actuel ouvrira effectivement le web. */
  opensWeb?: boolean;
  /** iter 7.39 — gérer un click custom (déconnexion). Prioritaire sur href. */
  onClick?: () => void;
  /** iter 7.39 — couleur rouge pour Déconnexion */
  destructive?: boolean;
  /** Second ligne grise sous le label — utilisée par la section
   *  Gestion d'École (description courte sous chaque section). */
  sublabel?: string;
  /** Slot à droite du label, AVANT l'icône chevron/external/lock.
   *  Utilisé pour les pills PRO/ADMIN de la section Gestion École.
   *  Quand fourni, remplace l'icône external automatique (le pill
   *  porte déjà l'info "tu ne peux pas accéder à ça"). */
  rightAccessory?: ReactNode;
}

/* ── Gestion École pills (gold PRO / blue ADMIN) ────────────── */

function ProPill() {
  return (
    <span
      className="inline-flex items-center h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-[0.12em] shrink-0"
      style={{
        color: "#F59E0B",
        backgroundColor: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(245,158,11,0.35)",
      }}
    >
      Pro
    </span>
  );
}

function AdminPill() {
  return (
    <span
      className="inline-flex items-center h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-[0.12em] shrink-0"
      style={{
        color: "#3B82F6",
        backgroundColor: "rgba(59,130,246,0.12)",
        border: "1px solid rgba(59,130,246,0.35)",
      }}
    >
      Admin
    </span>
  );
}

interface PanelSection {
  title?: string;
  items: PanelItem[];
}

interface MorePanelProps {
  open: boolean;
  onClose: () => void;
  role: "recruteur" | "coach" | "athlete";
  tier: "free" | "pro" | "all_star";
  /** True tant que le tier n'est pas chargé. Empêche d'afficher les cadenas /
   *  la carte d'upgrade en état « free » par défaut avant le fetch. */
  tierLoading: boolean;
  isSchoolAdmin: boolean;
  /** Compteur affiché sur l'item correspondant : Activités (recruteur, coach)
   *  ou Notifications (athlete). */
  actBadge: number;
  onLockedClick: (tierId: string, label: string) => void;
}

export default function MorePanel({
  open,
  onClose,
  role,
  tier,
  tierLoading,
  isSchoolAdmin,
  actBadge,
  onLockedClick,
}: MorePanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useMobileToast();

  // Coach uniquement : on lit `users.context` pour savoir si l'utilisateur
  // est en contexte civil. Conditionne l'affichage de la section "Gestion
  // École" (visible UNIQUEMENT si !isCivil && isSchoolAdmin).
  const [isCivil, setIsCivil] = useState(false);

  useEffect(() => {
    if (role !== "coach") return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("users")
        .select("context")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setIsCivil(data?.context === "ligue_civile");
    })();
    return () => { cancelled = true; };
  }, [role]);

  // Ferme le panel automatiquement quand l'URL change (navigation OK)
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Block body scroll quand le panel est ouvert
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const hasProAccess = tier === "all_star" || isSchoolAdmin;

  /* ── Sections par rôle ── */
  const sections: PanelSection[] = (() => {
    if (role === "recruteur") {
      return [
        {
          items: [
            { key: "favoris", label: "Mes favoris", href: "/recruteur/favoris", icon: Icons.heart },
            // Pas de requiredTier — parité avec RecruiterSidebar : le tier Free
            // doit ATTEINDRE la page, où il rencontre le mur (planche lock +
            // CTA Pro). Un lock ici ouvrirait l'UpgradeModal et le mur ne
            // serait jamais rendu.
            { key: "calendrier", label: "Calendrier", href: "/recruteur/calendrier", icon: Icons.calendar },
            { key: "listes", label: "Listes", href: "/recruteur/listes", icon: Icons.lists, requiredTier: "pro" },
            { key: "activites", label: "Activités", href: "/recruteur/activites", icon: Icons.activity, requiredTier: "pro", badge: actBadge },
          ],
        },
        {
          title: "Gestion CÉGEP",
          // Iter 7.39 — sections CÉGEP NON portées en mobile (DIAG 7.38).
          // Les rows ouvrent le web public via Capacitor Browser (icône ↗).
          items: [
            { key: "cegep", label: "Mon CÉGEP", href: `${PUBLIC_BASE}/recruteur/cegep`, icon: Icons.cegep, requiredTier: "all_star", external: true },
            { key: "recruteurs", label: "Recruteurs", href: `${PUBLIC_BASE}/recruteur/cegep/recruteurs`, icon: Icons.recruteurs, requiredTier: "all_star", adminBypass: true, external: true },
            { key: "stats", label: "Stats recrutement", href: `${PUBLIC_BASE}/recruteur/cegep/stats`, icon: Icons.stats, requiredTier: "all_star", external: true },
            { key: "recrues", label: "Recrues confirmées", href: `${PUBLIC_BASE}/recruteur/cegep/recrues`, icon: Icons.trophy, requiredTier: "all_star", external: true },
            { key: "reassign", label: "Réassignation", href: `${PUBLIC_BASE}/recruteur/cegep/reassignation`, icon: Icons.reassign, requiredTier: "all_star", adminBypass: true, external: true },
          ],
        },
        {
          title: "Compte",
          items: [
            { key: "profil", label: "Mon profil", href: "/recruteur/profil", icon: Icons.profile },
            { key: "parametres", label: "Paramètres", href: "/recruteur/parametres", icon: Icons.settings },
            // Iter 7.39 — vraie déconnexion : signOut Supabase + clear local + redirect /auth
            { key: "logout", label: "Déconnexion", href: "/auth", icon: Icons.logout, destructive: true, onClick: async () => {
              const supabase = createClient();
              try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
              await supabase.auth.signOut();
              router.push("/auth");
            } },
          ],
        },
      ];
    }

    if (role === "coach") {
      const out: PanelSection[] = [
        {
          items: [
            // "Mes équipes" déplacé de la tab bar (refonte 5 slots : Accueil /
            // Mes athlètes / À traiter / Messages / Plus).
            { key: "equipes", label: "Mes équipes", href: "/coach/equipes", icon: Icons.layers },
            { key: "transferts", label: "Transferts", href: "/coach/transferts", icon: Icons.reassign },
            { key: "activites", label: "Activités", href: "/coach/activites", icon: Icons.bell, badge: actBadge },
            { key: "reputation", label: "Ma réputation", href: "/coach/reputation", icon: Icons.star },
          ],
        },
      ];
      // Gestion d'École : les 6 sections sont rendues INLINE dans le
      // Plus panel (plus d'écran intermédiaire). Visible à TOUS les
      // coachs (école + civil — labels école pour tous, accepté beta).
      // Chaque ligne porte sa propre logique d'accès :
      //   1-5 : Pro OR is_school_admin → openExternal web ; sinon
      //         pill PRO + tap = router.push /coach/settings (upsell).
      //   6   : is_school_admin → openExternal web ; sinon pill ADMIN
      //         + toast "Réservé aux administrateurs".
      // Mirror exact de SchoolGate.tsx (canSee('can_see_mon_ecole') OR
      // is_school_admin). Le teaser GestionEcoleMobile + le dispatch au
      // /coach/ecole sont laissés en place (potentiellement utiles
      // pour la future view recruteur→coach).
      const hasProOrAdmin = tier !== "free" || isSchoolAdmin;
      const tapProSection = (webPath: string) => () => {
        if (hasProOrAdmin) {
          if (IS_CAPACITOR) {
            // iOS (3.1.1) : pas d'ouverture du web (le tunnel d'achat Stripe y est joignable).
            toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
          } else {
            openExternal(`${PUBLIC_BASE}${webPath}`);
          }
        } else {
          router.push("/coach/settings");
        }
      };
      const tapAdminSection = (webPath: string) => () => {
        if (isSchoolAdmin) {
          if (IS_CAPACITOR) {
            toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
          } else {
            openExternal(`${PUBLIC_BASE}${webPath}`);
          }
        } else {
          // Civil-aware copy : the section + the admin role label
          // switch when the coach is on a ligue civile (matches
          // Paramètres' "Admin ligue" / "Modifier la ligue" canon).
          toast.info({
            message: "Réservé aux administrateurs",
            detail: isCivil
              ? "Cette section est gérée par les administrateurs de la ligue."
              : "Cette section est gérée par les directeurs de l'école.",
          });
        }
      };
      out.push({
        title: "Gestion École",
        items: [
          // Sublabels intentionally dropped — the label + the
          // PRO/ADMIN pill + the external-link icon already convey
          // meaning. Keeping the rows at the standard ~52px
          // MorePanel height ensures the whole sheet fits on a
          // standard-size phone without scrolling.
          {
            key: "ecole-mon",
            label: "Mon école",
            href: `${PUBLIC_BASE}/coach/ecole`,
            icon: Icons.school,
            onClick: tapProSection("/coach/ecole"),
            rightAccessory: hasProOrAdmin ? undefined : <ProPill />,
            opensWeb: hasProOrAdmin,
          },
          {
            key: "ecole-coachs",
            label: "Mes coachs",
            href: `${PUBLIC_BASE}/coach/ecole/coachs`,
            icon: Icons.users,
            onClick: tapProSection("/coach/ecole/coachs"),
            rightAccessory: hasProOrAdmin ? undefined : <ProPill />,
            opensWeb: hasProOrAdmin,
          },
          {
            key: "ecole-stats",
            label: "Stats école",
            href: `${PUBLIC_BASE}/coach/ecole/stats`,
            icon: Icons.stats,
            onClick: tapProSection("/coach/ecole/stats"),
            rightAccessory: hasProOrAdmin ? undefined : <ProPill />,
            opensWeb: hasProOrAdmin,
          },
          {
            key: "ecole-analytics",
            label: "Analytique",
            href: `${PUBLIC_BASE}/coach/ecole/analytics`,
            icon: Icons.trendingUp,
            onClick: tapProSection("/coach/ecole/analytics"),
            rightAccessory: hasProOrAdmin ? undefined : <ProPill />,
            opensWeb: hasProOrAdmin,
          },
          {
            key: "ecole-placements",
            label: "Placements",
            href: `${PUBLIC_BASE}/coach/ecole/placements`,
            icon: Icons.trophy,
            onClick: tapProSection("/coach/ecole/placements"),
            rightAccessory: hasProOrAdmin ? undefined : <ProPill />,
            opensWeb: hasProOrAdmin,
          },
          {
            key: "ecole-admin",
            label: "Administration",
            href: `${PUBLIC_BASE}/coach/settings#admin_ecole`,
            icon: Icons.shield,
            onClick: tapAdminSection("/coach/settings#admin_ecole"),
            rightAccessory: isSchoolAdmin ? undefined : <AdminPill />,
            opensWeb: isSchoolAdmin,
          },
        ],
      });
      out.push({
        title: "Compte",
        items: [
          { key: "settings", label: "Paramètres", href: "/coach/settings", icon: Icons.settings },
          { key: "logout", label: "Déconnexion", href: "/auth", icon: Icons.logout, destructive: true, onClick: async () => {
            const supabase = createClient();
            try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
            await supabase.auth.signOut();
            router.push("/auth");
          } },
        ],
      });
      return out;
    }

    // athlete
    return [
      {
        items: [
          // "Ma visibilité" déplacée de la tab bar (Messages a pris son slot).
          { key: "visibilite", label: "Ma visibilité", href: "/athlete/visibilite", icon: Icons.eye },
          { key: "notifications", label: "Notifications", href: "/athlete/notifications", icon: Icons.bell, badge: actBadge },
        ],
      },
      {
        title: "Compte",
        items: [
          { key: "settings", label: "Paramètres", href: "/athlete/parametres", icon: Icons.settings },
          { key: "logout", label: "Déconnexion", href: "/auth", icon: Icons.logout, destructive: true, onClick: async () => {
            const supabase = createClient();
            try { localStorage.removeItem("nexus_user"); } catch { /* no-op */ }
            await supabase.auth.signOut();
            router.push("/auth");
          } },
        ],
      },
    ];
  })();

  function renderItem(item: PanelItem) {
    // Pas de cadenas tant que le tier n'est pas chargé (évite le flash free).
    const locked = !tierLoading && !meetsRequiredTier(tier, item.requiredTier, isSchoolAdmin, item.adminBypass);
    const lockTitle = item.requiredTier === "all_star"
      ? "Fonctionnalité Recruteur All Star"
      : "Fonctionnalité Recruteur Pro";

    // Iter 7.39 — Couleur destructive (Déconnexion) prend la priorité sur grayed.
    const labelColor = item.destructive
      ? "text-[#E63946]"
      : locked ? "text-[#8a8d96]/60" : "text-[#e0e0e0]";
    const iconColor = item.destructive
      ? "text-[#E63946]"
      : locked ? "text-[#6b7280]/60" : "text-[#9CA3AF]";
    const activeBg = locked ? "active:bg-white/[0.02]" : "active:bg-white/5";

    const baseClass = `flex items-center gap-3 px-5 py-3.5 transition-colors ${labelColor} ${activeBg}`;

    // Label area : single line by default ; stacked label + sublabel
    // when sublabel is present (Gestion École rows). Sublabel inherits
    // the existing grey treatment used in shared/settings rows.
    const labelArea = (
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold truncate">{item.label}</span>
        {item.sublabel && (
          <span className="block text-[11px] text-[#6b7280] mt-0.5 leading-snug">
            {item.sublabel}
          </span>
        )}
      </span>
    );

    // Iter 7.39 — onClick custom (déconnexion) ou external (Browser.open).
    if (item.onClick || item.external) {
      return (
        <button
          key={item.key}
          type="button"
          onClick={async () => {
            if (locked && item.requiredTier) {
              onLockedClick(item.requiredTier === "all_star" ? "rec_allstar" : "rec_pro", item.label);
              return;
            }
            if (item.external && IS_CAPACITOR) {
              // iOS (3.1.1) : ne pas ouvrir le web (tunnel d'achat joignable).
              toast.info({ message: "Disponible sur la version web", detail: "Cette section se gère sur nexussports.ca." });
              return;
            }
            onClose();
            if (item.external) {
              await openExternal(item.href);
            } else if (item.onClick) {
              await item.onClick();
            }
          }}
          className={`w-full text-left ${baseClass}`}
          title={locked ? lockTitle : undefined}
        >
          <span className={iconColor}>{item.icon}</span>
          {labelArea}
          {item.rightAccessory}
          {locked && <LockIcon />}
          {!locked && !item.rightAccessory && (item.external || item.opensWeb) && !IS_CAPACITOR && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-label="Ouvre dans le navigateur">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          )}
          {!locked && item.badge !== undefined && item.badge > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-black">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </button>
      );
    }

    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={(e) => {
          if (locked && item.requiredTier) {
            e.preventDefault();
            onLockedClick(item.requiredTier === "all_star" ? "rec_allstar" : "rec_pro", item.label);
            return;
          }
          onClose();
        }}
        className={baseClass}
        title={locked ? lockTitle : undefined}
      >
        <span className={iconColor}>{item.icon}</span>
        {labelArea}
        {item.rightAccessory}
        {locked && <LockIcon />}
        {!locked && item.badge !== undefined && item.badge > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[10px] font-black">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden
      />

      {/* Bottom sheet — iter 7.36 : 280ms cubic-bezier(0.34,1.56,0.64,1)
          overshoot iOS (canon mobile-design-system §5, ligne 110).
          Structure flex column : handle bar fixe en haut, sections
          scrollables au-dessous. Le max-height utilise 100dvh (dynamic
          viewport height) avec fallback vh pour les WebViews qui ne
          supportent pas encore dvh — ça assure que le sheet ne déborde
          jamais sous la barre URL / safe-area. */}
      <div
        className={`
          fixed bottom-0 inset-x-0 z-[70] bg-[#1A1D24] border-t border-[#2D3748]
          rounded-t-2xl flex flex-col
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{
          maxHeight: "min(85vh, calc(100dvh - env(safe-area-inset-top, 0px)))",
          paddingBottom: "env(safe-area-inset-bottom)",
          transition: "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu Plus"
      >
        {/* Handle bar — fixe en haut, hors zone de scroll. */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#4a4d56]" />
        </div>

        {/* Sections — zone scrollable. flex-1 + overflow-y-auto pour
            que le contenu prenne toute la hauteur disponible et que les
            entrées du bas (Paramètres / Déconnexion) restent
            atteignables même quand Gestion École liste ses 6 rows. */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {section.title && (
                <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">{section.title}</span>
                  {section.title === "Gestion CÉGEP" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[8px] font-black uppercase tracking-wider">
                      All Star
                    </span>
                  )}
                  <div className="flex-1 border-t border-[#2D3748]" />
                </div>
              )}
              {section.items.map(renderItem)}
            </div>
          ))}

          {/* Upgrade prompt — recruteur uniquement (les autres rôles n'ont
              pas de tier gating actif dans la nav pour l'instant). */}
          {role === "recruteur" && !tierLoading && !hasProAccess && (
            <div className="px-4 pt-3">
              <SidebarUpgradeCard />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
