"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PartnerSidebar from "./_components/PartnerSidebar";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";
import MobileTabBar from "@/app/_components/mobile/MobileTabBar";
import { isTabBarHidden, normalizeTabPath } from "@/app/_components/mobile/tabBarVisibility";
import { lireAccesPartenaire, ROUTE_BIENVENUE } from "@/lib/partenaires/accesPartenaire";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Partner Portal Layout
   Sidebar nav + main content. Role-gated: only PARTNER users
   pass through. Other roles get redirected to their portal.

   1.4.5 (B1) — le portail entre dans l'appli. La garde est la MÊME
   dans les deux builds (lib/partenaires/accesPartenaire.ts) et refait
   ce que le middleware fait au web : conditions acceptées et mot de
   passe posé, sinon /partenaire/bienvenue. L'appli n'a pas de
   middleware — sans cette reprise, l'écran de bienvenue s'y sautait.
   Dans l'appli : pas de barre latérale, une barre du haut (zone sûre),
   un conteneur défilant borné et la barre d'onglets partenaire.
───────────────────────────────────────────────────────────────── */

type GuardState = "loading" | "ok" | "redirect";

export default function PartenaireLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state, setState] = useState<GuardState>("loading");

  // /partenaire/bienvenue is a dedicated welcome screen — no
  // sidebar chrome. Same role guard applies (only PARTNER), but
  // the layout renders centered children only.
  // trailingSlash:true → pathname runtime a un slash final ; normaliser avant
  // la comparaison exacte sinon l'écran bienvenue n'est jamais reconnu.
  const isWelcomeFlow = normalizeTabPath(pathname) === ROUTE_BIENVENUE;
  const chromeless = isTabBarHidden("partenaire", normalizeTabPath(pathname));

  useEffect(() => {
    let vivant = true;
    void lireAccesPartenaire(createClient(), pathname).then((acces) => {
      if (!vivant) return;
      if (acces.etat === "OK") { setState("ok"); return; }
      setState("redirect");
      if (acces.etat === "SANS_SESSION") router.replace("/auth");
      else if (acces.etat === "AUTRE_ROLE") router.replace(acces.destination);
      else router.replace(ROUTE_BIENVENUE);
    });
    return () => { vivant = false; };
  }, [router, pathname]);

  if (state !== "ok") {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Welcome flow: full-screen, no sidebar, no top bar.
  if (isWelcomeFlow) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col">
        <DeactivationGuard />
        <PlaybookBackground />
        <main
          className="relative z-10 flex-1"
          style={IS_CAPACITOR ? { height: "100dvh", flex: "none", overflowY: "auto", overscrollBehavior: "contain", paddingTop: "env(safe-area-inset-top)" } : undefined}
        >
          {children}
        </main>
      </div>
    );
  }

  if (IS_CAPACITOR) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col">
        <DeactivationGuard />
        <PlaybookBackground />
        <main
          className="relative z-10"
          data-portail-partenaire-mobile
          style={{
            // App-shell : conteneur scroll borné unique, comme les autres portails.
            height: "100dvh",
            flex: "none",
            overflowY: "auto",
            overscrollBehavior: "contain",
            overscrollBehaviorX: "none",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            position: "relative",
            paddingBottom: chromeless ? 0 : "calc(env(safe-area-inset-bottom) + 88px)",
          }}
        >
          <div
            className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 flex items-end justify-center"
            style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(env(safe-area-inset-top) + 48px)" }}
          >
            <span className="pb-3 text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Espace partenaire</span>
          </div>
          <PreMaintenanceBanner />
          {children}
        </main>
        <MobileTabBar role="partenaire" />
      </div>
    );
  }

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex">
      <DeactivationGuard />
      <PlaybookBackground />
      <PartnerSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-h-screen">
        <PreMaintenanceBanner />
        <div className="lg:hidden sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-[#1e2128] px-5 h-16 flex items-center justify-between">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-[#8a8d96] hover:text-white transition-colors" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></svg>
          </button>
          <span className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Espace partenaire</span>
          <div className="w-9 h-9" />
        </div>
        <main className="relative z-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
