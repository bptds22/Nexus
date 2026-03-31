"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   FeatureGate — Wraps features with blur + lock overlay.
   requiredTier='pro' → Pro or All Star unlocks.
   requiredTier='allstar' → Only All Star unlocks.
   Reads user tier from localStorage.
═══════════════════════════════════════════════════════════════ */

export type GatedFeature =
  | "messaging" | "analytics" | "export_pdf" | "detailed_eval"
  | "video_upload" | "who_viewed" | "bulk_message" | "prospect_lists"
  | "unlimited_pipeline" | "unlimited_favorites" | "unlimited_profiles"
  | "school_management" | "cegep_management";

interface FeatureGateProps {
  feature: GatedFeature;
  requiredTier: "pro" | "allstar";
  children: React.ReactNode;
  blurIntensity?: "light" | "heavy";
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
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
  school_management: "Supervise tes coachs, suis les placements et gère ton école.",
  cegep_management: "Supervise tes recruteurs, suis les recrues et gère ton CÉGEP.",
};

function getUserTierLevel(): "free" | "pro" | "allstar" | "admin" {
  if (typeof window === "undefined") return "free";
  try {
    const user = JSON.parse(localStorage.getItem("nexus_user") || "{}");
    if (user.is_school_admin || user.is_cegep_admin) return "admin";
    const tier = user.subscription?.tier || user.tier || "free";
    if (tier.includes("allstar")) return "allstar";
    if (tier !== "free") return "pro";
    return "free";
  } catch { return "free"; }
}

export default function FeatureGate({ feature, requiredTier, children, blurIntensity = "heavy" }: FeatureGateProps) {
  const [hasAccess, setHasAccess] = useState(false);
  const [checked, setChecked] = useState(false);
  const [userLevel, setUserLevel] = useState<"free" | "pro" | "allstar" | "admin">("free");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const level = getUserTierLevel();
    setUserLevel(level);
    const granted =
      level === "admin" ||
      level === "allstar" ||
      (requiredTier === "pro" && level === "pro");
    setHasAccess(granted);
    setChecked(true);
  }, [requiredTier]);

  if (!checked) return null;
  if (hasAccess) return <>{children}</>;

  const blurPx = blurIntensity === "heavy" ? "8px" : "4px";
  const isAllStarGate = requiredTier === "allstar";

  // CTA adapts based on what tier they need
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
          {userLevel === "pro" && isAllStarGate && (
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
