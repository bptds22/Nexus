"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SidebarUpgradeCard from "@/components/subscription/SidebarUpgradeCard";

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
  activity: <svg {...I_PROPS}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  bell: <svg {...I_PROPS}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  cegep: <svg {...I_PROPS}><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" /></svg>,
  recruteurs: <svg {...I_PROPS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  users: <svg {...I_PROPS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
  stats: <svg {...I_PROPS}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
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
  /** iter 7.39 — gérer un click custom (déconnexion). Prioritaire sur href. */
  onClick?: () => void;
  /** iter 7.39 — couleur rouge pour Déconnexion */
  destructive?: boolean;
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
  isSchoolAdmin,
  actBadge,
  onLockedClick,
}: MorePanelProps) {
  const pathname = usePathname();
  const router = useRouter();

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
            { key: "activites", label: "Activités", href: "/coach/activites", icon: Icons.bell, badge: actBadge },
            { key: "reputation", label: "Ma réputation", href: "/coach/reputation", icon: Icons.star },
          ],
        },
      ];
      // Gestion d'école : uniquement coach école admin (PAS civil).
      // Pages NON portées en mobile → external Browser.open vers le web public.
      if (!isCivil && isSchoolAdmin) {
        out.push({
          title: "Gestion École",
          items: [
            { key: "ecole-web", label: "Gestion d'école", href: `${PUBLIC_BASE}/coach/ecole`, icon: Icons.school, external: true },
          ],
        });
      }
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
    const locked = !meetsRequiredTier(tier, item.requiredTier, isSchoolAdmin, item.adminBypass);
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
          <span className="flex-1 text-[14px] font-bold">{item.label}</span>
          {locked && <LockIcon />}
          {!locked && item.external && (
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
        <span className="flex-1 text-[14px] font-bold">{item.label}</span>
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
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden
      />

      {/* Bottom sheet — iter 7.36 : 280ms cubic-bezier(0.34,1.56,0.64,1)
          overshoot iOS (canon mobile-design-system §5, ligne 110). */}
      <div
        className={`
          fixed bottom-0 inset-x-0 z-50 bg-[#1A1D24] border-t border-[#2D3748]
          rounded-t-2xl max-h-[85vh] overflow-y-auto
          ${open ? "translate-y-0" : "translate-y-full"}
        `}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          transition: "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu Plus"
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#4a4d56]" />
        </div>

        {/* Sections */}
        <div className="pb-4">
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
          {role === "recruteur" && !hasProAccess && (
            <div className="px-4 pt-3">
              <SidebarUpgradeCard />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
