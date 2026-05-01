"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PartnerSidebar from "./_components/PartnerSidebar";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import DeactivationGuard from "@/components/auth/DeactivationGuard";
import PreMaintenanceBanner from "@/components/auth/PreMaintenanceBanner";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Partner Portal Layout (Phase 1)
   Sidebar nav + main content. Role-gated: only PARTNER users
   pass through. Other roles get redirected to their portal.
───────────────────────────────────────────────────────────────── */

type GuardState = "loading" | "ok" | "wrong-role";

export default function PartenaireLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state, setState] = useState<GuardState>("loading");

  // /partenaire/bienvenue is a dedicated welcome screen — no
  // sidebar chrome. Same role guard applies (only PARTNER), but
  // the layout renders centered children only.
  const isWelcomeFlow = pathname === "/partenaire/bienvenue";

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth");
        return;
      }
      const { data } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (!data) {
        router.replace("/auth");
        return;
      }
      if (data.role === "PARTNER") {
        setState("ok");
        return;
      }
      // Wrong role — bounce to their dashboard
      setState("wrong-role");
      if (data.role === "COACH") router.replace("/coach/tableau-de-bord");
      else if (data.role === "RECRUTEUR") router.replace("/recruteur/tableau-de-bord");
      else if (data.role === "ATHLETE") router.replace("/athlete/dashboard");
      else if (data.role === "ADMIN") router.replace("/admin/dashboard");
      else router.replace("/");
    }
    check();
  }, [router]);

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
        <main className="relative z-10 flex-1">{children}</main>
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
