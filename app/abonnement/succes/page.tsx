"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   /abonnement/succes — Stripe Checkout success landing.
   Minimal for now — shows confirmation + redirects to dashboard.
   Calls useSubscription refresh pattern (re-fetch from DB) so the
   new tier is picked up immediately.
═══════════════════════════════════════════════════════════════ */

export default function SuccesPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      setRole(data?.role as string | null);
    })();
  }, []);

  const dashboardHref =
    role === "COACH" ? "/coach/athletes" :
    role === "RECRUTEUR" ? "/recruteur/recherche" :
    role === "ATHLETE" ? "/athlete/profil" :
    "/";

  return (
    <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-[#1A1D24] border border-[#2D3748] rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Paiement confirmé
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-3 leading-relaxed">
          Ton abonnement est maintenant actif. Profite de toutes les fonctionnalités débloquées.
        </p>
        <Link
          href={dashboardHref}
          className="mt-6 inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-wider transition-colors"
        >
          Accéder à mon tableau de bord
        </Link>
      </div>
    </div>
  );
}
