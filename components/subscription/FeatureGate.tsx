"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   FeatureGate — Wraps Pro-only features with blur + lock overlay
   Reads user tier from localStorage. Default tier = 'free'.
═══════════════════════════════════════════════════════════════ */

export type GatedFeature =
  | "messaging"
  | "analytics"
  | "export_pdf"
  | "detailed_eval"
  | "video_upload"
  | "who_viewed"
  | "bulk_message"
  | "prospect_lists"
  | "unlimited_pipeline"
  | "unlimited_favorites"
  | "unlimited_profiles";

export type RequiredTier = "coach_pro" | "recruteur_pro" | "athlete_pro";

interface FeatureGateProps {
  feature: GatedFeature;
  requiredTier: RequiredTier;
  children: React.ReactNode;
  blurIntensity?: "light" | "heavy";
}

const TIER_LABELS: Record<RequiredTier, string> = {
  coach_pro: "Coach Pro",
  recruteur_pro: "Recruteur Pro",
  athlete_pro: "Athlète Pro",
};

const FEATURE_DESCRIPTIONS: Record<GatedFeature, string> = {
  messaging: "Envoie des messages directement aux coachs pour discuter de leurs athlètes.",
  analytics: "Accède à des analyses avancées de recrutement et de performance.",
  export_pdf: "Exporte les profils athlètes en PDF professionnel.",
  detailed_eval: "Évalue tes athlètes sur 11 critères détaillés au lieu de 5.",
  video_upload: "Upload des vidéos directement sur Nexus au lieu de liens externes.",
  who_viewed: "Découvre quels CÉGEPs et recruteurs consultent ton profil.",
  bulk_message: "Envoie des messages à plusieurs coachs en un clic.",
  prospect_lists: "Crée des listes personnalisées pour organiser tes prospects.",
  unlimited_pipeline: "Suis un nombre illimité d'athlètes dans ton pipeline.",
  unlimited_favorites: "Ajoute autant d'athlètes que tu veux à tes favoris.",
  unlimited_profiles: "Crée un nombre illimité de profils athlètes.",
};

export default function FeatureGate({
  feature,
  requiredTier,
  children,
  blurIntensity = "heavy",
}: FeatureGateProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [checked, setChecked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user.tier === requiredTier || user.tier === "admin") {
          setHasAccess(true);
        }
      }
    } catch {
      // noop
    }
    setChecked(true);
  }, [requiredTier]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Not checked yet — render nothing to avoid flash
  if (!checked) return null;

  // User has access — render children normally
  if (hasAccess) return <>{children}</>;

  const blurPx = blurIntensity === "heavy" ? "8px" : "4px";
  const tierLabel = TIER_LABELS[requiredTier];

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Blurred children */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: `blur(${blurPx})` }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="bg-[#1A1D24] border border-white/10 rounded-xl p-6 max-w-sm mx-4 text-center shadow-2xl">
          {/* Lock icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#E63946]/10 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>

          <h3 className="font-head text-lg font-black text-white mb-2">
            Fonctionnalité Pro
          </h3>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-5">
            {FEATURE_DESCRIPTIONS[feature]}
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={() => showToast("Redirection vers Stripe Checkout (Phase 2)")}
            className="w-full h-11 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors mb-2"
          >
            Passer à {tierLabel} →
          </button>
          <Link href="/tarifs" className="text-[12px] text-[#6B7280] hover:text-white transition-colors">
            Voir les plans
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
