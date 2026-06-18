"use client";

/* ─────────────────────────────────────────────────────────────────
   /coach/a-traiter — dispatch.

   Capacitor → CoachATraiterMobile (la vraie page mobile-native :
   3 filter cards, view toggle "Par athlète | Toutes les tâches",
   actions inline Vérifier / Évaluer (quick-eval sheet) / Approuver
   /Rejeter, alimentée par lib/coach/tasks.loadCoachTasks).

   Web (non-Capacitor) → redirect vers /coach/athletes où l'onglet
   "À traiter" du roster web tient le même contenu (pas de page web
   dédiée — décision step 3b, à reconsidérer si web atterrit ici via
   un lien direct).
───────────────────────────────────────────────────────────────── */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CoachATraiterMobile } from "@/components/shared/CoachATraiterMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function ATraiterPage() {
  const router = useRouter();

  useEffect(() => {
    if (!IS_CAPACITOR) router.replace("/coach/athletes");
  }, [router]);

  if (IS_CAPACITOR) return <CoachATraiterMobile />;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto">
      <p className="text-[14px] text-[#9CA3AF]">Redirection…</p>
    </div>
  );
}
