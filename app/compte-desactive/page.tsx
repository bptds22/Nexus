"use client";

import Link from "next/link";
import NexusLogo from "@/components/ui/NexusLogo";

/* ══════════════════════════════════════════════════════════════
   PAGE 5 — Compte désactivé
   Route: /compte-desactive
   Standalone full-page layout (no sidebar).
   Shown when a deactivated coach tries to access the platform.
══════════════════════════════════════════════════════════════ */

export default function CompteDesactivePage() {
  /* Mock data — in production, this would come from auth/session */
  const deactivatedAt = "2026-02-20T10:00:00Z";
  const reason = "Inactif depuis plus de 30 jours, aucune réponse aux relances.";
  const formattedDate = new Date(deactivatedAt).toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#111317] flex items-center justify-center px-6">
      <div className="max-w-[480px] w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <NexusLogo variant="white" height={40} href="/" />
        </div>

        {/* Lock icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2A2D35] flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[24px] font-head font-bold text-white">
          Votre compte a été désactivé
        </h1>

        {/* Description */}
        <div className="space-y-3">
          <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
            Votre compte a été désactivé par le directeur de votre établissement
            le <span className="text-white font-medium">{formattedDate}</span>.
          </p>

          {reason && (
            <div className="bg-[#1A1D24] rounded-lg border border-[#1e2128] px-4 py-3 text-left">
              <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-[0.15em] mb-1">
                Raison
              </p>
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                {reason}
              </p>
            </div>
          )}

          <p className="text-[13px] text-[#6B7280] leading-relaxed">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, veuillez contacter votre
            directeur ou l&apos;équipe Nexus.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="mailto:support@nexus-sport.ca"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#1A1D24] border border-[#2A2D35] text-[13px] font-bold text-white hover:border-[#E63946] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contacter le support
          </Link>
          <Link
            href="/"
            className="text-[13px] text-[#6B7280] hover:text-white transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
