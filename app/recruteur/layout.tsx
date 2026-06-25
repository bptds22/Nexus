"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { isTabBarHidden, normalizeTabPath } from "@/app/_components/mobile/tabBarVisibility";
import RecruiterSidebar from "./_components/RecruiterSidebar";
import PlaybookBackground from "../components/PlaybookBackground";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import { createClient } from "@/lib/supabase/client";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";
import PendingAdminClaimBanner from "@/components/auth/PendingAdminClaimBanner";
import DevTierSwitcher from "@/components/dev/DevTierSwitcher";
import MobileTabBar from "@/app/_components/mobile/MobileTabBar";
import { AnimatedRoute } from "./_components/AnimatedRoute";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

// Redirect sur mauvais rôle → portail réel de l'utilisateur (Option A, silencieux).
// WrongRoutePage est hardcodé "athlètes seulement", donc non réutilisable ici.
const DASHBOARD_BY_ROLE: Record<string, string> = {
  COACH: "/coach/tableau-de-bord",
  RECRUTEUR: "/recruteur/tableau-de-bord",
  ATHLETE: "/athlete/dashboard",
  ADMIN: "/admin/dashboard",
};

/* ─────────────────────────────────────────────────────────────────
   Nexus — Recruiter Shell Layout
   Sidebar nav + main content area.
   Same dark bg as coach, with PlaybookBackground.
───────────────────────────────────────────────────────────────── */

export default function RecruteurLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RecruteurLayoutInner>{children}</RecruteurLayoutInner>
    </Suspense>
  );
}

function RecruteurLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const [access, setAccess] = useState<"loading" | "ok">("loading");
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  // Routes sans tab bar (thread/drill-down) → pas de réservation 88px : le
  // shell h-full du thread épouse la frame réelle, composer collé au bas
  // (suit le clavier). MÊME source de vérité que MobileTabBar.
  const pathname = usePathname();
  const chromeless = isTabBarHidden("recruteur", normalizeTabPath(pathname));

  /* Guard d'accès — parité avec app/athlete/layout.tsx. Le rôle est lu en DB
     (users.role), PAS dans le JWT : un compte social peut avoir un JWT en retard
     sur la base (rôle corrigé par une future RPC). Fail-open sur lecture qui
     rate. DeactivationGuard reste indépendant. */
  useEffect(() => {
    async function checkAccess() {
      try {
        // Aperçu athlète authentifié de sa propre carte (iframe /athlete/profil
        // → /recruteur/athletes/[id]?preview=true) : ce n'est PAS un accès
        // recruteur — on by-passe le guard, sinon l'athlète se fait éjecter.
        if (isPreview) { setAccess("ok"); return; }

        const supabase = createClient();
        // trailingSlash:true → normaliser le pathname avant toute comparaison.
        const normalizedPath = pathname.replace(/\/+$/, "") || "/";
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace("/auth"); return; }

        const { data, error } = await supabase
          .from("users")
          .select("role, onboarding_complete")
          .eq("id", session.user.id)
          .maybeSingle();

        // Lecture qui rate / ligne absente (race post-signup, RLS) → fail-open :
        // on dévoile l'app (la page re-vérifie), JAMAIS de bounce /auth ici.
        if (error || !data) { setAccess("ok"); return; }

        // Mauvais rôle → portail réel de l'user (silencieux) ; inconnu → /auth.
        if (data.role !== "RECRUTEUR") {
          router.replace(DASHBOARD_BY_ROLE[data.role ?? ""] ?? "/auth");
          return;
        }

        // Onboarding non terminé → wizard partagé /onboarding.
        if (data.onboarding_complete !== true && normalizedPath !== "/onboarding") {
          router.replace("/onboarding");
          return;
        }

        setAccess("ok");
      } catch (err) {
        // Filet : une lecture qui rejette ne fige pas le layout en "loading".
        console.error("[RecruteurLayout] checkAccess failed:", err);
        setAccess("ok");
      }
    }
    checkAccess();
  }, [router, pathname, isPreview]);

  if (access === "loading") {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <DeactivationGuard />
      <PlaybookBackground />

      {/* Sidebar — hidden in preview mode */}
      {!isPreview && (
        <RecruiterSidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-h-screen">
        <PreMaintenanceBanner />
        {!isPreview && <PendingAdminClaimBanner />}
        {/* Mobile top bar — masquée en Capacitor (la tab bar prend le relais) */}
        {!IS_CAPACITOR && (
          <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 h-16 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="text-[#8a8d96] hover:text-white transition-colors"
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12h18" />
                <path d="M3 6h18" />
                <path d="M3 18h18" />
              </svg>
            </button>
            <span className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">
              Portail recruteur
            </span>
            <div className="w-9 h-9 rounded-full bg-[#1A1D24] border border-[#2a2d36] flex items-center justify-center">
              <span className="text-[11px] font-bold text-[#8a8d96]">PD</span>
            </div>
          </div>
        )}

        {/* Page content — padding-bottom en Capacitor pour ne pas être
            masqué par la MobileTabBar (~56px + safe-area). */}
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
                  // Tab bar visible → réserve 88px. Masquée (thread/drill-down)
                  // → 0 : le composer du thread porte déjà son env(safe-area).
                  paddingBottom: chromeless ? 0 : "calc(env(safe-area-inset-bottom) + 88px)",
                  position: "relative",
                  overflowX: "hidden",
                }
              : undefined
          }
        >
          <AnimatedRoute>{children}</AnimatedRoute>
        </main>
      </div>
      <DevTierSwitcher />

      {/* Tab bar mobile — visible UNIQUEMENT en mode Capacitor.
          MobileTabBar lui-même return null si !IS_CAPACITOR → zéro impact web. */}
      <MobileTabBar role="recruteur" />
    </div>
  );
}
