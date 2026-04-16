"use client";

import { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  mockAthleteProfileFull,
} from "@/lib/mock/athleteProfileRecruiter";
import type { AthleteProfileRecruiterView, AthleteTraitRatings, GlobalRecruitmentStatus } from "@/lib/types/models";
import { BADGE_COLORS } from "@/lib/types/models";
import RecruitmentStatusBadgeGlobal from "@/components/ui/RecruitmentStatusBadge";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { parseDistinctions, MAX_BADGES } from "@/lib/config/badges";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getAthleteTracking } from "@/app/recruteur/_data/mockPipelineData";
import RecruitmentStatusBadge from "@/app/recruteur/_components/RecruitmentStatusBadge";
import StatusChangeDropdown from "@/app/recruteur/_components/StatusChangeDropdown";
import ComposeIntroModal from "@/app/recruteur/_components/ComposeIntroModal";
import CelebrationToast from "@/app/recruteur/_components/CelebrationToast";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";
import VideoEmbed from "@/components/ui/VideoEmbed";
import { calculateCompletion, type AthleteLike, type EvalLike } from "@/lib/utils/profileCompletion";
import { isValidationExpired } from "@/lib/utils/profileValidation";

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

const TRAIT_LIST: { key: keyof AthleteTraitRatings; label: string }[] = [
  { key: "leadership", label: "Leadership" },
  { key: "discipline", label: "Discipline" },
  { key: "coachability", label: "Coachabilité" },
  { key: "gameIQ", label: "Intelligence de jeu" },
  { key: "competitiveness", label: "Compétitivité" },
  { key: "teamwork", label: "Esprit d'équipe" },
  { key: "resilience", label: "Résilience" },
  { key: "attitude", label: "Attitude / Mentalité" },
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
  const color = percent >= 90 ? "#3B82F6" : percent >= 60 ? "#22C55E" : percent >= 40 ? "#EAB308" : "#EF4444";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-[#2D3748] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{percent}%</span>
    </div>
  );
}

/* Stars: use shared StarRating component */

/* ── Badge Pill Components ──────────────────────────────────── */

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
  const ratingValue = a.overallRating;
  const posAbbr = positionAbbr(a.primaryPosition);
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;
  const badgeActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });

  return (
    <div className="nx-v30-wrap relative" style={{ width: 300, paddingTop: 6, paddingBottom: 10 }}>
      <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12 }} title={badgeActive ? "Profil vérifié" : a.isVerified ? "Badge désactivé — confirmation requise" : "Profil non vérifié"}>
        <div className="rounded-full" style={{ border: '3px solid #111317' }}>
          {badgeActive ? (
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
          ) : (
            <svg width="48" height="48" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="26" fill="#4B5563" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="#6B7280" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>
      </div>

      <div className="nx-v30-card relative overflow-visible" style={{ width: 300, borderRadius: 10 }}>
        <div className="relative overflow-hidden" style={{ width: 300, height: 420, borderRadius: 10, background: '#2F3440' }}>
          {a.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} className="absolute inset-0 w-full h-full object-cover object-[center_15%] z-[1]" />
          ) : (
            <div className="absolute inset-0 z-[1] flex items-center justify-center">
              <span style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 120, fontWeight: 900, color: 'rgba(255,255,255,0.06)', letterSpacing: '0.05em', lineHeight: 1 }}>
                {a.firstName[0]}{a.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          <div className="absolute bottom-4 left-4 z-[3]">
            <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{a.firstName}</p>
            <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{a.lastName}</p>
          </div>
        </div>

        {/* Ticket */}
        <div className="nx-v30-ticket absolute z-[999] overflow-hidden" style={{ bottom: -14, right: -22, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div className="flex" style={{ width: 322 }}>
            <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '12px 14px 12px 16px', minWidth: 96, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr || "—" },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>{r.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '12px 16px' }}>
              <div className="relative overflow-hidden" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBottom: 6 }}>
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} width="28" height="28" viewBox="0 0 24 24" fill={ratingValue >= i + 1 ? "#F59E0B" : ratingValue >= i + 0.5 ? "#F59E0B" : "#D1D5DB"} stroke="none">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
                <div className="card-star-shimmer absolute inset-0 pointer-events-none" />
              </div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{(a.schoolName || "").replace(/^École secondaire /i, "É.S. ").replace(/^École sec\. /i, "É.S. ")}</div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' as const }}>{a.region}</div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 4 }}>Promotion {a.graduationYear}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 24, writingMode: 'vertical-rl' as const, fontFamily: 'var(--font-outfit), sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
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
  const searchParams = useSearchParams();
  const isPreview = searchParams?.get("preview") === "true";
  const [a, setA] = useState<AthleteProfileRecruiterView>(mockAthleteProfileFull);
  const [loadingAthlete, setLoadingAthlete] = useState(true);
  const [recruitmentStatus, setRecruitmentStatus] = useState<GlobalRecruitmentStatus>("OUVERT");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [myPipelineStage, setMyPipelineStage] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [isAllStar, setIsAllStar] = useState(false);
  const [coachRepData, setCoachRepData] = useState<{
    reviewCount: number;
    avgRating: number;
    avgQualite: number;
    avgReactivite: number;
    avgHonnetete: number;
    avgPro: number;
    recommandePct: number;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("athletes")
      .select(`
        id,
        first_name,
        last_name,
        photo_url,
        verified,
        profile_completion,
        last_profile_validation,
        numero_jersey,
        annee_diplomation,
        date_naissance,
        genre,
        video_faits_saillants_url,
        hudl_url,
        youtube_url,
        instagram_url,
        video_match_complet_url,
        video_entrainement_url,
        moyenne_generale,
        matieres_fortes,
        mentions_academiques,
        programme_cegep_vise,
        ouvert_cegep_prive,
        ouvert_cegep_anglophone,
        pret_changer_region,
        regions_cegep_preferees,
        taille_pieds,
        taille_pouces,
        poids_lbs,
        envergure,
        taille_mains,
        main_dominante,
        pied_dominant,
        test_40_verges,
        saut_vertical,
        saut_longueur,
        developpe_couche,
        navette_agilite,
        sprint_100m,
        bio,
        cote_globale_entraineur,
        consentement_parental,
        statut_recrutement_override,
        notes_coach,
        ouvert_entraineur_cegep,
        coach_id,
        recruitment_status,
        committed_school_id,
        open_to_offers,
        sport_secondaire_id,
        position_secondaire_id,
        sports!athletes_sport_id_fkey(nom),
        positions!athletes_position_id_fkey(nom, abreviation),
        schools!school_id(name, region, city),
        committed_school:schools!committed_school_id(name),
        evaluations(
          vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination,
          vision_du_jeu, sens_tactique,
          leadership, discipline, coachabilite, intelligence_jeu,
          competitivite, esprit_equipe, resilience, attitude_mentalite,
          cote_globale, rapport_entraineur, distinctions
        ),
        users!athletes_coach_id_fkey(first_name, last_name)
      `)
      .eq("id", id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoadingAthlete(false); return; }
        console.log('Profile athlete data:', data);

        const d = data as Record<string, unknown>;
        const evals = d.evaluations as Record<string, unknown>[] | null;
        const eval0 = evals?.[0];
        console.log("DEBUG evaluations raw:", JSON.stringify(d.evaluations));
        console.log("DEBUG eval0:", JSON.stringify(eval0));
        console.log("DEBUG distinctions:", eval0?.distinctions);
        console.log("DEBUG cote_globale:", eval0?.cote_globale);
        console.log("DEBUG school:", JSON.stringify(d.schools));
        console.log("DEBUG programme:", JSON.stringify(d.programme_cegep_vise));

        // Extract global recruitment fields
        const recruitmentStatusRaw = (d.recruitment_status as string) || "OUVERT";
        const committedSchoolRel = d.committed_school as { name: string } | null;
        const committedSchoolNameVal = committedSchoolRel?.name || "";
        const openToOffersVal = d.open_to_offers as boolean | null;
        setRecruitmentStatus(recruitmentStatusRaw as GlobalRecruitmentStatus);
        setCommittedSchoolName(committedSchoolNameVal);
        setOpenToOffers(openToOffersVal ?? null);
        const coach = d.users as { first_name: string; last_name: string } | null;
        const sportRel = Array.isArray(d.sports) ? d.sports[0] : d.sports;
        const posRel = Array.isArray(d.positions) ? d.positions[0] : d.positions;
        const sport = sportRel as { nom: string } | null;
        const pos = posRel as { nom: string; abreviation: string } | null;

        // School info
        const schoolRel = Array.isArray(d.schools) ? d.schools[0] : d.schools;
        const school = schoolRel as { name: string; region: string; city: string } | null;

        // Age from birth date
        const birthDate = d.date_naissance as string | null;
        const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

        // Secondary sport/position lookup
        let secondarySportName = "";
        let secondaryPositionName = "";
        if (d.sport_secondaire_id) {
          const { data: secSport } = await supabase.from("sports").select("nom").eq("id", d.sport_secondaire_id as string).maybeSingle();
          secondarySportName = secSport?.nom || "";
        }
        if (d.position_secondaire_id) {
          const { data: secPos } = await supabase.from("positions").select("nom, abreviation").eq("id", d.position_secondaire_id as string).maybeSingle();
          secondaryPositionName = secPos ? (secPos.abreviation ? `${secPos.nom} (${secPos.abreviation})` : secPos.nom) : "";
        }

        // Programme CÉGEP
        const progArr = (d.programme_cegep_vise as string[]) || [];

        const heightFt = d.taille_pieds as number | null;
        const heightIn = d.taille_pouces as number | null;
        const heightDisplay = heightFt ? `${heightFt}'${heightIn || 0}"` : null;
        const weightDisplay = d.poids_lbs ? `${d.poids_lbs} lbs` : null;

        const traitRatings = eval0 ? {
          speed: (eval0.vitesse_explosivite as number) || 0,
          power: (eval0.force_puissance as number) || 0,
          endurance: (eval0.endurance_cardio as number) || 0,
          agility: (eval0.agilite_coordination as number) || 0,
          gameVision: (eval0.vision_du_jeu as number) || 0,
          tactics: (eval0.sens_tactique as number) || 0,
          leadership: (eval0.leadership as number) || 0,
          discipline: (eval0.discipline as number) || 0,
          coachability: (eval0.coachabilite as number) || 0,
          gameIQ: (eval0.intelligence_jeu as number) || 0,
          competitiveness: (eval0.competitivite as number) || 0,
          teamwork: (eval0.esprit_equipe as number) || 0,
          resilience: (eval0.resilience as number) || 0,
          attitude: (eval0.attitude_mentalite as number) || 0,
        } : null;

        const mapped: AthleteProfileRecruiterView = {
          ...mockAthleteProfileFull,
          id: d.id as string,
          firstName: d.first_name as string,
          lastName: d.last_name as string,
          photoUrl: (d.photo_url as string) || "",
          isVerified: d.verified as boolean,
          lastValidation: (d.last_profile_validation as string) || null,
          profileCompleteness: calculateCompletion(d as AthleteLike, (eval0 as EvalLike) || null, null).percentage,
          jerseyNumber: (d.numero_jersey as string) || "",
          graduationYear: (d.annee_diplomation as number) || 0,
          highlightVideoUrl: (d.video_faits_saillants_url as string) || "",
          hudlUrl: (d.hudl_url as string) || "",
          youtubeUrl: (d.youtube_url as string) || "",
          instagramUrl: (d.instagram_url as string) || "",
          fullGameUrl: (d.video_match_complet_url as string) || "",
          practiceVideoUrl: (d.video_entrainement_url as string) || "",
          gpa: (d.moyenne_generale as number) || undefined,
          strongSubjects: (d.matieres_fortes as string[]) || [],
          academicHonors: (d.mentions_academiques as string[]) || [],
          program: progArr.length > 0 ? progArr.join(", ") : "",
          targetCegepProgram: progArr,
          wantsDEC: progArr.some(p => p.toLowerCase().includes("dec") || p.toLowerCase().includes("général")),
          openToPrivate: (d.ouvert_cegep_prive as boolean) || false,
          openToAnglophone: (d.ouvert_cegep_anglophone as boolean) || false,
          openToRelocate: (d.pret_changer_region as boolean) || false,
          preferredRegions: (d.regions_cegep_preferees as string[]) || [],
          heightDisplay: heightDisplay || "",
          weightDisplay: weightDisplay || "",
          wingspan: (d.envergure as string) || "",
          handSize: (d.taille_mains as string) || "",
          dominantHand: (d.main_dominante as "Droite" | "Gauche" | "Ambidextre") || undefined,
          dominantFoot: (d.pied_dominant as "Gauche" | "Droit" | "Les deux") || undefined,
          fortyYard: (d.test_40_verges as string) || "",
          verticalJump: (d.saut_vertical as string) || "",
          broadJump: (d.saut_longueur as string) || "",
          benchPress: (d.developpe_couche as string) || "",
          shuttleAgility: (d.navette_agilite as string) || "",
          sprint100m: (d.sprint_100m as string) || "",
          primarySport: sport?.nom || "",
          primaryPosition: pos?.abreviation ? `${pos.nom} (${pos.abreviation})` : pos?.nom || "",
          secondarySport: secondarySportName,
          secondaryPosition: secondaryPositionName,
          schoolName: school?.name || "",
          region: school?.region || "",
          city: school?.city || "",
          age: age || 0,
          gender: (d.genre as "M" | "F" | "Autre") || "M",
          commitmentStatus: (d.statut_recrutement_override as string) || "ouvert",
          coachReport: (eval0?.rapport_entraineur as string) || "",
          coachName: coach ? `${coach.first_name} ${coach.last_name}` : "",
          coachSchool: school?.name || "",
          coachReputation: undefined,
          overallRating: (eval0?.cote_globale as number) ?? (d.cote_globale_entraineur as number) ?? 0,
          traitRatings: traitRatings as AthleteProfileRecruiterView["traitRatings"],
          distinctions: parseDistinctions(eval0?.distinctions),
          favoriteCount: 0,
          viewsThisMonth: 0,
        };

        setA(mapped);
        setCoachId((d.coach_id as string) || null);
        setLoadingAthlete(false);
      });
  }, [id]);

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const isDetailed = mode === "detailed";

  const [isFavorited, setIsFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);

  useEffect(() => {
    const checkFav = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("recruiter_favorites").select("id").eq("recruiter_id", session.user.id).eq("athlete_id", id).maybeSingle();
      setIsFavorited(!!data);
    };
    checkFav();
  }, [id]);

  useEffect(() => {
    const loadPipeline = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: pipelineData } = await supabase
        .from("recruiter_pipeline")
        .select("stage")
        .eq("recruiter_id", session.user.id)
        .eq("athlete_id", id)
        .maybeSingle();
      console.log('My pipeline status:', pipelineData);
      setMyPipelineStage(pipelineData?.stage || null);
    };
    loadPipeline();
  }, [id]);

  // Record profile view (fire and forget)
  useEffect(() => {
    const recordView = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Legacy view tracking
      supabase.from("recruiter_athlete_views").upsert(
        { recruiter_id: user.id, athlete_id: id, viewed_at: new Date().toISOString() },
        { onConflict: "recruiter_id,athlete_id,view_date" }
      );
      // New profile_views table (dedup handled by unique index)
      supabase.from("profile_views").insert({
        athlete_id: id,
        recruiter_id: user.id,
      });
    };
    recordView();
  }, [id]);

  // Load coach reputation
  useEffect(() => {
    if (!coachId) return;
    const loadReputation = async () => {
      const supabase = createClient();

      // Check if current user has All Star access (is_school_admin as proxy)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userRow } = await supabase.from("users").select("is_school_admin").eq("id", user.id).single();
        setIsAllStar(userRow?.is_school_admin === true);
      }

      const { data: reviews } = await supabase
        .from("coach_reviews")
        .select("note_globale, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, recommande")
        .eq("coach_id", coachId);

      const reviewCount = reviews?.length || 0;
      console.log("[Coach reputation]", { coachId, reviewCount, isAllStar });
      if (reviewCount === 0) { setCoachRepData(null); return; }

      const avg = (field: string) => reviews!.reduce((s, r) => s + Number((r as Record<string, unknown>)[field] || 0), 0) / reviewCount;
      setCoachRepData({
        reviewCount,
        avgRating: avg("note_globale"),
        avgQualite: avg("qualite_profils"),
        avgReactivite: avg("reactivite"),
        avgHonnetete: avg("honnetete_evaluations"),
        avgPro: avg("professionnalisme"),
        recommandePct: Math.round((reviews!.filter((r) => r.recommande).length / reviewCount) * 100),
      });
    };
    loadReputation();
  }, [coachId]);

  useEffect(() => {
    const loadCounts = async () => {
      const supabase = createClient();
      const [favRes, viewRes1, viewRes2] = await Promise.all([
        supabase.from("recruiter_favorites").select("*", { count: "exact", head: true }).eq("athlete_id", id),
        supabase.from("recruiter_athlete_views").select("*", { count: "exact", head: true }).eq("athlete_id", id),
        supabase.from("profile_views").select("*", { count: "exact", head: true }).eq("athlete_id", id),
      ]);
      setFavCount(favRes.count ?? 0);
      setViewCount((viewRes1.count ?? 0) + (viewRes2.count ?? 0));
    };
    loadCounts();
  }, [id, isFavorited]);

  useEffect(() => { setA(prev => ({ ...prev, favoriteCount: favCount })); }, [favCount]);

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

  // Trait average — only average non-zero (rated) traits
  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const ratedTraits = traitEntries.filter(([, v]) => v > 0);
  const traitAvg = ratedTraits.length > 0 ? ratedTraits.reduce((s, [, v]) => s + v, 0) / ratedTraits.length : null;

  // Cote Globale — auto-avg from 8 traits if available, else overallRating
  const coteGlobale = traitAvg ?? a.overallRating;

  // Stat strip cells — same in both modes: height + weight + distinctions
  const statCells: { top: string; mid: string; sub?: string; iconName?: string }[] = [
    { top: a.heightDisplay || "—", mid: "Taille" },
    { top: a.weightDisplay || "—", mid: "Poids" },
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
      {/* ── Top bar (hidden in preview) ──────────────────────── */}
      {!isPreview && (
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
              onClick={async () => {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;
                const userId = session.user.id;

                // Check if already favorited
                const { data: existing } = await supabase
                  .from("recruiter_favorites")
                  .select("id")
                  .eq("recruiter_id", userId)
                  .eq("athlete_id", id)
                  .maybeSingle();

                if (existing) {
                  // Already favorited → unfavorite (DELETE)
                  await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
                  setIsFavorited(false);
                  console.log("Unfavorited:", id);
                } else {
                  // Not favorited → favorite (INSERT)
                  await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id });
                  setIsFavorited(true);
                  console.log("Favorited:", id);
                  // Auto-insert into pipeline at IDENTIFIE (no-op if already exists)
                  const { data: existingPipeline } = await supabase
                    .from("recruiter_pipeline")
                    .select("id")
                    .eq("recruiter_id", userId)
                    .eq("athlete_id", id)
                    .maybeSingle();
                  if (!existingPipeline) {
                    const { error: pipeErr } = await supabase
                      .from("recruiter_pipeline")
                      .insert({ recruiter_id: userId, athlete_id: id, stage: "IDENTIFIE", moved_at: new Date().toISOString() });
                    console.log("[Pipeline auto-insert]", { athlete_id: id, stage: "IDENTIFIE", error: pipeErr });
                  }
                }
              }}
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
      )}

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
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
          <div className="shrink-0 flex justify-center lg:justify-start">
            <PlayerCard a={a} />
          </div>

          <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
            <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
              {a.firstName}<br />{a.lastName}
              {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
            </h1>

            {/* Engagement metrics + status boxes */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className="text-[16px] font-bold text-white">{viewCount}</span>
                <span className="text-[11px] text-[#6b7280]">vues</span>
              </div>
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>
                <span className="text-[16px] font-bold text-white">{favCount}</span>
                <span className="text-[11px] text-[#6b7280]">favoris</span>
              </div>
              {!isPreview && (
                <div className="bg-[#111317] rounded-lg px-4 py-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Mon statut</span>
                  {myPipelineStage ? (
                    <span className="text-[12px] font-bold text-white uppercase tracking-wider">
                      {({
                        IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
                        VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée",
                      } as Record<string, string>)[myPipelineStage.toUpperCase()] || myPipelineStage.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#6b7280]">Pas dans le pipeline</span>
                  )}
                </div>
              )}
              <div className="bg-[#111317] rounded-lg px-4 py-2">
                <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Statut recrutement</span>
                <RecruitmentStatusBadgeGlobal status={recruitmentStatus as GlobalRecruitmentStatus} committedSchoolName={committedSchoolName} openToOffers={openToOffers} size="sm" />
              </div>

            </div>

            {!isPreview && pipelineStatus !== "none" && (
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

            {/* Profil Athlète */}
            <div>
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-6">Profil athlète</h3>

              <div className="flex items-center gap-12 mb-8">
                {a.heightDisplay && (
                  <div className="text-center">
                    <p className="text-[40px] font-head font-[800] text-white leading-none">{a.heightDisplay}</p>
                    <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Taille</p>
                  </div>
                )}
                {a.heightDisplay && a.weightDisplay && (
                  <div className="w-px h-12 bg-[#555]" />
                )}
                {a.weightDisplay && (
                  <div className="text-center">
                    <p className="text-[40px] font-head font-[800] text-white leading-none">
                      {a.weightDisplay.replace(" lbs", "")}<span className="text-[20px] font-semibold text-[#555]"> lbs</span>
                    </p>
                    <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mt-1.5">Poids</p>
                  </div>
                )}
              </div>

              {a.distinctions.length > 0 && (
                <div className="flex items-start gap-9 flex-wrap">
                  {a.distinctions.slice(0, MAX_BADGES).map((d, i) => (
                    <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="lg" />
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ══════════ COACH REPORT (both modes — content varies) ══════════ */}
        {(a.coachReport || coteGlobale >= 0) && (
          <section>
            <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
            <div className={`relative ${cardBase} p-6 sm:p-8 pl-8 sm:pl-10 overflow-hidden`}>
              {a.coachReport && (
                <>
                  <span className="absolute top-3 left-3 text-[60px] font-serif text-[#E63946]/10 leading-none select-none">&ldquo;</span>
                  <div className="relative">
                    <p className="text-[18px] sm:text-[20px] text-white italic leading-relaxed pl-5" style={{ borderLeft: "3px solid #E63946" }}>
                      &ldquo;{a.coachReport}&rdquo;
                    </p>
                    <p className="text-[14px] font-bold text-[#9CA3AF] mt-4 pl-5">-- {a.coachName}{a.coachSchool ? `, ${a.coachSchool}` : ""}</p>
                  </div>
                </>
              )}
              <div className={a.coachReport ? "mt-3" : ""}>

                {/* Simplified: single Cote Globale score + stars */}
                {!isDetailed && (
                  <div className="mt-3 pl-5 flex items-center gap-3">
                    <StarRating rating={coteGlobale} size="md" showNumber={false} />
                    <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                    <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                  </div>
                )}

                {/* Detailed: Cote Globale + full 8-trait grid + distinctions */}
                {isDetailed && (
                  <div className="mt-5 pl-5">
                    <div className="flex items-center gap-3 mb-4">
                      <StarRating rating={coteGlobale} size="md" showNumber={false} />
                      <span className="text-[18px] font-head font-black text-white">{coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                      <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote Globale</span>
                    </div>

                    {a.traitRatings && (
                      <div className="border-t border-[#2D3748]/50 pt-4">
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Détail par trait</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {TRAIT_LIST.map((trait) => {
                            const val = a.traitRatings ? a.traitRatings[trait.key] : 0;
                            return (
                              <div key={trait.key} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                                <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                                {val > 0 ? <StarRating rating={val} size="sm" /> : <span className="text-[13px] text-[#4a4d56]">—</span>}
                              </div>
                            );
                          })}
                        </div>
                        {traitAvg !== null && (
                          <div className="mt-4 pt-4 border-t border-[#2D3748]/50 flex items-center justify-between">
                            <span className="text-[13px] font-bold text-[#9CA3AF] uppercase tracking-wider">Moyenne des traits</span>
                            <div className="flex items-center gap-2">
                              <StarRating rating={traitAvg} size="md" />
                              <span className="text-[16px] font-head font-black text-white">{traitAvg.toFixed(1)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {a.distinctions.length > 0 && (
                      <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">Distinctions</p>
                        <div className="flex flex-wrap gap-3">
                          {a.distinctions.slice(0, MAX_BADGES).map((d, i) => (
                            <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} size="sm" />
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

        {/* ══════════ FAITS SAILLANTS (VIDEO) ══════════ */}
        <section>
          <h2 className={sectionLabel}>Faits saillants</h2>
          {a.highlightVideoUrl || a.fullGameUrl ? (
            <div className="flex flex-col gap-4">
              {a.highlightVideoUrl && (
                <VideoEmbed url={a.highlightVideoUrl} title="Faits saillants" />
              )}
              {a.fullGameUrl && (
                <div>
                  <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#555] mb-3">Match complet</p>
                  <VideoEmbed url={a.fullGameUrl} title="Match complet" />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#555]">Aucune vidéo ajoutée</p>
          )}
        </section>

        {/* ══════════ ACADEMIC PROFILE (both modes) ══════════ */}
        <section>
          <h2 className={sectionLabel}>Profil académique</h2>
          <div className={`${cardBase} overflow-hidden`}>
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#2D3748]/50">
              <div className="p-5 text-center">
                <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Moyenne générale</p>
              </div>
              <div className="p-5 text-center">
                {(() => {
                  let display = "—";
                  if (a.program && typeof a.program === "string" && a.program.length > 0) {
                    display = a.program;
                  } else {
                    let arr = a.targetCegepProgram;
                    if (typeof arr === "string") { try { arr = JSON.parse(arr as unknown as string); } catch { arr = []; } }
                    if (Array.isArray(arr) && arr.length > 0) display = arr.join(", ");
                  }
                  return <p className="text-[18px] font-bold text-white leading-none mt-1">{display}</p>;
                })()}
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Programme visé</p>
              </div>
              <div className="p-5 text-center">
                <p className="text-[18px] font-bold text-white leading-none mt-1">Juin {a.graduationYear}</p>
                <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-2">Graduation</p>
              </div>
            </div>
            <div className="border-t border-[#2D3748]/50 px-5 py-3.5 flex flex-wrap gap-2">
              <PreferencePill active={a.openToRelocate} label="Ouvert à déménager" />
              <PreferencePill active={a.openToPrivate} label="Ouvert au privé" />
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
            {(a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Détails académiques</h2>
                <div className={`${cardBase} p-5 space-y-4`}>
                  {(() => {
                    let prog = a.targetCegepProgram;
                    if (typeof prog === "string") { try { prog = JSON.parse(prog as unknown as string); } catch { prog = []; } }
                    if (Array.isArray(prog) && prog.length > 0) {
                      return (
                        <div>
                          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Programme CÉGEP visé</p>
                          <div className="flex flex-wrap gap-2">
                            {prog.map((p: string) => (
                              <span key={p} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{p}</span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {a.strongSubjects?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Matières fortes</p>
                      <div className="flex flex-wrap gap-2">
                        {a.strongSubjects.map((s) => (
                          <span key={s} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-white/5 text-white border border-[#2D3748]">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.academicHonors?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Mentions académiques</p>
                      <div className="flex flex-wrap gap-2">
                        {a.academicHonors.map((h) => (
                          <span key={h} className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {a.preferredRegions?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Régions CÉGEP préférées</p>
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
            {a.coachName && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Réputation du coach</h2>
                <div className={`${cardBase} p-5`}>
                  <p className="text-[14px] font-bold text-[#9CA3AF] mb-3">{a.coachName}</p>
                  {coachRepData && coachRepData.reviewCount > 0 ? (
                    <div className="space-y-4">
                      {/* Overall rating — always visible */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <StarRating rating={coachRepData.avgRating} size="md" showNumber={false} />
                        <span className="text-[18px] font-head font-black text-white">{coachRepData.avgRating.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span></span>
                        <span className="text-[12px] text-[#6B7280]">({coachRepData.reviewCount} avis)</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/20">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                          <span className="text-[11px] font-bold text-[#22C55E]">{coachRepData.recommandePct}% recommandé</span>
                        </span>
                      </div>
                      {/* Per-criteria bars — gated behind All Star */}
                      {isAllStar ? (
                        <div className="space-y-2.5 border-t border-[#2D3748]/50 pt-4">
                          {[
                            { label: "Qualité des profils", value: coachRepData.avgQualite },
                            { label: "Réactivité", value: coachRepData.avgReactivite },
                            { label: "Honnêteté évaluations", value: coachRepData.avgHonnetete },
                            { label: "Professionnalisme", value: coachRepData.avgPro },
                          ].map((c) => (
                            <div key={c.label} className="flex items-center gap-3">
                              <span className="text-[12px] text-[#9CA3AF] w-[170px] shrink-0">{c.label}</span>
                              <div className="flex-1 h-2.5 rounded-full bg-[#2A2D35] overflow-hidden">
                                <div className="h-full rounded-full bg-[#E63946] transition-all" style={{ width: `${(c.value / 5) * 100}%` }} />
                              </div>
                              <span className="text-[13px] font-bold text-white w-[30px] text-right">{c.value.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="relative border-t border-[#2D3748]/50 pt-4">
                          {/* Blurred preview */}
                          <div className="space-y-2.5 blur-sm select-none pointer-events-none" aria-hidden>
                            {["Qualité des profils", "Réactivité", "Honnêteté évaluations", "Professionnalisme"].map((label) => (
                              <div key={label} className="flex items-center gap-3">
                                <span className="text-[12px] text-[#9CA3AF] w-[170px] shrink-0">{label}</span>
                                <div className="flex-1 h-2.5 rounded-full bg-[#2A2D35] overflow-hidden">
                                  <div className="h-full rounded-full bg-[#E63946]" style={{ width: "60%" }} />
                                </div>
                                <span className="text-[13px] font-bold text-white w-[30px] text-right">3.0</span>
                              </div>
                            ))}
                          </div>
                          {/* Lock overlay */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1A1D24]/80 rounded-lg">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            <p className="text-[12px] font-bold text-[#F59E0B] text-center px-4">Passe à All Star pour voir la réputation détaillée des coaches</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#4a4d56] italic">
                      Aucune évaluation reçue pour le moment.
                    </p>
                  )}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* ══════════ STICKY CTA BAR (hidden in preview) ══════════ */}
      {!isPreview && (
      <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-6 md:left-auto md:right-6 md:w-auto">
        {/* Mobile — full-width bar */}
        <div className="md:hidden bg-[#111317]/95 backdrop-blur-sm border-t border-[#2D3748] px-4 py-3 flex items-center gap-2">
          <Link href={`/recruteur/messages/nouveau?athlete=${a.id}`}
            className="flex-1 flex items-center justify-center gap-2.5 bg-[#E63946] text-white rounded-xl px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all hover:bg-[#D42B22] active:scale-[0.98] shadow-[0_0_20px_rgba(230,57,70,0.3)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
            Contacter le coach
          </Link>
          <button type="button" onClick={async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const userId = session.user.id;
            const { data: existing } = await supabase.from("recruiter_favorites").select("id").eq("recruiter_id", userId).eq("athlete_id", id).maybeSingle();
            if (existing) { await supabase.from("recruiter_favorites").delete().eq("id", existing.id); setIsFavorited(false); }
            else { await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id }); setIsFavorited(true); }
          }} title={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${isFavorited ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#1A1D24] border-[#2D3748]"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? "#E63946" : "none"} stroke={isFavorited ? "#E63946" : "#6B7280"} strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
          <button type="button" onClick={() => { if (!flagSubmitted) setShowFlagModal(true); }}
            title={flagSubmitted ? "Signalé" : "Signaler"}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${flagSubmitted ? "bg-[#F59E0B]/10 border-[#F59E0B]/30" : "bg-[#1A1D24] border-[#2D3748]"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={flagSubmitted ? "#F59E0B" : "none"} stroke={flagSubmitted ? "#F59E0B" : "#6B7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
        </div>
        {/* Desktop — floating pill */}
        <div className="hidden md:flex items-center gap-2">
          <Link href={`/recruteur/messages/nouveau?athlete=${a.id}`}
            className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-xl px-8 py-4 font-head font-bold text-[14px] uppercase tracking-widest justify-center transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(230,57,70,0.4)] active:scale-[0.98] shadow-[0_4px_20px_rgba(230,57,70,0.3)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
            </svg>
            Contacter le coach
          </Link>
          <button type="button" onClick={async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const userId = session.user.id;
            const { data: existing } = await supabase.from("recruiter_favorites").select("id").eq("recruiter_id", userId).eq("athlete_id", id).maybeSingle();
            if (existing) { await supabase.from("recruiter_favorites").delete().eq("id", existing.id); setIsFavorited(false); }
            else { await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id }); setIsFavorited(true); }
          }} className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all hover:-translate-y-0.5 ${isFavorited ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#1A1D24] border-[#2D3748] hover:border-[#E63946]/30"}`}
            title={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? "#E63946" : "none"} stroke={isFavorited ? "#E63946" : "#6B7280"} strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          </button>
          <button type="button" onClick={() => { if (!flagSubmitted) setShowFlagModal(true); }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all hover:-translate-y-0.5 ${flagSubmitted ? "bg-[#F59E0B]/10 border-[#F59E0B]/30" : "bg-[#1A1D24] border-[#2D3748] hover:border-[#F59E0B]/30"}`}
            title={flagSubmitted ? "Signalé" : "Signaler"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={flagSubmitted ? "#F59E0B" : "none"} stroke={flagSubmitted ? "#F59E0B" : "#6B7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
        </div>
      </div>
      )}

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
