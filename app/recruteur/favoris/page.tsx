"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig, RECRUITMENT_STATUSES } from "@/lib/config/recruitmentStatuses";
import type { PipelineAthlete } from "../_data/mockPipelineData";
import RecruitmentStatusBadge from "../_components/RecruitmentStatusBadge";
import StatusChangeDropdown from "../_components/StatusChangeDropdown";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";
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
                    <StarRating rating={a.stars} size="sm" />
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
  const [athletes, setAthletes] = useState<PipelineAthlete[]>([]);
  const [composeTarget, setComposeTarget] = useState<PipelineAthlete | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState({ firstName: "", lastName: "", title: "Recruteur", cegep: "", teamName: "", division: "" });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Load recruiter profile
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, schools!school_id(name)")
        .eq("id", user.id)
        .single();
      if (profile) {
        const schoolRaw = profile.schools;
        const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
        setRecruiterProfile({
          firstName: (profile.first_name as string) || "",
          lastName: (profile.last_name as string) || "",
          title: "Recruteur",
          cegep: (school as { name?: string } | null)?.name || "",
          teamName: "",
          division: "",
        });
      }

      supabase
        .from("recruiter_favorites")
        .select(`
          id,
          athlete_id,
          created_at,
          athletes!athlete_id(
            id,
            first_name,
            last_name,
            verified,
            profile_completion,
            video_faits_saillants_url,
            annee_diplomation,
            cote_globale_entraineur,
            taille_pieds,
            taille_pouces,
            poids_lbs,
            statut_recrutement_override,
            sports!sport_id(nom),
            positions!position_id(nom, abreviation),
            schools!school_id(name, region),
            evaluations(distinctions, cote_globale)
          )
        `)
        .eq("recruiter_id", user.id)
        .then(({ data, error }) => {
          console.log("Favoris loaded:", data?.length, error);
          if (!data) return;

          const mapped: PipelineAthlete[] = data.map((p: Record<string, unknown>) => {
            const aRaw = p.athletes;
            const a = (Array.isArray(aRaw) ? aRaw[0] : aRaw) as Record<string, unknown> | null;
            const sportRel = a?.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const posRel = a?.positions;
            const pos = (Array.isArray(posRel) ? posRel[0] : posRel) as { nom?: string; abreviation?: string } | null;
            const schoolRel = a?.schools;
            const school = (Array.isArray(schoolRel) ? schoolRel[0] : schoolRel) as { name?: string; region?: string } | null;
            const evalRel = a?.evaluations;
            const eval0 = (Array.isArray(evalRel) ? evalRel[0] : evalRel) as Record<string, unknown> | null;
            const override = (a?.statut_recrutement_override as string) || "";
            const statusKey = override ? override.toLowerCase().replace(/ /g, "_") : "identifie";

            return {
              id: (a?.id as string) || (p.athlete_id as string),
              firstName: (a?.first_name as string) || "Athlète",
              lastName: (a?.last_name as string) || "Inconnu",
              position: pos?.abreviation || "",
              sport: sport?.nom || "",
              school: school?.name || "",
              region: school?.region || "",
              niveau: "Sec. 5" as const,
              graduationYear: (a?.annee_diplomation as number) || 0,
              stars: (eval0?.cote_globale as number) || (a?.cote_globale_entraineur as number) || 0,
              isVerified: !!(a?.verified),
              hasVideo: !!(a?.video_faits_saillants_url),
              badges: [],
              coachName: "",
              coachLastName: "",
              tracking: {
                recruiterId: user.id,
                athleteId: (a?.id as string) || (p.athlete_id as string),
                status: statusKey as RecruitmentStatus,
                favoritedAt: (p.created_at as string) || new Date().toISOString(),
                statusChangedAt: (p.created_at as string) || new Date().toISOString(),
                firstContactedAt: undefined,
                notes: "",
              },
            };
          });
          console.log("Favoris mapped:", mapped.length, mapped.map(m => `${m.firstName} ${m.lastName} (${m.tracking.status})`));
          setAthletes(mapped);
        });
    });
  }, []);

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

  const handleStatusChange = useCallback(async (id: string, newStatus: RecruitmentStatus, _extra?: { visitDate?: string; retireReason?: RetireReason }) => {
    // Status changes are local only — recruiter_favorites doesn't track stages
    // In future: write to recruiter_pipeline table
    setAthletes((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      return {
        ...a,
        tracking: {
          ...a.tracking,
          status: newStatus,
          statusChangedAt: new Date().toISOString(),
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
            firstName: recruiterProfile.firstName,
            lastName: recruiterProfile.lastName,
            title: recruiterProfile.title,
            cegep: recruiterProfile.cegep,
            teamName: recruiterProfile.teamName,
            division: recruiterProfile.division,
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
