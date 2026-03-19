"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig, RECRUITMENT_STATUSES } from "@/lib/config/recruitmentStatuses";
import { MOCK_PIPELINE } from "../_data/mockPipelineData";
import type { PipelineAthlete } from "../_data/mockPipelineData";
import { RECRUITER_PROFILE } from "../_data/mockRecruiterProfile";
import RecruitmentStatusBadge from "../_components/RecruitmentStatusBadge";
import StatusChangeDropdown from "../_components/StatusChangeDropdown";
import NxIcon from "@/components/ui/NxIcon";
import ComposeIntroModal from "../_components/ComposeIntroModal";
import PipelinePhaseLabel from "../_components/PipelinePhaseLabel";
import PipelineKpiCards from "../_components/PipelineKpiCards";
import CelebrationToast from "../_components/CelebrationToast";

/* ═══════════════════════════════════════════════════════════════
   Mes Favoris — Recruitment pipeline grouped by phase
   Discovery (white) → Commitment (red) → Retirés (gray)
═══════════════════════════════════════════════════════════════ */

type FilterKey = "tous" | RecruitmentStatus;

/* ── Athlete card ────────────────────────────────────────────── */

function FavoriCard({
  a,
  onStatusChange,
  onComposeIntro,
  onCelebrate,
}: {
  a: PipelineAthlete;
  onStatusChange: (id: string, s: RecruitmentStatus, extra?: { visitDate?: string; retireReason?: RetireReason }) => void;
  onComposeIntro: (athlete: PipelineAthlete) => void;
  onCelebrate: () => void;
}) {
  const t = a.tracking;
  const cfg = getStatusConfig(t.status);

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 sm:p-6 hover:border-[#E63946]/30 hover:shadow-[0_0_24px_rgba(230,57,70,0.12)] hover:-translate-y-1.5 hover:scale-[1.01] transition-all duration-300 ease-out">
      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-[#2F3440] border border-[#2D3748] flex items-center justify-center shrink-0">
          <span className="text-[16px] font-bold text-white/20">{a.firstName[0]}{a.lastName[0]}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href={`/recruteur/athletes/${a.id}`} className="text-[17px] font-bold text-white hover:text-[#E63946] transition-colors">
                {a.firstName} {a.lastName}
              </Link>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">{a.position}</span>
                <span className="text-[#2D3748]">·</span>
                <span className="text-[13px] text-[#6b7280]">{a.niveau}</span>
                <span className="text-[#2D3748]">·</span>
                <span className="text-[13px] text-[#6b7280]">{a.region}</span>
                {a.stars > 0 && (
                  <>
                    <span className="text-[#2D3748]">·</span>
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill={i < a.stars ? "#F59E0B" : "#374151"} stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </span>
                  </>
                )}
              </div>
              <p className="text-[13px] text-[#6b7280] mt-1">{a.school}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <RecruitmentStatusBadge status={t.status} size="md" />
              <StatusChangeDropdown
                currentStatus={t.status}
                athleteId={a.id}
                hasExistingThread={!!t.firstContactedAt}
                onStatusChange={(s, extra) => onStatusChange(a.id, s, extra)}
                onComposeIntro={() => onComposeIntro(a)}
                onCelebrate={onCelebrate}
              />
            </div>
          </div>

          {/* Badges + verified */}
          <div className="flex items-center gap-2.5 mt-3">
            {a.isVerified && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6" stroke="none">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
            {a.badges.slice(0, 2).map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2D3748]/50 text-[12px] text-[#9CA3AF]">
                <NxIcon name={b.icon} size={13} className="text-[#6B7280]" /> {b.label}
              </span>
            ))}
            {a.hasVideo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2D3748]/50 text-[12px] text-[#9CA3AF]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                Vidéo
              </span>
            )}
          </div>

          {/* Bottom row: dates + actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#2D3748]/30">
            <div className="flex items-center gap-3">
              {t.visitDate && (cfg.phase === "commitment") && (
                <span className="text-[13px] font-semibold" style={{ color: "#E63946" }}>
                  📅 Visite le {new Date(t.visitDate).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                </span>
              )}
              {t.retireReason && t.status === "retire" && (
                <span className="text-[13px] text-[#6b7280] italic">{t.notes || "Retiré"}</span>
              )}
              {!t.visitDate && t.status !== "retire" && t.favoritedAt && (
                <span className="text-[13px] text-[#6b7280]">
                  Favori depuis le {new Date(t.favoritedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              {t.status !== "retire" && (
                <Link href={`/recruteur/messages/new?athlete=${a.id}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                  Message
                </Link>
              )}
              <Link href={`/recruteur/athletes/${a.id}`} className="text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
                Voir profil
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

const VALID_FILTERS: FilterKey[] = ["tous", "lettre_signee", "engage", "visite_planifiee", "en_discussion", "contacte", "identifie"];

export default function FavorisPage() {
  return (
    <Suspense fallback={<div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto text-[#6b7280]">Chargement...</div>}>
      <FavorisContent />
    </Suspense>
  );
}

function FavorisContent() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filtre") as FilterKey) || "tous";
  const [filter, setFilter] = useState<FilterKey>(VALID_FILTERS.includes(initialFilter) ? initialFilter : "tous");
  const [showRetired, setShowRetired] = useState(false);
  const [athletes, setAthletes] = useState<PipelineAthlete[]>(
    MOCK_PIPELINE.filter((a) => a.tracking.status !== "none")
  );
  const [composeTarget, setComposeTarget] = useState<PipelineAthlete | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const retiredCount = athletes.filter((a) => a.tracking.status === "retire").length;
  const visibleCount = athletes.filter((a) => a.tracking.status !== "retire").length;

  /* Pipeline counts for KPI row */
  const counts = useMemo(() => {
    const c: Record<RecruitmentStatus, number> = {
      none: 0, identifie: 0, contacte: 0, en_discussion: 0,
      visite_planifiee: 0, engage: 0, lettre_signee: 0, retire: 0,
    };
    for (const a of athletes) c[a.tracking.status]++;
    return c;
  }, [athletes]);

  /* Filtered + sorted list */
  const filtered = useMemo(() => {
    let list = [...athletes];
    if (!showRetired) list = list.filter((a) => a.tracking.status !== "retire");
    if (filter !== "tous") list = list.filter((a) => a.tracking.status === filter);
    list.sort((a, b) => {
      const orderA = getStatusConfig(a.tracking.status).order;
      const orderB = getStatusConfig(b.tracking.status).order;
      if (orderA !== orderB) return orderB - orderA; // Higher status first (lettre > engage > ...)
      return new Date(b.tracking.statusChangedAt).getTime() - new Date(a.tracking.statusChangedAt).getTime();
    });
    return list;
  }, [athletes, filter, showRetired]);

  /* Group by phase */
  const grouped = useMemo(() => {
    const commitment = filtered.filter((a) => {
      const p = getStatusConfig(a.tracking.status).phase;
      return p === "commitment";
    });
    const discovery = filtered.filter((a) => {
      const p = getStatusConfig(a.tracking.status).phase;
      return p === "auto";
    });
    const exit = filtered.filter((a) => {
      const p = getStatusConfig(a.tracking.status).phase;
      return p === "exit";
    });
    return { commitment, discovery, exit };
  }, [filtered]);

  const handleStatusChange = useCallback((id: string, newStatus: RecruitmentStatus, extra?: { visitDate?: string; retireReason?: RetireReason }) => {
    setAthletes((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      return {
        ...a,
        tracking: {
          ...a.tracking,
          status: newStatus,
          statusChangedAt: new Date().toISOString(),
          ...(newStatus === "retire" ? { retiredAt: new Date().toISOString(), previousStatus: a.tracking.status, retireReason: extra?.retireReason } : {}),
          ...(newStatus === "visite_planifiee" && extra?.visitDate ? { visitDate: extra.visitDate } : {}),
          ...(newStatus === "engage" ? { engagedAt: new Date().toISOString() } : {}),
          ...(newStatus === "lettre_signee" ? { letterSignedAt: new Date().toISOString() } : {}),
        },
      };
    }));
  }, []);

  const handleComposeIntroSend = useCallback((message: string) => {
    if (!composeTarget) return;
    handleStatusChange(composeTarget.id, "contacte");
    setComposeTarget(null);
    // In real app: send message to coach thread
  }, [composeTarget, handleStatusChange]);

  const handleCelebrateDone = useCallback(() => setShowCelebration(false), []);

  const showGrouped = filter === "tous";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Mes favoris</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Pipeline de recrutement</p>
        </div>
        <span className="text-[13px] font-bold text-[#6b7280]">{visibleCount} athlète{visibleCount !== 1 ? "s" : ""} actif{visibleCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Pipeline KPI boxes (clickable filter) */}
      <PipelineKpiCards counts={counts} activeFilter={filter} onFilterChange={setFilter} />

      {/* Retired toggle */}
      {retiredCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowRetired(!showRetired)}
            className="text-[11px] font-bold text-[#6b7280] hover:text-[#9CA3AF] transition-colors"
          >
            {showRetired ? "Masquer" : "Afficher"} les retirés ({retiredCount})
          </button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </div>
          <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">Aucun favori</h3>
          <p className="text-[14px] text-[#9CA3AF] max-w-md leading-relaxed mb-6">
            Explore les athlètes et clique le coeur pour commencer à bâtir ton pipeline.
          </p>
          <Link href="/recruteur/recherche" className="flex items-center gap-2 bg-[#E63946] text-white rounded-lg px-6 py-3 font-head font-bold text-[13px] uppercase tracking-widest transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 active:scale-95">
            Rechercher des athlètes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      ) : showGrouped ? (
        <div>
          {/* COMMITMENT phase (red) — shown first */}
          {grouped.commitment.length > 0 && (
            <div>
              <PipelinePhaseLabel phase="commitment" count={grouped.commitment.length} />
              <div className="space-y-4">
                {grouped.commitment.map((a) => (
                  <FavoriCard key={a.id} a={a} onStatusChange={handleStatusChange} onComposeIntro={setComposeTarget} onCelebrate={() => setShowCelebration(true)} />
                ))}
              </div>
            </div>
          )}

          {/* DISCOVERY phase (white) */}
          {grouped.discovery.length > 0 && (
            <div>
              <PipelinePhaseLabel phase="auto" count={grouped.discovery.length} />
              <div className="space-y-4">
                {grouped.discovery.map((a) => (
                  <FavoriCard key={a.id} a={a} onStatusChange={handleStatusChange} onComposeIntro={setComposeTarget} onCelebrate={() => setShowCelebration(true)} />
                ))}
              </div>
            </div>
          )}

          {/* EXIT phase (retired, if visible) */}
          {grouped.exit.length > 0 && showRetired && (
            <div>
              <PipelinePhaseLabel phase="exit" count={grouped.exit.length} />
              <div className="space-y-4">
                {grouped.exit.map((a) => (
                  <FavoriCard key={a.id} a={a} onStatusChange={handleStatusChange} onComposeIntro={setComposeTarget} onCelebrate={() => setShowCelebration(true)} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <FavoriCard key={a.id} a={a} onStatusChange={handleStatusChange} onComposeIntro={setComposeTarget} onCelebrate={() => setShowCelebration(true)} />
          ))}
        </div>
      )}

      {/* Compose Intro Modal */}
      {composeTarget && (
        <ComposeIntroModal
          recruiter={{
            firstName: RECRUITER_PROFILE.firstName,
            lastName: RECRUITER_PROFILE.lastName,
            title: RECRUITER_PROFILE.title,
            cegep: RECRUITER_PROFILE.cegep,
            teamName: RECRUITER_PROFILE.teamName,
            division: RECRUITER_PROFILE.division,
          }}
          athlete={{
            firstName: composeTarget.firstName,
            lastName: composeTarget.lastName,
            position: composeTarget.position,
            school: composeTarget.school,
            graduationYear: composeTarget.graduationYear,
          }}
          coachName={composeTarget.coachLastName}
          onSend={handleComposeIntroSend}
          onCancel={() => setComposeTarget(null)}
        />
      )}

      {/* Celebration toast */}
      <CelebrationToast show={showCelebration} onDone={handleCelebrateDone} />
    </div>
  );
}
