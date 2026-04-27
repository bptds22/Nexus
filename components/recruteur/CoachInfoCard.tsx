"use client";

import { useState } from "react";
import { useCoachReputation } from "@/lib/hooks/useCoachReputation";
import CoachReviewModal from "@/components/ui/CoachReviewModal";

const BADGE_STYLES: Record<string, { label: string; bg: string; border: string; fg: string }> = {
  RECOMMANDE:  { label: "Recommandé",   bg: "bg-[#22C55E]/15", border: "border-[#22C55E]/30", fg: "text-[#22C55E]" },
  COACH_ELITE: { label: "Coach élite",  bg: "bg-[#F59E0B]/15", border: "border-[#F59E0B]/30", fg: "text-[#F59E0B]" },
  PLACEUR:     { label: "Placeur",      bg: "bg-[#E63946]/15", border: "border-[#E63946]/30", fg: "text-[#E63946]" },
  EVALUE:      { label: "Évalué",       bg: "bg-[#3B82F6]/15", border: "border-[#3B82F6]/30", fg: "text-[#3B82F6]" },
};

function formatResponseTime(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}j`;
}

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = value >= i + 1;
        const partial = !filled && value > i && value < i + 1;
        return (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : partial ? "url(#half)" : "#4a4d56"} stroke="none">
            {partial && (
              <defs>
                <linearGradient id="half">
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="#4a4d56" />
                </linearGradient>
              </defs>
            )}
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
}

interface CoachInfoCardProps {
  coachId: string;
  coachName: string;
  coachInitials: string;
  coachAvatarUrl?: string;
  coachSchool?: string;
  coachRegion?: string;
  coachEmail?: string;
  coachPhone?: string;
  athleteId: string;
  athleteName: string;
}

export default function CoachInfoCard({
  coachId,
  coachName,
  coachInitials,
  coachAvatarUrl,
  coachSchool,
  coachRegion,
  coachEmail,
  coachPhone,
  athleteId,
  athleteName,
}: CoachInfoCardProps) {
  const [showReviewModal, setShowReviewModal] = useState(false);
  const {
    reputation,
    badges,
    placedCount,
    verifiedCount,
    avgResponseHours,
    hasMyReview,
    refresh,
  } = useCoachReputation(coachId);

  return (
    <>
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748]/60 p-6">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[#E63946] mb-4">Coach</p>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          {coachAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coachAvatarUrl} alt={coachName} className="w-14 h-14 rounded-full object-cover shrink-0 border border-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#2a2d36] flex items-center justify-center shrink-0">
              <span className="text-[16px] font-bold text-white">{coachInitials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-white truncate">{coachName}</p>
            <p className="text-[12px] text-[#9CA3AF] truncate">
              {coachSchool}{coachSchool && coachRegion ? " · " : ""}{coachRegion}
            </p>
          </div>
        </div>

        {/* Contact */}
        {(coachEmail || coachPhone) && (
          <div className="mt-3 space-y-1.5">
            {coachEmail && (
              <a href={`mailto:${coachEmail}`} className="flex items-center gap-2 group/link">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 7L2 7" /></svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors truncate">{coachEmail}</span>
              </a>
            )}
            {coachPhone && (
              <a href={`tel:${coachPhone}`} className="flex items-center gap-2 group/link">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                <span className="text-[12px] text-[#9CA3AF] group-hover/link:text-white transition-colors">{coachPhone}</span>
              </a>
            )}
          </div>
        )}

        {/* Reputation */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          {reputation ? (
            <>
              <div className="flex items-center gap-2">
                <StarRow value={reputation.avgNote} />
                <span className="text-[14px] font-bold text-white tabular-nums">{reputation.avgNote.toFixed(1)}/5</span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1">Note basée sur {reputation.count} avis de recruteurs</p>

              <div className="mt-4 space-y-2.5">
                {([
                  ["Qualité des profils", reputation.avgQualite],
                  ["Réactivité", reputation.avgReactivite],
                  ["Honnêteté des évaluations", reputation.avgHonnetete],
                  ["Professionnalisme", reputation.avgProf],
                ] as [string, number][]).map(([label, value]) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="text-white/75">{label}</span>
                      <span className="text-white font-bold tabular-nums">{value.toFixed(1)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-[#2D3748] overflow-hidden">
                      {/* eslint-disable-next-line react/forbid-dom-props -- width is dynamic from DB */}
                      <div
                        className="h-full rounded-full bg-[#22C55E] w-[var(--bar-w)]"
                        style={{ "--bar-w": `${Math.min(100, Math.max(0, (value / 5) * 100))}%` } as React.CSSProperties}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {reputation.recommendCount > 0 && (
                <p className="text-[11px] text-[#22C55E] mt-4">
                  ✓ {reputation.recommendCount} {reputation.recommendCount === 1 ? "recruteur recommande" : "recruteurs recommandent"} ce coach
                </p>
              )}
            </>
          ) : (
            <div>
              <p className="text-[13px] text-[#9CA3AF] italic">Aucun avis pour ce coach</p>
              <p className="text-[11px] text-[#6b7280] mt-1.5 leading-relaxed">
                Soyez le premier à évaluer la fiabilité de ce coach après votre interaction.
              </p>
            </div>
          )}
        </div>

        {/* Placement stats */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-[16px] font-bold text-white tabular-nums">{placedCount}</p>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Athlètes placés</p>
          </div>
          <div className="text-center border-l border-white/[0.06]">
            <p className="text-[16px] font-bold text-white tabular-nums">{verifiedCount}</p>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Vérifiés</p>
          </div>
          <div className="text-center border-l border-white/[0.06]">
            <p className="text-[16px] font-bold text-white tabular-nums">{formatResponseTime(avgResponseHours)}</p>
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider mt-0.5 leading-tight">Rép. moy.</p>
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex flex-wrap gap-1.5">
            {badges.map((b, idx) => {
              const style = BADGE_STYLES[b.badge] || { label: b.badge, bg: "bg-white/5", border: "border-white/10", fg: "text-[#9CA3AF]" };
              return (
                <span
                  key={`${b.badge}-${idx}`}
                  className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.border} ${style.fg}`}
                >
                  {style.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Review CTA */}
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowReviewModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#F59E0B] text-[#F59E0B] text-[13px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#F59E0B]/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            {hasMyReview ? "Modifier mon avis" : "Laisser un avis"}
          </button>
        </div>
      </div>

      {showReviewModal && (
        <CoachReviewModal
          coachId={coachId}
          coachName={coachName}
          athleteId={athleteId}
          athleteName={athleteName}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={async () => { await refresh(); }}
        />
      )}
    </>
  );
}
