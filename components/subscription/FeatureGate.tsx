"use client";

import Link from "next/link";
import { useState } from "react";
import { useSubscription } from "@/lib/hooks/useSubscription";

/* ═══════════════════════════════════════════════════════════════
   FeatureGate — DB-backed gate that blurs children + shows a
   paywall overlay when the user's tier doesn't meet requiredTier.

   Source of truth: useSubscription() hook (reads the `subscriptions`
   table). School/CÉGEP admins bypass the gate.

   NOTE: children still render (blurred) inside the DOM. Converting
   this to a conditional render is a Phase 4 concern — do NOT change
   that behaviour here.
═══════════════════════════════════════════════════════════════ */

export type GatedFeature =
  | "messaging" | "analytics" | "export_pdf" | "detailed_eval"
  | "video_upload" | "who_viewed" | "bulk_message"
  | "unlimited_pipeline" | "unlimited_favorites" | "unlimited_profiles"
  | "school_management" | "cegep_management";

interface FeatureGateProps {
  feature: GatedFeature;
  requiredTier: "pro" | "all_star";
  children: React.ReactNode;
  blurIntensity?: "light" | "heavy";
}

const FEATURE_DESCRIPTIONS: Record<GatedFeature, string> = {
  messaging: "Envoie des messages directement aux coachs pour discuter de leurs athlètes.",
  analytics: "Accède à des analyses avancées de recrutement et de performance.",
  export_pdf: "Exporte les profils athlètes en PDF professionnel.",
  detailed_eval: "Évalue tes athlètes sur 11 critères détaillés au lieu de 5.",
  video_upload: "Upload des vidéos directement sur Nexus au lieu de liens externes.",
  who_viewed: "Découvre quels CÉGEPs et recruteurs consultent ton profil.",
  bulk_message: "Envoie des messages à plusieurs coachs en un clic.",
  unlimited_pipeline: "Suis un nombre illimité d'athlètes dans ton pipeline.",
  unlimited_favorites: "Ajoute autant d'athlètes que tu veux à tes favoris.",
  unlimited_profiles: "Crée un nombre illimité de profils athlètes.",
  school_management: "Supervise tes coachs, suis les placements et gère ton école.",
  cegep_management: "Supervise tes recruteurs, suis les recrues et gère ton CÉGEP.",
};

export default function FeatureGate({ feature, requiredTier, children, blurIntensity = "heavy" }: FeatureGateProps) {
  const { tier, isSchoolAdmin, loading } = useSubscription();
  const [toast, setToast] = useState<string | null>(null);

  if (loading) return null;

  // admins always bypass; all_star bypasses everything; pro bypasses pro-level gates
  const hasAccess =
    isSchoolAdmin ||
    tier === "all_star" ||
    (requiredTier === "pro" && tier === "pro");

  if (hasAccess) return <>{children}</>;

  const blurPx = blurIntensity === "heavy" ? "8px" : "4px";
  const isAllStarGate = requiredTier === "all_star";
  const ctaLabel = isAllStarGate ? "Passer à All Star — 29,99$/mois" : "Passer à Pro";
  const ctaColor = isAllStarGate ? "#E63946" : "#DAB65A";
  const ctaBg = isAllStarGate ? "bg-[#E63946] hover:bg-[#D42B22]" : "bg-[#DAB65A] hover:bg-[#c9a84f] text-[#111317]";
  const titleText = isAllStarGate ? "Fonctionnalité All Star" : "Fonctionnalité Pro";

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none" style={{ filter: `blur(${blurPx})` }} aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ctaColor}15` }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ctaColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>
          <h3 className="font-head text-lg font-black text-white mb-2">{titleText}</h3>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
            {FEATURE_DESCRIPTIONS[feature] || "Cette fonctionnalité nécessite un abonnement supérieur."}
          </p>
          {tier === "pro" && isAllStarGate && (
            <p className="text-[11px] text-[#DAB65A] mb-3">Tu es Pro — passe à All Star pour débloquer</p>
          )}
          <button
            type="button"
            onClick={() => { setToast("Redirection vers Stripe Checkout (Phase 2)"); setTimeout(() => setToast(null), 3000); }}
            className={`w-full h-11 rounded-lg text-white font-head font-bold text-[12px] uppercase tracking-wider transition-colors mb-2 ${ctaBg}`}
          >
            {ctaLabel} →
          </button>
          <Link href="/tarifs" className="text-[12px] text-[#6B7280] hover:text-white transition-colors">
            Voir les plans
          </Link>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
