"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CareerEditMobile } from "@/components/shared/CareerEditMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   /coach/reputation/carriere — Career-prefs drill-down.

   Mobile only. The desktop /coach/reputation page already has the
   CareerToggle inlined as its 4th section, so on web we redirect
   back to it (anchor at #carriere).
═══════════════════════════════════════════════════════════════ */

export default function CoachReputationCarrierePage() {
  const router = useRouter();

  useEffect(() => {
    if (!IS_CAPACITOR) {
      router.replace("/coach/reputation#carriere");
    }
  }, [router]);

  if (!IS_CAPACITOR) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">
        Redirection…
      </div>
    );
  }
  return <CareerEditMobile />;
}
