"use client";

import React, { useEffect, useState } from "react";

/* ── Props ── */
interface CriteriaBreakdownProps {
  profileQuality: number;
  responsiveness: number;
  honesty: number;
  professionalism: number;
}

/* ── Bar color helper ── */
function barColor(score: number): string {
  if (score >= 4.0) return "#22C55E";
  if (score >= 3.0) return "#F59E0B";
  return "#E63946";
}

/* ── Advice map ── */
const ADVICE: Record<string, string> = {
  honesty:
    "Assurez-vous que vos évaluations d'athlètes correspondent à la réalité observée par les recruteurs. Des évaluations trop généreuses réduisent la confiance.",
  responsiveness:
    "Essayez de répondre aux messages des recruteurs dans les 24h. Un temps de réponse rapide améliore significativement votre score.",
  profileQuality:
    "Complétez les profils de vos athlètes au maximum. Les recruteurs apprécient des données complètes : stats, vidéo, académique.",
  professionalism:
    "Maintenez un ton professionnel et structuré dans vos échanges. Les recruteurs évaluent la qualité de la communication.",
};

/* ── Lightbulb Icon ── */
const LightbulbIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
    <path d="M9 18h6M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
  </svg>
);

/* ── Component ── */
export default function CriteriaBreakdown({
  profileQuality,
  responsiveness,
  honesty,
  professionalism,
}: CriteriaBreakdownProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const criteria = [
    { key: "profileQuality", label: "Qualité des profils", score: profileQuality, delay: 0 },
    { key: "responsiveness", label: "Réactivité", score: responsiveness, delay: 100 },
    { key: "honesty", label: "Honnêteté des évaluations", score: honesty, delay: 200 },
    { key: "professionalism", label: "Professionnalisme", score: professionalism, delay: 300 },
  ];

  // Find weakest criterion below 3.5 for advice
  const belowThreshold = criteria.filter((c) => c.score < 3.5);
  const weakest =
    belowThreshold.length > 0
      ? belowThreshold.reduce((a, b) => (a.score < b.score ? a : b))
      : null;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6">
      <h3 className="font-head text-[16px] font-bold text-white mb-5">
        Détail par critère
      </h3>

      <div className="flex flex-col gap-4">
        {criteria.map((c) => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="text-[14px] text-white w-[140px] shrink-0">
              {c.label}
            </span>
            <div className="flex-1 h-[10px] bg-[#2A2D35] rounded-[5px] overflow-hidden">
              <div
                className="h-full rounded-[5px]"
                style={{
                  width: animated ? `${(c.score / 5) * 100}%` : "0%",
                  backgroundColor: barColor(c.score),
                  transition: `width 600ms ease-out`,
                  transitionDelay: `${c.delay}ms`,
                }}
              />
            </div>
            <span className="text-[14px] font-bold text-white w-[40px] text-right shrink-0">
              {c.score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Conditional advice box */}
      {weakest && (
        <div className="bg-[rgba(245,158,11,0.08)] border-l-[3px] border-[#F59E0B] rounded-r-lg p-4 mt-4">
          <div className="flex gap-2">
            <LightbulbIcon />
            <p className="text-[13px] text-[#9CA3AF]">
              {ADVICE[weakest.key]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
