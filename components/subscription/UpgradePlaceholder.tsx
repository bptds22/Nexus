"use client";

import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   UpgradePlaceholder — replacement UI shown when a gate is locked.

   This is a REPLACEMENT, not an overlay. When rendered, the gated
   children are NOT in the React tree. Their effects never fire,
   their data fetches never execute, and no Supabase payload for the
   gated content ever reaches the browser. The DevTools > Network
   tab on a Free account shows no requests for gated data.

   Props:
     - tier:        required — "pro" | "all_star"
     - featureName: optional — a GatedFeature key (or "school_management" /
                    "cegep_management") that maps to a specific description;
                    if omitted or unknown, renders a generic message.
═══════════════════════════════════════════════════════════════ */

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  messaging: "Envoie des messages directement aux coachs pour discuter de leurs athlètes.",
  analytics: "Accède à des analyses avancées de recrutement et de performance.",
  export_pdf: "Exporte les profils athlètes en PDF professionnel.",
  detailed_eval: "Évalue tes athlètes sur 11 critères détaillés au lieu de 5.",
  video_upload: "Upload des vidéos directement sur Nexus au lieu de liens externes.",
  who_viewed: "Découvre quels CÉGEPs et recruteurs consultent ton profil.",
  bulk_message: "Envoie des messages à plusieurs coachs en un clic.",
  unlimited_pipeline: "Suis un nombre illimité d'athlètes dans ton processus.",
  unlimited_favorites: "Ajoute autant d'athlètes que tu veux à tes favoris.",
  unlimited_profiles: "Crée un nombre illimité de profils athlètes.",
  school_management: "Supervise tes coachs, suis les placements et gère ton école.",
  cegep_management: "Supervise tes recruteurs, suis les recrues et gère ton CÉGEP.",
  custom_lists: "Crée des listes personnalisées pour organiser tes prospects par sport, position ou stratégie.",
  activity_feed: "Suis l'activité récente — qui a consulté tes athlètes, qui a envoyé des messages, et plus.",
};

interface UpgradePlaceholderProps {
  tier: "pro" | "all_star";
  featureName?: string;
}

export default function UpgradePlaceholder({ tier, featureName }: UpgradePlaceholderProps) {
  const tierLabel = tier === "all_star" ? "All Star" : "Pro";
  const description =
    (featureName && FEATURE_DESCRIPTIONS[featureName]) ||
    `Débloquez cette fonctionnalité en passant au forfait ${tierLabel}.`;

  return (
    <div className="bg-[#1A1D24] border border-[#E63946]/20 rounded-xl p-8 flex flex-col items-center text-center min-h-[280px] justify-center">
      <div className="w-14 h-14 rounded-full bg-[#E63946]/10 flex items-center justify-center mb-4">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <h3 className="font-head text-lg font-black text-white mb-2">
        Fonctionnalité {tierLabel}
      </h3>
      <p className="text-[13px] text-[#9CA3AF] leading-relaxed max-w-sm mb-5">
        {description}
      </p>
      <Link
        href="/tarifs"
        className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-bold text-[12px] uppercase tracking-wider transition-colors"
      >
        Voir les forfaits →
      </Link>
    </div>
  );
}
