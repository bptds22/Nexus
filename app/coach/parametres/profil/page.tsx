"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CoachProfilEditMobile } from "@/components/shared/CoachProfilEditMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Coach parametres / Profil — drill-down depuis CoachParametresMobile.

   Mobile only. Sur le web on redirige vers /coach/settings (la version
   desktop a son propre éditeur de profil intégré au layout 2-colonnes).
═══════════════════════════════════════════════════════════════ */

export default function CoachParametresProfilPage() {
  const router = useRouter();

  useEffect(() => {
    if (!IS_CAPACITOR) {
      router.replace("/coach/settings");
    }
  }, [router]);

  if (!IS_CAPACITOR) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">
        Redirection…
      </div>
    );
  }
  return <CoachProfilEditMobile />;
}
