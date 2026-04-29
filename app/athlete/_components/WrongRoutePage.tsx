"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface WrongRoutePageProps {
  role: "COACH" | "RECRUTEUR" | null;
}

const DASHBOARD_BY_ROLE: Record<string, string> = {
  COACH: "/coach/tableau-de-bord",
  RECRUTEUR: "/recruteur/tableau-de-bord",
};

const ROLE_LABEL: Record<string, string> = {
  COACH: "entraîneur",
  RECRUTEUR: "recruteur",
};

export default function WrongRoutePage({ role }: WrongRoutePageProps) {
  const router = useRouter();
  const dashboardUrl = role ? DASHBOARD_BY_ROLE[role] : "/auth";
  const roleLabel = role ? ROLE_LABEL[role] : "utilisateur";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  return (
    <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full text-center space-y-8">

        {/* Football route diagram SVG */}
        <div className="flex justify-center">
          <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90">
            {/* Field lines */}
            <line x1="0" y1="40" x2="280" y2="40" stroke="#2D3748" strokeWidth="1" strokeDasharray="4 4"/>
            <line x1="0" y1="80" x2="280" y2="80" stroke="#2D3748" strokeWidth="1" strokeDasharray="4 4"/>
            <line x1="0" y1="120" x2="280" y2="120" stroke="#2D3748" strokeWidth="1" strokeDasharray="4 4"/>
            <line x1="0" y1="160" x2="280" y2="160" stroke="#2D3748" strokeWidth="1" strokeDasharray="4 4"/>

            {/* Intended route — straight up (green dotted) */}
            <path d="M140 180 L140 30" stroke="#22C55E" strokeWidth="2" strokeDasharray="6 4" fill="none"/>
            <text x="148" y="60" fill="#22C55E" fontSize="10" fontFamily="monospace" fontWeight="700">INTENDED</text>

            {/* Wrong route — curving away (red solid) */}
            <path d="M140 180 Q 140 130, 200 100 T 240 50" stroke="#E63946" strokeWidth="3" fill="none"/>
            <circle cx="240" cy="50" r="6" fill="#E63946"/>

            {/* Player marker at start */}
            <circle cx="140" cy="180" r="8" fill="#1A1D24" stroke="#E63946" strokeWidth="2"/>

            {/* Direction arrow */}
            <path d="M232 56 L240 50 L246 58" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <h1 className="font-head text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
            Oops, mauvais tracé!
          </h1>
          <p className="text-[14px] text-[#9CA3AF] italic">
            Wrong route — this section is for athletes only.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-3">
          <p className="text-[15px] text-[#9CA3AF] leading-relaxed">
            Cette section est réservée aux athlètes. En tant que {roleLabel}, ton tableau de bord t&apos;attend de l&apos;autre côté du terrain.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="pt-2">
          <Link
            href={dashboardUrl}
            className="inline-flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white px-6 py-3 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(230,57,70,0.35)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5"/>
              <path d="M12 19l-7-7 7-7"/>
            </svg>
            Retour à mon tableau de bord
          </Link>
        </div>

        {/* Secondary: logout */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleLogout}
            className="text-[12px] text-[#6b7280] hover:text-white transition-colors underline underline-offset-2"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  );
}
