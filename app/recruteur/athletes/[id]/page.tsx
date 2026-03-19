"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  ALL_RECRUITER_PROFILES,
  mockAthleteProfileFull,
} from "@/lib/mock/athleteProfileRecruiter";
import type { AthleteProfileRecruiterView, AthleteTraitRatings } from "@/lib/types/models";
import { BADGE_COLORS } from "@/lib/types/models";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getAthleteTracking } from "@/app/recruteur/_data/mockPipelineData";
import RecruitmentStatusBadge from "@/app/recruteur/_components/RecruitmentStatusBadge";
import StatusChangeDropdown from "@/app/recruteur/_components/StatusChangeDropdown";
import ComposeIntroModal from "@/app/recruteur/_components/ComposeIntroModal";
import CelebrationToast from "@/app/recruteur/_components/CelebrationToast";
import NxIcon from "@/components/ui/NxIcon";

/* ═══════════════════════════════════════════════════════════════
   Recruiter Athlete Profile — Simplified / Detailed toggle
   Uses AthleteProfileRecruiterView (privacy-safe, no email/phone)
═══════════════════════════════════════════════════════════════ */

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";
const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

const CHARACTER_TRAITS: { key: keyof AthleteTraitRatings; label: string; iconName: string }[] = [
  { key: "leadership", label: "Leadership", iconName: "leadership" },
  { key: "discipline", label: "Discipline", iconName: "discipline" },
  { key: "coachability", label: "Coachabilité", iconName: "coachability" },
  { key: "gameIQ", label: "Intelligence de jeu", iconName: "gameIQ" },
  { key: "competitiveness", label: "Compétitivité", iconName: "competitiveness" },
  { key: "teamwork", label: "Esprit d'équipe", iconName: "teamwork" },
  { key: "resilience", label: "Résilience", iconName: "resilience" },
  { key: "attitude", label: "Attitude", iconName: "attitude" },
];

const FLAG_REASONS = [
  "Informations incorrectes",
  "Profil incomplet ou trompeur",
  "Données statistiques douteuses",
  "Photo ou contenu inapproprié",
  "Autre",
];

/* ── Profile Toggle ─────────────────────────────────────────── */

function ProfileToggle({ mode, onChange }: { mode: "simple" | "detailed"; onChange: (m: "simple" | "detailed") => void }) {
  const pill = (active: boolean) =>
    `px-5 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-all cursor-pointer ${
      active
        ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
        : "text-[#6b7280] hover:text-white"
    }`;
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-xl p-1.5 w-fit">
      <button type="button" onClick={() => onChange("simple")} className={pill(mode === "simple")}>
        Simplifié
      </button>
      <button type="button" onClick={() => onChange("detailed")} className={pill(mode === "detailed")}>
        Détaillé
      </button>
    </div>
  );
}

/* ── Completeness Indicator ─────────────────────────────────── */

function CompletenessBar({ percent }: { percent: number }) {
  const color = percent >= 80 ? "#3B82F6" : percent >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{percent}%</span>
    </div>
  );
}

/* ── Star Display (read-only) ───────────────────────────────── */

function Stars({ rating, max = 5, size = 16 }: { rating: number; max?: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill={i < rating ? "#F59E0B" : "#374151"}>
          <path d="M10,0L12.2,7.2L20,7.2L14,11.8L16.2,19L10,14.6L3.8,19L6,11.8L0,7.2L7.8,7.2Z" />
        </svg>
      ))}
    </div>
  );
}

/* ── Badge Pill Components ──────────────────────────────────── */

function VerifiedBadge({ isVerified }: { isVerified: boolean }) {
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isVerified ? "#3B82F6" : "#6B7280" }} />
      {isVerified ? "Vérifié" : "Non vérifié"}
    </span>
  );
}

function FavoritesBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#E63946" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {count} recruteur{count > 1 ? "s" : ""}
    </span>
  );
}

function RecruitmentStatusPill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
    ouvert: { bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.25)", text: "#FFFFFF", dot: "#22C55E", label: "Ouvert aux offres" },
    committed: { bg: "rgba(37,99,235,0.12)", border: "rgba(37,99,235,0.3)", text: "#3B82F6", dot: "#3B82F6", label: "Committed" },
  };
  const c = cfg[status] || cfg.ouvert;
  return (
    <span className={pillBase} style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  );
}

function PreferencePill({ active, label: lbl }: { active?: boolean; label: string }) {
  if (active === undefined) return null;
  return (
    <span className={pillBase} style={{ backgroundColor: "rgba(255,255,255,0.10)", borderColor: "rgba(255,255,255,0.25)", color: "#FFFFFF" }}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: active ? "#22C55E" : "#6B7280" }} />
      {lbl}
    </span>
  );
}

/* ── Player Card (V30) ──────────────────────────────────────── */

/** Extract abbreviation from position string like "Quart-arrière (QB)" → "QB" */
function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

function PlayerCard({ a }: { a: AthleteProfileRecruiterView }) {
  const stars = Math.round(a.overallRating);
  const posAbbr = positionAbbr(a.primaryPosition);
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>
      {a.isVerified && (
        <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }}>
          <div className="rounded-full" style={{ border: '3px solid #111317' }}>
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="rc_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#rc_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      )}

      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          {a.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 120, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.05em', lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.firstName}</p>
            <p style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 28, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>{a.lastName}</p>
          </div>
        </div>

        {/* Ticket */}
        <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div className="flex" style={{ width: 322 }}>
            <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr },
                { lbl: "Promo", val: String(a.graduationYear) },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>{r.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-bebas), sans-serif', fontSize: 16, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              <div style={{ display: 'inline-flex', background: '#1E2128', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}>
                <svg width="130" height="20" viewBox="0 0 130 20" fill="none" style={{ display: 'block' }}>
                  {[0, 26, 52, 78, 104].map((x, i) => (
                    <path key={x} d="M10,0L12.2,7.2L20,7.2L14,11.8L16.2,19L10,14.6L3.8,19L6,11.8L0,7.2L7.8,7.2Z"
                      fill={i < stars ? "#F59E0B" : "#374151"} transform={`translate(${x},0)`} />
                  ))}
                </svg>
              </div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2 }}>{a.schoolName}</div>
              <div style={{ fontFamily: 'var(--font-barlow-cond), sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#9CA3AF' }}>{a.region}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 24, writingMode: 'vertical-rl' as const, fontFamily: 'var(--font-bebas), sans-serif', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── InfoRow helper ─────────────────────────────────────────── */

function InfoRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/40 last:border-b-0">
      <span className="text-[13px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      <span className="text-[14px] font-bold text-white">{value}</span>
    </div>
  );
}

/* ── Coach Reputation Mini-Card ─────────────────────────────── */

function CoachReputationCard({ rep, coachName }: { rep: NonNullable<AthleteProfileRecruiterView["coachReputation"]>; coachName: string }) {
  const badgeLabel: Record<string, { label: string; color: string }> = {
    none: { label: "Non évalué", color: BADGE_COLORS.none },
    evaluated: { label: "Évalué", color: BADGE_COLORS.evaluated },
    recommended: { label: "Recommandé", color: BADGE_COLORS.recommended },
    elite: { label: "Élite", color: BADGE_COLORS.elite },
  };
  const b = badgeLabel[rep.badge] || badgeLabel.none;

  return (
    <div className={`${cardBase} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={sectionLabel + " mb-0"}>Réputation du coach</h3>
        <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full" style={{ backgroundColor: `${b.color}20`, color: b.color, border: `1px solid ${b.color}40` }}>
          {b.label}
        </span>
      </div>
      <p className="text-[14px] text-[#9CA3AF] mb-3">{coachName}</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[22px] font-head font-black text-white">{rep.overallScore.toFixed(1)}</p>
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#6b7280]">Score</p>
        </div>
        <div>
          <p className="text-[22px] font-head font-black text-white">{rep.totalPlacements}</p>
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#6b7280]">Placements</p>
        </div>
        <div>
          <p className="text-[22px] font-head font-black text-white">{rep.avgResponseTimeHours}h</p>
          <p className="text-[10px] font-bold tracking-wider uppercase text-[#6b7280]">Rép. moy.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

export default function RecruiterAthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const a: AthleteProfileRecruiterView = ALL_RECRUITER_PROFILES[id] || mockAthleteProfileFull;

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const isDetailed = mode === "detailed";

  const [isFavorited, setIsFavorited] = useState(true);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagSubmitted, setFlagSubmitted] = useState(false);

  // Pipeline status tracking
  const initialTracking = getAthleteTracking(id);
  const [pipelineStatus, setPipelineStatus] = useState<RecruitmentStatus>(initialTracking?.status || "none");
  const [showComposeIntro, setShowComposeIntro] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  function handleStatusChange(newStatus: RecruitmentStatus, _extra?: { visitDate?: string; retireReason?: RetireReason }) {
    setPipelineStatus(newStatus);
  }

  // Trait average (moved up for coteGlobale calc)
  const traitAvg = a.traitRatings
    ? (Object.values(a.traitRatings).reduce((s, v) => s + v, 0) / Object.values(a.traitRatings).length)
    : null;

  // Cote Globale — auto-avg from 8 traits if available, else overallRating
  const coteGlobale = traitAvg ?? a.overallRating;

  // Stat strip cells — same in both modes: height + weight + distinctions
  const statCells: { top: string; mid: string; sub?: string; iconName?: string }[] = [
    { top: a.heightDisplay || "—", mid: "Taille" },
    { top: a.weightDisplay || "—", mid: "Poids" },
    ...a.distinctions.map((b) => ({ top: "", mid: b.label, sub: b.detail, iconName: b.icon })),
  ];

  // Athletic tests data
  const tests: { label: string; value?: string }[] = [
    { label: "40 verges", value: a.fortyYard },
    { label: "Saut vertical", value: a.verticalJump },
    { label: "Saut en longueur", value: a.broadJump },
    { label: "Bench press", value: a.benchPress },
    { label: "Navette / Agilité", value: a.shuttleAgility },
    { label: "100m sprint", value: a.sprint100m },
  ];
  const hasTests = tests.some((t) => t.value);

  // Media links
  const mediaLinks: { label: string; url?: string; iconName: string }[] = [
    { label: "Faits saillants", url: a.highlightVideoUrl, iconName: "play" },
    { label: "Match complet", url: a.fullGameUrl, iconName: "film" },
    { label: "Entraînement", url: a.practiceVideoUrl, iconName: "dumbbell" },
    { label: "Hudl", url: a.hudlUrl, iconName: "chart" },
    { label: "YouTube", url: a.youtubeUrl, iconName: "monitor" },
    { label: "Instagram", url: a.instagramUrl, iconName: "camera" },
  ];
  const hasMedia = mediaLinks.some((m) => m.url);

  return (
    <div className="min-h-screen relative z-1">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="bg-[#1A1D24]/80 backdrop-blur-sm border-b border-[#2D3748] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/recruteur/recherche" className="text-[14px] text-[#6b7280] hover:text-white transition-colors flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
              Retour à la recherche
            </Link>
            <span className="text-[#2D3748]">|</span>
            <span className="text-[12px] text-[#6b7280] tracking-wider uppercase">Profil athlète</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => { if (!flagSubmitted) setShowFlagModal(true); }}
              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-300 ${
                flagSubmitted
                  ? "text-[#F59E0B] bg-[#F59E0B]/10"
                  : "text-[#6b7280] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)]"
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={flagSubmitted ? "#F59E0B" : "none"} stroke={flagSubmitted ? "#F59E0B" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={flagSubmitted ? "" : "group-hover:stroke-[#F59E0B] transition-colors duration-300"}>
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              {flagSubmitted ? "Signalé" : "Signaler"}
            </button>
            <button
              type="button"
              onClick={() => setIsFavorited(!isFavorited)}
              className="flex items-center gap-1.5 text-[12px] font-bold transition-colors"
              style={{ color: isFavorited ? "#E63946" : "#9CA3AF" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorited ? "#E63946" : "none"} stroke={isFavorited ? "#E63946" : "currentColor"} strokeWidth="2" strokeLinecap="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              {isFavorited ? "Dans tes favoris" : "Ajouter aux favoris"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 pb-28 relative z-1">

        {/* ── Toggle + Completeness ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <ProfileToggle mode={mode} onChange={setMode} />
          <div className="w-full sm:w-56">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1">Profil complété</p>
            <CompletenessBar percent={a.profileCompleteness} />
          </div>
        </div>

        {/* ══════════ HERO — 2 Columns ══════════ */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          <div className="shrink-0 flex justify-center lg:justify-start" style={{ minHeight: 480 }}>
            <PlayerCard a={a} />
          </div>

          <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
            <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
              {a.firstName}<br />{a.lastName}
              {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <VerifiedBadge isVerified={a.isVerified} />
              <FavoritesBadge count={a.favoriteCount} />
              <RecruitmentStatusPill status={a.commitmentStatus || "ouvert"} />
              <RecruitmentStatusBadge status={pipelineStatus} size="md" />
            </div>

            {pipelineStatus !== "none" && (
              <div className="flex items-center gap-3">
                <StatusChangeDropdown
                  currentStatus={pipelineStatus}
                  athleteId={id}
                  hasExistingThread={false}
                  onStatusChange={handleStatusChange}
                  onComposeIntro={() => setShowComposeIntro(true)}
                  onCelebrate={() => setShowCelebration(true)}
                />
              </div>
            )}

            {a.viewsThisMonth > 0 && (
              <div className="flex items-center gap-1.5 text-[#6b7280]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-[13px]">{a.viewsThisMonth} vues ce mois</span>
              </div>
            )}

            {/* Video CTA */}
            <div>
              {a.highlightVideoUrl ? (
                <a href={a.highlightVideoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-[#1A1D24] border border-[#2D3748] rounded-lg px-5 py-3 text-white font-bold text-[14px] uppercase tracking-wider transition-all hover:border-[#E63946] hover:shadow-[0_0_16px_rgba(230,57,70,0.2)] hover:-translate-y-0.5 group">
                  <span className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 19 12 8 19 8 5" /></svg>
                  </span>
                  Voir les faits saillants
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#6b7280] group-hover:text-white transition-colors">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              ) : (
                <div className="inline-flex items-center gap-2.5 bg-[#1A1D24]/50 border border-[#2D3748] rounded-lg px-5 py-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2D3748" strokeWidth="1.5" strokeLinecap="round">
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <span className="text-[14px] text-[#6b7280]">Aucun lien vidéo</span>
                </div>
              )}
            </div>

            {/* Stat Strip */}
            <div>
              <h3 className={sectionLabel}>Profil athlète</h3>
              <div className={`${cardBase} overflow-hidden`}>
                <div className="grid divide-x divide-[#2D3748]/50" style={{ gridTemplateColumns: `repeat(${statCells.length}, minmax(0, 1fr))` }}>
                  {statCells.map((cell, i) => (
                    <div key={i} className={`p-4 text-center flex flex-col items-center justify-center min-h-[100px] ${cell.iconName ? "bg-[#E63946]/[0.04]" : ""}`}>
                      {cell.iconName ? (
                        <div className="flex items-center justify-center min-h-[36px]">
                          <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center">
                            <NxIcon name={cell.iconName} size={22} className="text-[#E63946]" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[26px] sm:text-[30px] font-head font-black text-white leading-none flex items-center justify-center min-h-[36px]">{cell.top}</p>
                      )}
                      <p className={`text-[12px] font-bold tracking-[0.2em] uppercase mt-2 ${cell.iconName ? "text-white" : "text-[#9CA3AF]"}`}>{cell.mid}</p>
                      {cell.sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{cell.sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ COACH REPORT (both modes — content varies) ══════════ */}
        {a.coachReport && (
          <section>
            <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
            <div className={`relative ${cardBase} p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden`}>
              <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
              <div className="relative">
                <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5" style={{ borderLeft: "3px solid #E63946" }}>
                  &ldquo;{a.coachReport}&rdquo;
                </p>
                <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">-- {a.coachName}, {a.coachSchool}</p>

                {/* Simplified: single Cote Globale score + stars */}
                {!isDetailed && (
                  <div className="mt-3 pl-5 flex items-center gap-3">
                    <Stars rating={Math.round(coteGlobale)} size={18} />
                    <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                    <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                  </div>
                )}

                {/* Detailed: Cote Globale + full 8-trait grid */}
                {isDetailed && (
                  <div className="mt-5 pl-5">
                    <div className="flex items-center gap-3 mb-4">
                      <Stars rating={Math.round(coteGlobale)} size={18} />
                      <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                      <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                    </div>

                    {a.traitRatings && (
                      <div className="border-t border-[#2D3748]/50 pt-4">
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Détail par trait</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {CHARACTER_TRAITS.map((trait) => {
                            const val = a.traitRatings![trait.key];
                            return (
                              <div key={trait.key} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                                <span className="text-[13px] text-[#c8c8cc] flex items-center gap-2">
                                  <NxIcon name={trait.iconName} size={15} className="text-[#6B7280]" />
                                  {trait.label}
                                </span>
                                <Stars rating={val} size={14} />
                              </div>
                            );
                          })}
                        </div>
                        {traitAvg !== null && (
                          <div className="mt-4 pt-4 border-t border-[#2D3748]/50 flex items-center justify-between">
                            <span className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">Moyenne des traits</span>
                            <div className="flex items-center gap-2">
                              <Stars rating={Math.round(traitAvg)} size={16} />
                              <span className="text-[16px] font-head font-black text-white">{traitAvg.toFixed(1)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Distinctions in detailed coach report */}
                    {a.distinctions.length > 0 && (
                      <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Distinctions</p>
                        <div className="flex flex-wrap gap-3">
                          {a.distinctions.map((d, i) => (
                            <div key={i} className="flex items-center gap-3 bg-[#E63946]/[0.06] border border-[#E63946]/20 rounded-lg px-4 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#E63946]/10 flex items-center justify-center flex-shrink-0">
                                <NxIcon name={d.icon} size={16} className="text-[#E63946]" />
                              </div>
                              <div>
                                <p className="text-[13px] font-bold text-white">{d.label}</p>
                                {d.detail && <p className="text-[11px] text-[#9CA3AF]">{d.detail}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ══════════ ACADEMIC PROFILE (both modes) ══════════ */}
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className={`${cardBase} overflow-hidden`}>
            <div className={`grid grid-cols-1 ${isDetailed ? "sm:grid-cols-3" : "sm:grid-cols-2"} divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50`}>
              <div className="p-5 text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
              </div>
              {isDetailed && (
                <div className="p-5 text-center">
                  <p className="text-[18px] font-bold text-white leading-none mt-1">{a.program || "—"}</p>
                  <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme</p>
                </div>
              )}
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
              </div>
            </div>
            <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
              <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
              <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
              <PreferencePill active={a.wantsDEC} label="Veut faire un DEC" />
              <PreferencePill active={a.openToAnglophone} label="Ouvert anglophone" />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
           DETAILED SECTIONS — only when toggle = Détaillé
        ════════════════════════════════════════════════════ */}
        {isDetailed && (
          <div className="space-y-6" key="detailed-sections">

            {/* ── Personal Info ─────────────────────────────── */}
            <section className="nx-slide-section">
              <h2 className={sectionLabel}>Informations personnelles</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Âge" value={`${a.age} ans`} icon="calendar" />
                <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
                <InfoRow label="Ville" value={a.city} icon="mapPin" />
                <InfoRow label="Région" value={a.region} icon="map" />
                <InfoRow label="École" value={a.schoolName} icon="building" />
                <InfoRow label="Graduation" value={a.graduationYear} icon="gradCap" />
              </div>
            </section>

            {/* ── Physical Measurements ────────────────────── */}
            <section className="nx-slide-section">
              <h2 className={sectionLabel}>Mesures physiques</h2>
              <div className={`${cardBase} overflow-hidden`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 divide-x divide-y divide-[#2D3748]/40">
                  {[
                    { label: "Taille", value: a.heightDisplay },
                    { label: "Poids", value: a.weightDisplay },
                    { label: "Envergure", value: a.wingspan },
                    { label: "Main", value: a.handSize },
                    { label: "Main dom.", value: a.dominantHand },
                    { label: "Pied dom.", value: a.dominantFoot },
                  ].filter(m => m.value).map((m) => (
                    <div key={m.label} className="p-4 text-center">
                      <p className="text-[22px] font-head font-black text-white leading-none">{m.value}</p>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── Athletic Tests ───────────────────────────── */}
            {hasTests && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Tests athlétiques</h2>
                <div className={`${cardBase} overflow-hidden`}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-[#2D3748]/40">
                    {tests.filter((t) => t.value).map((t) => (
                      <div key={t.label} className="p-4 text-center">
                        <p className="text-[22px] font-head font-black text-white leading-none">{t.value}</p>
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-2">{t.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Sport Info ───────────────────────────────── */}
            <section className="nx-slide-section">
              <h2 className={sectionLabel}>Informations sportives</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Sport principal" value={a.primarySport} icon="activity" />
                <InfoRow label="Position" value={a.primaryPosition} icon="target" />
                <InfoRow label="Numéro" value={a.jerseyNumber ? `#${a.jerseyNumber}` : undefined} icon="hash" />
                <InfoRow label="Équipe" value={a.teamName} icon="flag" />
                <InfoRow label="Ligue" value={a.leagueName} icon="trophy" />
                <InfoRow label="Niveau" value={a.teamLevel} icon="layers" />
                {a.secondarySport && (
                  <>
                    <div className="border-t border-[#2D3748]/40 my-2" />
                    <InfoRow label="Sport secondaire" value={a.secondarySport} icon="activity" />
                    <InfoRow label="Position secondaire" value={a.secondaryPosition} icon="target" />
                  </>
                )}
              </div>
            </section>

            {/* ── Academic Details (extended) ──────────────── */}
            {(a.strongSubjects.length > 0 || a.academicHonors.length > 0 || a.targetCegepProgram.length > 0 || a.preferredRegions.length > 0) && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Détails académiques</h2>
                <div className={`${cardBase} p-5 space-y-4`}>
                  {a.strongSubjects.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Matières fortes</p>
                      <div className="flex flex-wrap gap-2">
                        {a.strongSubjects.map((s) => (
                          <span key={s} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.academicHonors.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Honneurs</p>
                      <div className="flex flex-wrap gap-2">
                        {a.academicHonors.map((h) => (
                          <span key={h} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.targetCegepProgram.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Programme cégep visé</p>
                      <div className="flex flex-wrap gap-2">
                        {a.targetCegepProgram.map((p) => (
                          <span key={p} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.preferredRegions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Régions préférées</p>
                      <div className="flex flex-wrap gap-2">
                        {a.preferredRegions.map((r) => (
                          <span key={r} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-[#c8c8cc] border border-[#2D3748]">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Media & Links ────────────────────────────── */}
            {hasMedia && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Médias & liens</h2>
                <div className={`${cardBase} p-5`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mediaLinks.filter((m) => m.url).map((m) => (
                      <a
                        key={m.label}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-[#2D3748]/50 bg-white/[0.02] hover:border-[#E63946]/40 hover:bg-[#E63946]/5 transition-all group"
                      >
                        <NxIcon name={m.iconName} size={18} className="text-[#6B7280] group-hover:text-[#E63946] transition-colors" />
                        <span className="text-[14px] font-bold text-[#c8c8cc] group-hover:text-white transition-colors">{m.label}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-[#6b7280] group-hover:text-[#E63946] transition-colors">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Coach Reputation ─────────────────────────── */}
            {a.coachReputation && (
              <section className="nx-slide-section">
                <CoachReputationCard rep={a.coachReputation} coachName={a.coachName} />
              </section>
            )}

          </div>
        )}
      </div>

      {/* ══════════ STICKY CTA — CONTACTER LE COACH ══════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-6 md:left-auto md:right-6 md:w-auto">
        <div className="md:hidden bg-[#111317]/95 backdrop-blur-sm border-t border-[#2D3748] px-4 py-3">
          <Link href={`/recruteur/messages/new?athlete=${a.id}`}
            className="w-full flex items-center justify-center gap-2.5 bg-[#E63946] text-white rounded-xl px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all hover:bg-[#D42B22] active:scale-[0.98] shadow-[0_0_20px_rgba(230,57,70,0.3)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
            Contacter le coach
          </Link>
        </div>
        <Link href={`/recruteur/messages/new?athlete=${a.id}`}
          className="hidden md:flex items-center gap-2.5 bg-[#E63946] text-white rounded-xl px-8 py-4 font-head font-bold text-[14px] uppercase tracking-widest min-w-[220px] justify-center transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(230,57,70,0.4)] active:scale-[0.98] shadow-[0_4px_20px_rgba(230,57,70,0.3)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
          </svg>
          Contacter le coach
        </Link>
      </div>

      {/* ══════════ COMPOSE INTRO MODAL ══════════ */}
      {showComposeIntro && (
        <ComposeIntroModal
          recruiter={{
            firstName: "Pierre",
            lastName: "Dufour",
            title: "Recruteur en chef",
            cegep: "CÉGEP Garneau",
            teamName: "Élans",
            division: "D1",
          }}
          athlete={{
            firstName: a.firstName,
            lastName: a.lastName,
            position: a.primaryPosition,
            school: a.schoolName,
            graduationYear: a.graduationYear,
          }}
          coachName={a.coachName || "Coach"}
          onSend={() => { setPipelineStatus("contacte"); setShowComposeIntro(false); }}
          onCancel={() => setShowComposeIntro(false)}
        />
      )}

      <CelebrationToast show={showCelebration} onDone={() => setShowCelebration(false)} />

      {/* ══════════ FLAG PROFILE MODAL ══════════ */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFlagModal(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[480px] mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/15 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-head text-[16px] font-bold text-white uppercase tracking-wide">Signaler ce profil</h3>
                  <p className="text-[12px] text-[#6b7280]">{a.firstName} {a.lastName}</p>
                </div>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setShowFlagModal(false)} className="text-[#6b7280] hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 pb-6 space-y-4">
              <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
                Le coach, le directeur et l&apos;administrateur seront notifiés pour réviser les informations de ce profil.
              </p>
              <div>
                <label className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mb-1.5 block">Raison du signalement *</label>
                <select
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  aria-label="Raison du signalement"
                  className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] focus:border-[#F59E0B] outline-none transition-colors"
                >
                  <option value="">Sélectionner une raison</option>
                  {FLAG_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mb-1.5 block">Détails (optionnel)</label>
                <textarea
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  placeholder="Décris ce qui te semble incorrect..."
                  className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-[#e0e0e0] placeholder:text-[#6b7280] focus:border-[#F59E0B] outline-none resize-none transition-colors"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowFlagModal(false)} className="px-4 py-2.5 rounded-lg text-[14px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!flagReason}
                  onClick={() => { setFlagSubmitted(true); setShowFlagModal(false); }}
                  className="flex items-center gap-2 bg-[#F59E0B] text-[#111317] rounded-lg px-5 py-2.5 font-bold text-[14px] uppercase tracking-wider transition-all hover:bg-[#D97706] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  Envoyer le signalement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
