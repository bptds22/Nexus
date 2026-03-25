"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PlaybookBackground from "../../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Pending Validation (Coach + Recruiter)
   Shown after signup while waiting for approval.
   Dynamic message based on role.
───────────────────────────────────────────────────────────────── */

export default function PendingPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>("recruiter");
  const [institutionName, setInstitutionName] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("nexus_user");
    if (!raw) {
      router.replace("/auth");
      return;
    }
    const user = JSON.parse(raw);
    if (user.status !== "pending_validation") {
      router.replace("/onboarding");
      return;
    }
    setRole(user.role);
    if (user.institution?.name) {
      setInstitutionName(user.institution.name);
    }
  }, [router]);

  const simulateApproval = () => {
    const raw = localStorage.getItem("nexus_user");
    if (!raw) return;
    const user = JSON.parse(raw);
    user.status = "active";
    localStorage.setItem("nexus_user", JSON.stringify(user));
    router.push("/onboarding");
  };

  const isCoach = role === "coach";
  const isLeagueCoach = role === "coach_league";

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col items-center justify-center relative px-6">
      <PlaybookBackground />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-12">
          <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={40} height={40} className="object-contain" />
          <span className="font-head font-black text-white text-xl tracking-[0.06em] uppercase">Nexus</span>
        </Link>

        {/* Clock icon with spin */}
        <div className="mb-8 animate-spin-slow">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mb-4">
          Ton compte est en cours de validation
        </h1>

        {/* Body — role-specific */}
        <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6 max-w-[450px]">
          {isLeagueCoach ? (
            <>
              Le coordonnateur de {institutionName || "ta ligue"} doit confirmer ton accès.
              Si ta ligue n&apos;a pas encore de coordonnateur sur Nexus, un administrateur s&apos;en occupera.
              {institutionName && (
                <span className="block mt-2 text-white font-semibold">{institutionName}</span>
              )}
            </>
          ) : isCoach ? (
            <>
              L&apos;administrateur de ton école ou un admin Nexus confirmera ton accès sous peu.
              {institutionName && (
                <span className="block mt-2 text-white font-semibold">{institutionName}</span>
              )}
            </>
          ) : (
            <>
              Un administrateur Nexus vérifie ton affiliation
              {institutionName ? ` avec ${institutionName}` : " avec ton CÉGEP"}.
              Tu recevras un courriel de confirmation dès que ton accès sera approuvé.
            </>
          )}
        </p>

        {/* Delay pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
          <span className="text-xs font-bold text-[#EAB308] uppercase tracking-wider">Délai habituel : 24-48h</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mb-6">
          <Link href="/" className="flex-1 h-11 flex items-center justify-center rounded-lg border border-white/10 text-sm font-bold text-white hover:border-white/20 transition-colors">
            Retour à l&apos;accueil
          </Link>
          <a href="mailto:support@nexus-sport.ca" className="flex-1 h-11 flex items-center justify-center rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors">
            Contacter le support
          </a>
        </div>

        {/* Already confirmed link */}
        <Link href="/auth" className="text-xs text-[#9CA3AF] hover:text-white transition-colors mb-12">
          Tu as déjà reçu ta confirmation? <span className="underline">Se connecter</span>
        </Link>

        {/* Demo shortcut */}
        <button
          type="button"
          onClick={simulateApproval}
          className="text-[10px] text-[#6B7280]/60 hover:text-[#6B7280] transition-colors uppercase tracking-wider cursor-pointer"
        >
          DÉMO : Cliquer ici pour simuler l&apos;approbation
        </button>
      </div>

      {/* CSS for slow spin */}
      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
