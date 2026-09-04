"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchRecruiterAthleteCards, displayFullName, LOCKED_NAME_LABEL, type RecruiterAthleteCard } from "@/lib/queries/shared/recruiterAthleteCards";
import { findOrCreateRecruiterAthleteConversation, findOrCreateRecruiterConversation } from "@/lib/utils/findOrCreateRecruiterConversation";
import {
  mockAthleteProfileFull,
} from "@/lib/mock/athleteProfileRecruiter";
import type { AthleteProfileRecruiterView, AthleteTraitRatings, GlobalRecruitmentStatus } from "@/lib/types/models";
import { BADGE_COLORS } from "@/lib/types/models";
import RecruitmentStatusBadgeGlobal from "@/components/ui/RecruitmentStatusBadge";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { badgesDepuisRaw } from "@/lib/queries/shared/athleteBadges";
import { MAX_BADGES_AFFICHES } from "@/lib/config/badgeCatalogue";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import type { RecruitmentStatus, RetireReason } from "@/lib/config/recruitmentStatuses";
import { getAthleteTracking } from "@/app/recruteur/_data/mockPipelineData";
import RecruitmentStatusBadge from "@/app/recruteur/_components/RecruitmentStatusBadge";
import StatusChangeDropdown from "@/app/recruteur/_components/StatusChangeDropdown";
import VisitCalendarCard from "@/components/shared/VisitCalendarCard";
import { persistPipelineStage } from "@/lib/pipeline/persistPipelineStage";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useFavoritesCount } from "@/lib/hooks/useFavoritesCount";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { traitGroups, resolvePositionId, type GrilleRef } from "@/lib/evaluations/grilles";
import { useGrilles } from "@/lib/evaluations/useGrilles";
import CelebrationToast from "@/app/recruteur/_components/CelebrationToast";
import UpgradeModal from "@/components/ui/UpgradeModal";
import SuccessToast, { type SuccessToastData } from "@/components/ui/SuccessToast";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";
import VideoEmbed from "@/components/ui/VideoEmbed";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { TeamDetailsBlock, type TeamDetail } from "@/components/shared/athlete/TeamDetailsBlock";
import TeamHistoryBlock from "@/components/shared/athlete/TeamHistoryBlock";
import { parseTeamHistory } from "@/components/shared/athlete/teamHistory";
import { useAthleteContactable, blackoutSortie, blackoutSortieCourt } from "@/lib/queries/recruiter/useAthleteContactable";
import { DemoRibbonIf } from "@/components/shared/DemoRibbon";
import { isShowcaseAthlete } from "@/lib/showcase";
import { resolveProgrammesVisesAsync } from "@/lib/queries/shared/useCegepPrograms";

/* ═══════════════════════════════════════════════════════════════
   AthleteRecruiterProfileBody — shared across recruiter, athlete-
   side preview, and partner-portal renderings of an athlete
   profile. The page wrappers parse URL params and pass:

     viewerMode = "recruiter"  full UI (recruiter logged in)
     viewerMode = "preview"    athlete previewing how recruiters
                               see them; recruiter-specific
                               actions hidden but content
                               otherwise identical
     viewerMode = "partner"    Nexus media partner; recruiter-
                               specific actions hidden, academic
                               sections swapped for locked
                               placeholders, coach reputation
                               hidden, recordView write skipped
                               (so partner sessions don't
                               pollute recruiter_athlete_views)

   Uses AthleteProfileRecruiterView (privacy-safe, no email/phone).
═══════════════════════════════════════════════════════════════ */

export type AthleteProfileViewerMode = "recruiter" | "preview" | "partner";

interface AthleteRecruiterProfileBodyProps {
  athleteId: string;
  viewerMode: AthleteProfileViewerMode;
}

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-4";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border";
const cardBase = "bg-[#1A1D24] rounded-xl border border-[#2D3748]";

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display])
);

/* TRAIT_LIST retiré : les 14 libellés et leur groupement viennent de
   lib/evaluations/grilles.ts (traitGroups). */

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

function PlayerCard({ a, isFree }: { a: AthleteProfileRecruiterView; isFree: boolean }) {
  // `isFree` reste pour les sections GATÉES PAR TIER (contenu premium).
  // L'identité, elle, ne se décide plus ici : elle vient du serveur.
  const locked = a.identityVisible === false;
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
          <AthletePhotoFill
            photoUrl={a.photoUrl}
            firstName={a.firstName}
            lastName={a.lastName}
            identityVisible={a.identityVisible}
            className="object-[center_15%]"
          />
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          {/* Le masquage n'est plus un flou CSS sur un nom présent dans le
              DOM : sous identité réservée le serveur n'envoie rien, et on
              affiche le libellé partagé. Le flou restait contournable au
              devtools et ne couvrait que le tier FREE, pas la Loi 25. */}
          <div className="absolute bottom-4 left-4 z-[3]">
            {locked ? (
              <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 22, fontWeight: 900, color: '#9CA3AF', letterSpacing: '0.04em', lineHeight: 1.1, textTransform: 'uppercase' }}>{LOCKED_NAME_LABEL}</p>
            ) : (
              <>
                <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{a.firstName}</p>
                <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{a.lastName}</p>
              </>
            )}
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
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{a.isCivil
                ? (a.teamName || a.leagueName || "")
                : (a.schoolName || "").replace(/^École secondaire /i, "É.S. ").replace(/^École sec\. /i, "É.S. ")}</div>
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

/* Free-tier content lock — replaces a gated section body with a
   dashed-border placeholder. Reused for videos / academic / coach
   report on the recruiter profile. */
function FreeLock() {
  return (
    <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">Passe à Pro pour voir</p>
      <p className="text-[13px] text-[#6B7280] max-w-md">Cette section est réservée aux recruteurs Pro.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

/** Les 30 colonnes de public.partner_athlete_profile, telles que la RPC les
 *  RETOURNE (verifie contre son RETURNS TABLE). Toute colonne absente d'ici
 *  n'existe pas cote partenaire — et c'est le seul endroit ou le verifier. */
type PartnerRpcRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  bio: string | null;
  sport_nom: string | null;
  position_nom: string | null;
  position_abbr: string | null;
  school_name: string | null;
  school_region: string | null;
  school_city: string | null;
  school_type: string | null;
  is_civil: boolean | null;
  team_name: string | null;
  league_name: string | null;
  distinctions: unknown;
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;
  /** Les badges VIVANTS, deja tries (honneur > universel > sport, puis
   *  `ordre`) et deja filtres sur `retire_le is null` par la RPC. Forme
   *  projetee : {code, libelle, famille, contexte, attribue_le}. */
  badges: PartnerRpcBadge[] | null;
};

/** Un element du jsonb `badges` de partner_athlete_profile. Le RETURNS TABLE
 *  le declare `jsonb` ; cette forme est celle que la fonction CONSTRUIT
 *  (jsonb_build_object, cinq cles nommees). */
type PartnerRpcBadge = {
  code: string;
  libelle: string;
  famille: string | null;
  contexte: string | null;
  attribue_le: string | null;
};

/**
 * FORME EXIGEE PAR LE MAPPING EN AVAL — tous les champs que `load()` lit sur
 * `d`, sans exception. Le type existe pour UNE raison : rendre impossible la
 * panne du 19 aout 2026.
 *
 * Ce jour-la, adaptPartnerRow a remplace la requete directe sans reporter
 * `school_id`. Le mapping teste `!d.school_id` pour decider « civil » ; sur
 * `undefined` le test est VRAI, et les 47 fiches du portail partenaire ont
 * bascule en « Ligue civile » — dont 34 athletes scolaires, nom d'ecole vide.
 * Douze jours sans que rien ne le signale : sur un `Record<string, unknown>`,
 * un champ MANQUANT est indiscernable d'un champ NULL.
 *
 * Chaque champ est donc REQUIS. Une omission ne compile plus. Les absences
 * VOULUES sont ecrites `null` explicitement — une decision qu'on lit, plus un
 * oubli qu'on devine. Si le mapping se met a lire un champ de plus, l'ajouter
 * ici est le premier geste, et le compilateur le rappelle.
 */
type PartnerAdaptedRow = {
  /* ── Identite et gabarit — projetes par la RPC ─────────────────────── */
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  numero_jersey: string | null;
  age: number | null;
  genre: string | null;
  annee_diplomation: number | null;
  verified: boolean | null;
  last_profile_validation: string | null;
  cote_globale_entraineur: number | null;
  taille_pieds: number | null;
  taille_pouces: number | null;
  poids_lbs: number | null;
  sports: { nom: string | null } | null;
  positions: { nom: string | null; abreviation: string | null } | null;
  schools: { name: string | null; region: string | null; city: string | null; type: string | null } | null;
  evaluations: { distinctions: unknown }[] | null;

  /* ── Badges — VOIE 2, reconstituee ─────────────────────────────────────
     `badgesDepuisRaw` lit `raw.athlete_badges` dans la forme de l'EMBED
     PostgREST. La RPC projette la meme information sous un autre nom et une
     autre forme ; l'adaptateur la RENDONNE ici, fidele a sa vocation. Sans
     ce champ, `d.athlete_badges` etait `undefined` et le partenaire voyait
     zero badge sur une fiche qui en porte trois — alors que la RPC les
     livrait deja dans la meme reponse. */
  athlete_badges: {
    contexte: string | null;
    created_at: string | null;
    retire_le: null;
    badges: { code: string; libelle: string };
  }[];

  /* ── Le contexte, DECIDE PAR LE SERVEUR ────────────────────────────────
     `is_civil` est la reponse de la RPC — (school_id IS NULL OR type =
     'LIGUE_CIVILE') — calculee la ou `school_id` existe vraiment. Le front la
     PREFERE a sa propre regle plutot que de la recalculer sur des champs qu'il
     n'a pas. `school_id` reste `null` : le partenaire n'a aucun besoin de
     l'identifiant, seulement du verdict. */
  is_civil: boolean | null;
  school_id: null;
  team_name: string | null;
  league_name: string | null;

  /* ── Medias projetes ───────────────────────────────────────────────── */
  video_faits_saillants_url: string | null;
  hudl_url: string | null;
  youtube_url: string | null;

  /* ── ABSENCES VOULUES ──────────────────────────────────────────────────
     Loi 25 et perimetre partenaire. `date_naissance` en particulier ne
     franchit JAMAIS la frontiere : c'est elle qui decide du masquage, et l'age
     arrive deja derive du serveur. */
  date_naissance: null;
  user_id: null;
  coach_id: null;
  users: null;

  /* Bloc academique — remplace a l'ecran par un substitut assume
     (« Reserve aux recruteurs et coaches »), pas par du vide. */
  moyenne_generale: null;
  mentions_academiques: null;
  matieres_fortes: null;
  programme_cegep_vise: null;
  regions_cegep_preferees: null;
  ouvert_cegep_prive: null;
  ouvert_cegep_anglophone: null;
  pret_changer_region: null;

  /* Parcours d'equipes, engagement, grille — gardes par `!isPartner`, ou
     resolus autrement (position_id : lib/evaluations/grilles.ts resout la
     grille client-side, sans cette colonne — c'est documente la-bas). */
  parcours_equipes: null;
  team_athletes: null;
  committed_school: null;
  position_id: null;

  /* ── ABSENCES SUBIES — non projetees par la RPC ────────────────────────
     Elles ne mentent plus a l'ecran : les deux surfaces qui les affichaient
     avec un defaut FAUX (statut de recrutement fige a « OUVERT », completude
     figee a 0 %) sont desormais masquees pour le partenaire. Les mesures,
     tests et medias secondaires se masquaient deja seuls quand ils sont vides
     — une absence, jamais une affirmation fausse. Les rouvrir suppose de les
     AJOUTER a la RPC, pas de les deviner ici. */
  profile_completion: null;
  recruitment_status: null;
  statut_recrutement_override: null;
  open_to_offers: null;
  envergure: null;
  taille_mains: null;
  main_dominante: null;
  pied_dominant: null;
  test_40_verges: null;
  saut_vertical: null;
  saut_longueur: null;
  navette_agilite: null;
  sprint_100m: null;
  developpe_couche: null;
  video_match_complet_url: null;
  video_entrainement_url: null;
  instagram_url: null;
};

/**
 * Redonne a une ligne de public.partner_athlete_profile la FORME que produisait
 * la requete directe sur `athletes`, pour que le mapping en aval soit inchange.
 *
 * Le type de retour EST le contrat : voir PartnerAdaptedRow ci-dessus. Ce qui
 * vaut `null` l'est par decision, et le compilateur refuse desormais qu'un
 * champ disparaisse en silence.
 *
 * L'ecran partenaire est force en mode « simple » et masque deja le bloc
 * academique et le nom de l'entraineur. `age` est fourni DERIVE —
 * date_naissance ne franchit jamais la frontiere.
 */
function adaptPartnerRow(r: PartnerRpcRow): PartnerAdaptedRow {
  return {
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    photo_url: r.photo_url,
    numero_jersey: r.numero_jersey,
    // Age DERIVE cote serveur — pas de date_naissance a reconstituer.
    age: r.age,
    genre: r.genre,
    annee_diplomation: r.annee_diplomation,
    verified: r.verified,
    last_profile_validation: r.last_profile_validation,
    cote_globale_entraineur: r.cote_globale,
    taille_pieds: r.taille_pieds,
    taille_pouces: r.taille_pouces,
    poids_lbs: r.poids_lbs,
    sports: r.sport_nom ? { nom: r.sport_nom } : null,
    positions: r.position_nom ? { nom: r.position_nom, abreviation: r.position_abbr } : null,
    schools: r.school_name
      ? { name: r.school_name, region: r.school_region, city: r.school_city, type: r.school_type }
      : null,
    /* Seule `distinctions` remonte. selectBestEvaluation recoit donc un tableau
       d'un element sans notes de traits ni rapport — ce qui est exactement
       l'intention. */
    evaluations: r.distinctions ? [{ distinctions: r.distinctions }] : null,

    /* VOIE 2 — on redonne aux badges la forme de l'embed `athlete_badges`,
       la seule que `badgesDepuisRaw` sache lire. La correspondance est
       terme a terme et documentee dans athleteBadges.ts :
         contexte    <- ab.contexte
         created_at  <- ab.created_at, projete sous le nom `attribue_le`
         retire_le   <- toujours null : la RPC filtre `retire_le is null`,
                        elle ne rend QUE des badges vivants. Le `null` n'est
                        donc pas une supposition, c'est le contrat d'amont.
       L'ordre du serveur (honneur > universel > sport, puis `ordre`) est
       conserve : `.map` ne reordonne rien, donc MAX_BADGES_AFFICHES tronque
       les MOINS importants. L'embed recruteur, lui, n'a PAS de ORDER BY —
       le partenaire est ici mieux servi, pas moins. */
    athlete_badges: (Array.isArray(r.badges) ? r.badges : []).map((b) => ({
      contexte: b.contexte ?? null,
      created_at: b.attribue_le ?? null,
      retire_le: null as null,
      badges: { code: b.code, libelle: b.libelle },
    })),

    /* Le verdict du serveur, transmis tel quel — plus aucun recalcul. */
    is_civil: r.is_civil,
    school_id: null,
    team_name: r.team_name,
    league_name: r.league_name,

    video_faits_saillants_url: r.video_faits_saillants_url,
    hudl_url: r.hudl_url,
    youtube_url: r.youtube_url,

    /* Absences voulues — Loi 25 et perimetre partenaire. */
    date_naissance: null,
    user_id: null,
    coach_id: null,
    users: null,
    moyenne_generale: null,
    mentions_academiques: null,
    matieres_fortes: null,
    programme_cegep_vise: null,
    regions_cegep_preferees: null,
    ouvert_cegep_prive: null,
    ouvert_cegep_anglophone: null,
    pret_changer_region: null,
    parcours_equipes: null,
    team_athletes: null,
    committed_school: null,
    position_id: null,

    /* Absences subies — non projetees par la RPC. */
    profile_completion: null,
    recruitment_status: null,
    statut_recrutement_override: null,
    open_to_offers: null,
    envergure: null,
    taille_mains: null,
    main_dominante: null,
    pied_dominant: null,
    test_40_verges: null,
    saut_vertical: null,
    saut_longueur: null,
    navette_agilite: null,
    sprint_100m: null,
    developpe_couche: null,
    video_match_complet_url: null,
    video_entrainement_url: null,
    instagram_url: null,
  };
}

export default function AthleteRecruiterProfileBody({ athleteId, viewerMode }: AthleteRecruiterProfileBodyProps) {
  const id = athleteId;
  // Both "preview" and "partner" are non-recruiter viewers; the
  // existing isPreview gates already hide everything that's
  // recruiter-specific, so we keep the variable name and just
  // broaden its meaning.
  const isPreview = viewerMode !== "recruiter";
  const isPartner = viewerMode === "partner";
  const router = useRouter();
  const { maxFavorites, tier, loading: tierLoading } = useSubscription();
  const canMessageCoach = tier === "pro" || tier === "all_star";
  const canUsePipeline = tier === "pro" || tier === "all_star";
  // Free recruiters only — excludes preview (athlete self-view) and
  // partner (own gating). Drives the name strip + content locks.
  const isFreeRecruiter = viewerMode === "recruiter" && tier === "free";
  /* VITRINE — aucun verrou d'AFFICHAGE sur le profil demo.

     `lockContent` remplace `isFreeRecruiter` sur tout ce qui masque une
     DONNEE DE L'ATHLETE : identite, rapport d'entraineur, faits saillants,
     profil academique.

     Ce qui NE cede PAS, et volontairement : le contact (contactLocked /
     canMessageCoach) et le pipeline (canUsePipeline). Ces deux-la ne
     masquent aucune donnee de l'athlete — ce sont des FONCTIONS payantes
     du recruteur. Les ouvrir sur la vitrine donnerait un pipeline et une
     messagerie gratuits, pas une demonstration.

     Sur l'identite (nom, photo, dossard), ce changement est NECESSAIRE mais
     INERTE tant que la migration is_showcase n'est pas appliquee : le
     serveur renvoie first_name/photo_url a NULL, il n'y a rien a afficher.
     Il devient actif des que la RPC projette l'identite. */
  const isShowcase = isShowcaseAthlete(id);
  const lockContent = isFreeRecruiter && !isShowcase;
  const { count: myFavCount, setCount: setMyFavCount } = useFavoritesCount();
  // #52 — init à null (plus de mock comme valeur initiale) : aucun faux
  // athlète n'est rendu avant l'arrivée des vraies données. Le gate
  // loadingAthlete plus bas court-circuite le rendu tant que a est null.
  const [a, setA] = useState<AthleteProfileRecruiterView | null>(null);
  const [loadingAthlete, setLoadingAthlete] = useState(true);
  /* Règle de lecture des grilles : grille_id de l'éval affichée d'abord, sinon
     la position. Le partenaire n'a NI l'un NI l'autre — partner_athlete_profile
     ne projette ni grille_id ni position_id — d'où sportNom/positionNom, résolus
     par nom AVEC filtre sport (18 abréviations sont partagées entre sports). */
  const grilleSet = useGrilles();
  const [grilleSrc, setGrilleSrc] = useState<{
    grilleId: string | null; positionId: string | null;
    sportNom: string | null; positionNom: string | null;
  }>({ grilleId: null, positionId: null, sportNom: null, positionNom: null });
  /* grille_id > position_id > (sport, position) par nom > GENERIQUE.
     21 des 23 évaluations locales ont grille_id NULL : le repli est le chemin
     NORMAL, pas l'exception. */
  const grilleRef: GrilleRef = {
    grilleId: grilleSrc.grilleId,
    positionId: grilleSrc.positionId
      ?? resolvePositionId(grilleSet, grilleSrc.sportNom, grilleSrc.positionNom),
  };

  const [recruitmentStatus, setRecruitmentStatus] = useState<GlobalRecruitmentStatus>("OUVERT");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [myPipelineStage, setMyPipelineStage] = useState<string | null>(null);
  const [visitAt, setVisitAt] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [isAllStar, setIsAllStar] = useState(false);

  // Civil-context affiliation state. Post-Phase 6.1 unified model :
  // 'school' = athlete anchored to a SECONDAIRE/CEGEP school,
  // 'civil_with_team' = anchored to a LIGUE_CIVILE school AND in
  // team_athletes for at least one team, 'civil_no_team' = anchored
  // to a LIGUE_CIVILE school without a team OR orphan (school_id
  // NULL — "Continuer sans équipe" path). Drives the section-level
  // swap between "École" and "Équipe civile".
  const [affiliation, setAffiliation] = useState<"school" | "civil_with_team" | "civil_no_team">("school");
  const [civilTeamInfo, setCivilTeamInfo] = useState<{
    teamName: string;
    leagueName: string;
    ageGroup: string | null;
    division: string | null;
    coaches: string[];
  } | null>(null);
  // Generalized list of teams for the bottom-of-Sportif TeamDetailsBlock —
  // populated for ALL athletes (école + civil) from the team_athletes →
  // teams join. Replaces the civil-only InfoRows that lived just below
  // the affiliation summary in the "École / Équipe civile" section.
  const [teamDetails, setTeamDetails] = useState<TeamDetail[]>([]);
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
    if (tierLoading) return;
    const supabase = createClient();
    /* Temps 1 — TOUT sauf l'identité.
       first_name, last_name, photo_url, numero_jersey et date_naissance ont
       quitté ce select : ils arrivent du temps 2, par la RPC.

       Ce qui était là avant — `isFreeRecruiter ? "" : "first_name, last_name,"`
       — était un masquage décidé CÔTÉ CLIENT, et il ne couvrait que le nom.
       La photo et le dossard partaient en clair pour tout le monde, et la
       règle Loi 25 (mineur sans consentement parental) n'était appliquée
       nulle part : elle dépend de date_naissance et consentement_parental,
       que le client n'a aucun droit de lire pour en tirer une décision. */
    /* Colonnes d'identite ajoutees au TEMPS 1 quand l'appelant n'est pas
       recruteur : la RPC recruiter_athlete_cards lui est fermee (42501), et
       il n'en a pas besoin — l'athlete lit sa propre ligne, le partenaire lit
       une ligne deja filtree par is_partner_eligible_athlete.

       date_naissance UNIQUEMENT pour l'athlete lui-meme. Un partenaire n'a
       pas a recevoir la date de naissance d'un mineur : la RPC ne la projette
       jamais non plus, elle en derive l'age cote serveur. */
    const identityCols =
      viewerMode === "preview"
        ? "first_name, last_name, photo_url, numero_jersey, date_naissance,"
        : viewerMode === "partner"
        ? "first_name, last_name, photo_url, numero_jersey,"
        : "";

    /* REQUETE DIRECTE — chemin RECRUTEUR et APERCU ATHLETE uniquement.
       Le partenaire ne passe plus par ici depuis le 2026-08-19 (point 5a du
       chantier RLS partenaire) : voir `source` juste apres. */
    const directQuery = supabase
      .from("athletes")
      .select(`
        id,
        user_id,
        ${identityCols}
        verified,
        profile_completion,
        last_profile_validation,
        annee_diplomation,
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
        programme_cegep_vise, programmes_vises,
        athlete_badges(contexte, created_at, retire_le, badges(code, libelle)),
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
        parcours_equipes,
        school_id,
        position_id,
        sports!athletes_sport_id_fkey(nom),
        positions!athletes_position_id_fkey(nom, abreviation),
        schools!school_id(name, region, city, type),
        committed_school:schools!committed_school_id(name),
        team_athletes(
          teams!team_id(
            id, name, league, age_group, division, gender, season, is_active,
            sport_id, sports!sport_id(nom),
            schools!school_id(id, name, type)
          )
        ),
        evaluations(
          vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination,
          vision_du_jeu, sens_tactique,
          leadership, discipline, coachabilite, intelligence_jeu,
          competitivite, esprit_equipe, resilience, attitude_mentalite,
          cote_globale, rapport_entraineur, distinctions, updated_at, grille_id
        ),
        users!athletes_coach_id_fkey(first_name, last_name)
      ` as unknown as "*")
      .eq("id", id)
      .single();

    /* AIGUILLAGE DE SOURCE.

       Pour un PARTENAIRE, la lecture passe par public.partner_athlete_profile :
       28 colonnes, gate interne (is_approved_partner ET
       is_partner_eligible_athlete), et AUCUNE des 11 colonnes interdites. La
       requete directe ci-dessus laissait encore passer moyenne_generale,
       programme_cegep_vise, regions_cegep_preferees, notes_coach et l'embed
       evaluations a 18 colonnes — dont rapport_entraineur, du texte libre ecrit
       par un adulte sur un mineur.

       L'adaptateur redonne a la ligne la FORME que le mapping ci-dessous
       attend. Les champs absents le sont PAR CONSTRUCTION : l'ecran partenaire
       est force en mode « simple » (effectiveMode) et masque deja le bloc
       academique et le nom de l'entraineur. Ce qui n'arrive plus n'etait de
       toute facon pas affiche — mais il arrivait quand meme jusqu'ici. */
    const source: PromiseLike<{ data: unknown; error: unknown }> = isPartner
      ? supabase
          .rpc("partner_athlete_profile", { p_athlete_id: id })
          .maybeSingle()
          .then((r) => ({
            data: r.data ? adaptPartnerRow(r.data as PartnerRpcRow) : null,
            error: r.error,
          }))
      : (directQuery as unknown as PromiseLike<{ data: unknown; error: unknown }>);

    const load = Promise.resolve(source).then(async ({ data, error }) => {
        if (error || !data) { setLoadingAthlete(false); return; }

        const d = data as Record<string, unknown>;

        /* Temps 2 — l'identité, projetée par le serveur.
           `?? null` explicite : la RPC ne rend AUCUNE ligne pour un athlète
           inactif ou supprimé, et un `undefined` interpolé écrirait
           "undefined" à l'écran. Même piège que usePipelineCards:72. */
        /* La RPC est RECRUTEUR-ONLY. L'appeler en preview (athlete) ou en
           partner rendait 42501 ; le helper leve, la chaine n'avait pas de
           catch, et setLoadingAthlete(false) n'etait jamais atteint — page
           bloquee en chargement. Meme garde que le corps mobile (l.950).

           Le try/catch protege AUSSI la fiche recruteur : avant, n'importe
           quel echec de cette RPC gelait la page. Desormais on degrade vers
           l'identite masquee, ce qui est le repli sur : on n'affiche jamais
           une identite qu'on n'a pas pu autoriser. */
        let card: RecruiterAthleteCard | null = null;
        if (viewerMode === "recruiter") {
          try {
            card = (await fetchRecruiterAthleteCards(supabase, [id])).get(id) ?? null;
          } catch (e) {
            console.warn("[recruiter_athlete_cards] echec — identite masquee", e);
            card = null;
          }
        }
        /* Hors recruteur, il n'y a pas de palier a appliquer : l'athlete voit
           son profil tel qu'un abonne le verrait (c'est l'objet de l'apercu),
           et le partenaire retrouve le comportement d'avant 794c6fd. */
        const identityVisible = viewerMode === "recruiter" ? (card?.identity_visible ?? false) : true;

        setAthleteUserId((d.user_id as string | null) ?? null);
        const evals = d.evaluations as Record<string, unknown>[] | null;
        // Pick by rule (détaillée > simple, then most recent updated_at) —
        // NOT evaluations[0] (unordered, often a non-owning coach's row).
        const eval0 = selectBestEvaluation(evals);

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

        setGrilleSrc({
          grilleId:    (eval0?.grille_id as string | null) ?? null,
          positionId:  (d.position_id as string | null) ?? null,
          sportNom:    sport?.nom ?? null,
          positionNom: pos?.nom ?? null,
        });

        // School info
        const schoolRel = Array.isArray(d.schools) ? d.schools[0] : d.schools;
        const school = schoolRel as { name: string; region: string; city: string; type: string } | null;

        /* LE CONTEXTE, DERIVE UNE SEULE FOIS.

           `d.is_civil` est le verdict du SERVEUR (partner_athlete_profile le
           calcule sur le vrai `school_id`). Quand il est la, il gagne.

           Le `??` n'est pas une coquetterie : sur le chemin RECRUTEUR la RPC
           n'existe pas, `d.is_civil` vaut `undefined`, et la regle locale
           s'applique inchangee — elle est alimentee par un `school_id`
           reellement selectionne. Sur le chemin PARTENAIRE, cette meme regle
           lisait `undefined` et rendait TOUT LE MONDE civil (le bug du
           19 aout). On cesse de recalculer ce que le serveur a deja tranche.

           Un `||` serait faux ici : `is_civil = false` est une reponse, pas
           une absence de reponse. */
        const serverCivil = d.is_civil as boolean | null | undefined;
        const civil = serverCivil ?? (!d.school_id || school?.type === "LIGUE_CIVILE");

        // Age from birth date
        /* L'âge vient de la RPC, DÉRIVÉ côté serveur. date_naissance n'est
           jamais projetée à un recruteur — c'est elle qui décide du masquage
           Loi 25, la livrer permettrait de recalculer ce que le masquage
           protège. */
        /* `d.age` : chemin PARTENAIRE, ou l'age arrive deja derive de la RPC.
           Sans cette branche il serait null — `card` n'est peuple que pour un
           recruteur, et date_naissance n'est jamais projetee a un partenaire. */
        const age = card?.age
          ?? (d.age as number | null)
          ?? (d.date_naissance
              ? Math.floor((Date.now() - new Date(d.date_naissance as string).getTime()) / 31_557_600_000)
              : null);

        // Programme CÉGEP
        // T2 — la nouvelle colonne d'abord, l'ancienne en repli jusqu'a T3.
        const progArr = await resolveProgrammesVisesAsync(
          supabase, (d as Record<string, unknown>).programmes_vises, d.programme_cegep_vise);

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
          // Identité : RIEN ne vient plus de `d`. Sous masquage le serveur
          // rend ces quatre champs à NULL, et `?? ""` garde le contrat
          // `string` du type sans jamais produire "null".
          identityVisible,
          firstName: card?.first_name ?? (d.first_name as string) ?? "",
          lastName: card?.last_name ?? (d.last_name as string) ?? "",
          photoUrl: card?.photo_url ?? (d.photo_url as string) ?? "",
          isVerified: d.verified as boolean,
          lastValidation: (d.last_profile_validation as string) || null,
          /* Complétion : valeur SERVEUR, plus de recalcul client.
             calculateCompletion() pondère photo_url, date_naissance (3) et
             numero_jersey (3) — trois colonnes qui ne sont plus dans le
             select. Le recalculer ici sous-estimerait tout profil vu par un
             recruteur, d'un score d'autant plus faux que le profil est
             complet. La RPC porte la valeur calculée sur la ligne entière. */
          profileCompleteness: card?.profile_completion ?? (d.profile_completion as number) ?? 0,
          jerseyNumber: card?.numero_jersey ?? (d.numero_jersey as string) ?? "",
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
          teamHistory: parseTeamHistory(d.parcours_equipes),
          // Phase 1 audit (post-Phase 6.1): schoolName overload split
          // into isCivil / schoolName / teamName / leagueName. Canonical
          // civil rule = no school_id OR school.type === 'LIGUE_CIVILE'.
          isCivil: civil,
          schoolName: civil ? "" : (school?.name || ""),
          teamName: (() => {
            if (!civil) return undefined;
            /* Chemin partenaire : la RPC projette `team_name`. L'adaptateur ne
               fournit pas `team_athletes` — sans cette branche, un athlete
               civil affichait « Equipe civile : — ». */
            const fromRpc = d.team_name as string | null | undefined;
            if (fromRpc) return fromRpc;
            const taRel = d.team_athletes as unknown;
            const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
            const firstTa = taArr[0] as Record<string, unknown> | null;
            const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
            return (teamRel as { name?: string } | null)?.name;
          })(),
          leagueName: (() => {
            if (!civil) return undefined;
            const fromRpcTeam = d.team_name as string | null | undefined;
            if (fromRpcTeam) return undefined;
            const fromRpcLeague = d.league_name as string | null | undefined;
            if (fromRpcLeague) return fromRpcLeague;
            const taRel = d.team_athletes as unknown;
            const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
            const firstTa = taArr[0] as Record<string, unknown> | null;
            const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
            const hasTeam = !!(teamRel as { name?: string } | null)?.name;
            return hasTeam ? undefined : "Ligue Civile";
          })(),
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
          /* VOIE 2 — ce chargeur alimente LES MÊMES points de rendu que
             mapToRecruiterView. Le laisser sur la colonne dérivée faisait
             afficher 3 badges sur 7 selon le chemin emprunté. */
          distinctions: badgesDepuisRaw(d as Record<string, unknown>),
          favoriteCount: 0,
          viewsThisMonth: 0,
        };

        setA(mapped);
        setCoachId((d.coach_id as string) || null);

        // Affiliation discriminator + civil-team info population.
        // Post-Phase 6.1 unified model :
        //   - school_id NULL                              → 'civil_no_team' (orphan)
        //   - school_id NOT NULL, schools.type SECONDAIRE/CEGEP → 'school'
        //   - school_id NOT NULL, schools.type LIGUE_CIVILE     →
        //       'civil_with_team' if there's a team_athletes row,
        //       'civil_no_team'   otherwise
        const schoolId = d.school_id as string | null;
        if (!schoolId) {
          setAffiliation("civil_no_team");
          setCivilTeamInfo(null);
        } else if (school?.type !== "LIGUE_CIVILE") {
          setAffiliation("school");
          setCivilTeamInfo(null);
        } else {
          // Civil athlete (LIGUE_CIVILE school anchor). Pull team
          // membership and coaches from the unified team_athletes /
          // team_coaches tables.
          const taRel = d.team_athletes as unknown;
          const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
          const firstTa = taArr[0] as Record<string, unknown> | null;
          const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
          const lt = teamRel as Record<string, unknown> | null;

          if (!lt) {
            setAffiliation("civil_no_team");
            setCivilTeamInfo(null);
          } else {
            setAffiliation("civil_with_team");
            const teamId = lt.id as string | undefined;
            // Coaches list — query team_coaches → users for this
            // specific team. PostgREST embed doesn't traverse all
            // the way in one shot.
            let coachNames: string[] = [];
            if (teamId) {
              const { data: coachRows } = await supabase
                .from("team_coaches")
                .select("users!coach_id(first_name, last_name)")
                .eq("team_id", teamId);
              coachNames = (coachRows ?? [])
                .map((row) => {
                  const u = (row as Record<string, unknown>).users;
                  const userObj = (Array.isArray(u) ? u[0] : u) as { first_name?: string; last_name?: string } | null;
                  if (!userObj) return "";
                  return `${userObj.first_name ?? ""} ${userObj.last_name ?? ""}`.trim();
                })
                .filter((s) => s.length > 0);
            }
            setCivilTeamInfo({
              teamName: (lt.name as string) ?? "",
              // In the unified model, the LIGUE_CIVILE school IS the
              // league — its name is the league name.
              leagueName: school?.name ?? "",
              ageGroup: (lt.age_group as string) ?? null,
              division: (lt.division as string) ?? null,
              coaches: coachNames,
            });
          }
        }

        // Populate teamDetails for the bottom-of-Sportif block. Flat-map
        // every team_athletes row → its team join → TeamDetail. Civil-aware
        // via teams.schools.type === 'LIGUE_CIVILE'. Active filter +
        // sort happen INSIDE TeamDetailsBlock so both bodies share the
        // ordering logic.
        {
          const taRel = d.team_athletes as unknown;
          const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
          const mapped: TeamDetail[] = [];
          for (const taRow of taArr) {
            const teamRel = (taRow as Record<string, unknown>)?.teams;
            const team = (Array.isArray(teamRel) ? teamRel[0] : teamRel) as Record<string, unknown> | null;
            if (!team) continue;
            const sportRel = team.sports;
            const sport = (Array.isArray(sportRel) ? sportRel[0] : sportRel) as { nom?: string } | null;
            const teamSchoolRel = team.schools;
            const teamSchool = (Array.isArray(teamSchoolRel) ? teamSchoolRel[0] : teamSchoolRel) as { name?: string; type?: string } | null;
            const teamIsCivil = teamSchool?.type === "LIGUE_CIVILE";
            mapped.push({
              id: (team.id as string) ?? "",
              name: (team.name as string) ?? "",
              sportName: sport?.nom ?? "",
              league: (team.league as string | null) ?? null,
              ageGroup: (team.age_group as string | null) ?? null,
              division: (team.division as string | null) ?? null,
              gender: (team.gender as string | null) ?? null,
              season: (team.season as string | null) ?? null,
              isActive: (team.is_active as boolean | null) !== false,
              isCivil: teamIsCivil,
              clubName: teamIsCivil ? (teamSchool?.name ?? null) : null,
            });
          }
          setTeamDetails(mapped);
        }

        setLoadingAthlete(false);
      });

    /* Filet de securite : toute exception levee DANS le .then (mapping,
       jointure inattendue, RPC) laisserait sinon loadingAthlete a true et la
       page en chargement perpetuel. Le builder Supabase rend un
       PromiseLike<void>, qui n'a pas de .catch — d'ou Promise.resolve().
       On sort du chargement quoi qu'il arrive : une fiche incomplete vaut
       mieux qu'un ecran fige. */
    void Promise.resolve(load).catch((e: unknown) => {
      console.error("[AthleteRecruiterProfileBody] chargement echoue", e);
      setLoadingAthlete(false);
    });
  }, [id, isFreeRecruiter, tierLoading, viewerMode]);

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  // Partners only see the simplified canonical view; the detailed
  // toggle and detailed-only sections are hidden in partner mode.
  const effectiveMode: "simple" | "detailed" = isPartner ? "simple" : mode;
  const isDetailed = effectiveMode === "detailed";

  const [isFavorited, setIsFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);

  // DB enforces the cap via RLS; this only short-circuits the click before
  // it fires a doomed request and lets us show a clearer message.
  const favAtCap = maxFavorites !== -1 && myFavCount >= maxFavorites;
  const favButtonDisabled = favAtCap && !isFavorited;
  const favDisabledTitle = `Limite de ${maxFavorites} favoris atteinte. Passez à Pro pour plus.`;

  const toggleFav = async () => {
    if (favButtonDisabled) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;
    const { data: existing } = await supabase
      .from("recruiter_favorites")
      .select("id")
      .eq("recruiter_id", userId)
      .eq("athlete_id", id)
      .maybeSingle();
    if (existing) {
      await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
      setIsFavorited(false);
      setMyFavCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id });
      setIsFavorited(true);
      setMyFavCount((c) => c + 1);
    }
  };

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

  // ── "Contacter l'athlète" (RECRUTEUR_ATHLETE) — favorite-first gate ──
  // Not favorited → auto-prompt "Ajouter aux favoris pour contacter" ; once
  // favorited → find-or-create the RA thread and jump into it (the recruiter
  // types the first message there ; conversation creation fires the
  // coach+parent first-contact notification).
  const [showFavContactPrompt, setShowFavContactPrompt] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const openAthleteThread = async () => {
    setContacting(true);
    setContactError(null);
    const res = await findOrCreateRecruiterAthleteConversation(id);
    setContacting(false);
    if (!res.ok) { setContactError(res.error); return; }
    setShowFavContactPrompt(false);
    router.push(`/recruteur/messages?id=${res.conversationId}`);
  };

  const handleContactAthlete = () => {
    if (favButtonDisabled) return; // fav cap → can't favorite → can't contact
    /* Silence RSEQ — defense en profondeur. Le bouton qui mene ici est deja
       desactive ; ce test couvre le jour ou une AUTRE entree ouvrira la
       feuille de contact. Sans lui, le clic part sur openAthleteThread() et
       se fait refuser par le trigger (23514) au lieu d'etre explique. */
    if (!contactable) return;
    setContactError(null);
    if (isFavorited) { void openAthleteThread(); return; }
    setShowFavContactPrompt(true);
  };

  const favoriteAndContact = async () => {
    await toggleFav();       // adds to favorites (isFavorited flips true)
    await openAthleteThread();
  };

  useEffect(() => {
    const loadPipeline = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: pipelineData } = await supabase
        .from("recruiter_pipeline")
        .select("stage, visit_at")
        .eq("recruiter_id", session.user.id)
        .eq("athlete_id", id)
        .maybeSingle();
      setMyPipelineStage(pipelineData?.stage || null);
      setVisitAt((pipelineData?.visit_at as string | null) ?? null);
      // Le dropdown est piloté par la DB, plus par le mock : `pipelineStatus`
      // était seedé depuis getAthleteTracking() (mockPipelineData), donc il
      // n'était jamais aligné sur la vraie row du recruteur.
      if (pipelineData?.stage) {
        setPipelineStatus(String(pipelineData.stage).toLowerCase() as RecruitmentStatus);
      }
    };
    loadPipeline();
  }, [id]);

  // Record profile view — awaits and logs errors. The upsert dedupes
  // per day via the (recruiter_id, athlete_id, view_date) unique key.
  // Only fires for actual recruiters: skip in preview mode (athlete
  // looking at their own profile via iframe) and partner mode
  // (partner-portal session) so neither pollutes recruiter view
  // counts. Partner sessions get audited separately to
  // partner_profile_views via /api/partner/profile-views/log.
  useEffect(() => {
    if (viewerMode !== "recruiter") return;
    const recordView = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("recruiter_athlete_views")
        .upsert(
          { recruiter_id: user.id, athlete_id: id, viewed_at: new Date().toISOString() },
          { onConflict: "recruiter_id,athlete_id,view_date" }
        );
      if (error) {
        console.error("[recordView] failed to write recruiter_athlete_views:", error);
      }
    };
    recordView();
  }, [id, viewerMode]);

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
      const [favRes, viewRes] = await Promise.all([
        supabase.rpc("count_athlete_favorites", { athlete_uuid: id }),
        supabase.rpc("count_athlete_views", { athlete_uuid: id }),
      ]);
      setFavCount((favRes.data as number) ?? 0);
      setViewCount((viewRes.data as number) ?? 0);
    };
    loadCounts();
  }, [id, isFavorited]);

  // #52 — ne pas matérialiser un objet partiel quand a est encore null
  // (sinon le gate !a serait contourné et le type cassé). On ne fusionne
  // le compteur que sur un a déjà chargé.
  useEffect(() => { setA(prev => (prev ? { ...prev, favoriteCount: favCount } : prev)); }, [favCount]);

  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  const [flagSuccessToast, setFlagSuccessToast] = useState<SuccessToastData | null>(null);

  // Pipeline status tracking
  const initialTracking = getAthleteTracking(id);
  const [pipelineStatus, setPipelineStatus] = useState<RecruitmentStatus>(initialTracking?.status || "none");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  /* Deux verrous distincts ouvrent le MÊME UpgradeModal : le processus de
     recrutement et « Contacter ». Le titre était figé sur le premier, donc
     l'ouvrir depuis le second annonçait la mauvaise fonctionnalité. */
  const [upgradeFeatureTitle, setUpgradeFeatureTitle] = useState("Le processus de recrutement");

  /* Le bouton « Contacter » reste VISIBLE en free et vend la mise à niveau.
     Avant, `{canMessageCoach && …}` le faisait disparaître : un free ne
     voyait pas la fonctionnalité, donc ne savait pas qu'elle existait ni
     qu'elle s'achète. Un verrou visible convertit, un vide ne dit rien. */
  const contactLocked = !canMessageCoach;
  const handleContactClick = () => {
    if (contactLocked) {
      setUpgradeFeatureTitle("Contacter les athlètes et leurs coachs");
      setShowUpgradeModal(true);
      return;
    }
    setShowContactMenu(true);
  };

  /* PORTE DE SORTIE. Pendant un silence RSEQ, le contact direct est ferme
     mais RECRUTEUR_COACH ne l'est pas : parler a l'entraineur reste la voie
     legitime. Un bouton desactive n'apporte rien — on offre l'action qui
     reste possible, exactement comme le fil de messagerie. */
  const [contactingCoach, setContactingCoach] = useState(false);
  const handleContactCoach = async () => {
    if (!coachId || contactingCoach) return;
    setContactingCoach(true);
    const res = await findOrCreateRecruiterConversation({ coachId, athleteId: id });
    /* Union discriminee : on teste `ok` seul, sinon TypeScript ne retrecit
       pas la branche d'echec. */
    if (res.ok) { router.push(`/recruteur/messages/${res.conversationId}`); return; }
    setContactingCoach(false);
    console.warn("[contact coach] echec", res.error);
  };


  /* Période de restriction RSEQ — UI dormante, la RPC rend `true` aujourd'hui.
     Ce test passe AVANT le verrou de palier : une restriction de ligue n'est
     pas une fonctionnalité à vendre, et proposer « Passe à Pro » sur un
     athlète que personne ne peut contacter serait mensonger. */
  /* `message` porte desormais le libelle de la periode et la date de
     reprise ; il retombe sur BLACKOUT_MESSAGE si la periode est inconnue. */
  const { contactable, message: blackoutMsg } = useAthleteContactable(id);
  /* Le blackout est actif ET l'athlete a un entraineur : on bascule le
     bouton. Sans entraineur, on garde le bouton desactive et le message
     l'explique — pas de bouton mort. */
  const coachExit = !contactable && !!coachId;
  const [statusToast, setStatusToast] = useState<SuccessToastData | null>(null);

  /* Le stage est désormais PERSISTÉ (avant : setState local uniquement → tout
     changement de statut depuis la fiche était perdu au refresh). Optimiste :
     on peint l'UI tout de suite, on rollback si Postgres refuse. */
  async function handleStatusChange(newStatus: RecruitmentStatus, extra?: { visitDate?: string; retireReason?: RetireReason }) {
    const prevStatus = pipelineStatus;
    const prevVisitAt = visitAt;
    const nextVisitAt = newStatus === "visite_planifiee" ? (extra?.visitDate ?? null) : null;

    setPipelineStatus(newStatus);
    setVisitAt(nextVisitAt);

    const res = await persistPipelineStage({
      athleteId: id,
      status: newStatus,
      visitAtIso: extra?.visitDate,
    });

    if (!res.ok) {
      setPipelineStatus(prevStatus);
      setVisitAt(prevVisitAt);
      setStatusToast({
        message: res.reason === "pro_required"
          ? "Fonctionnalité Pro — passe à Pro pour gérer ton processus."
          : "Le changement de statut n'a pas pu être enregistré.",
      });
      return;
    }

    // Garde « Mon statut » (lu depuis la DB) cohérent avec le dropdown.
    setMyPipelineStage(newStatus === "retire" ? null : newStatus.toUpperCase());
  }

  // INSERT into public.reports. type/status forced to DB CHECK-allowed
  // values ('PROFIL' / 'OUVERT'); reported_user_id has FK to users(id)
  // and is NOT NULL, so orphan athletes (user_id null) can't be reported
  // — handled by disabling the button when athleteUserId is null.
  async function handleFlagSubmit() {
    if (!flagReason || flagSubmitting) return;
    if (!athleteUserId) {
      console.error("[Signaler] athlete has no user_id (orphan profile) — cannot file report");
      if (typeof window !== "undefined") window.alert("Ce profil n'est pas réclamé par un compte utilisateur. Le signalement ne peut pas être déposé pour le moment.");
      return;
    }
    setFlagSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("[Signaler] no authenticated user");
        if (typeof window !== "undefined") window.alert("Tu dois être connecté pour signaler un profil.");
        return;
      }
      const { data: inserted, error } = await supabase.from("reports").insert({
        type: "PROFIL",
        target_id: id,
        target_type: "athlete",
        reported_user_id: athleteUserId,
        reported_by_id: user.id,
        raison: flagReason,
        contenu_signale: flagDetails || null,
        status: "OUVERT",
      }).select("id").single();
      if (error) {
        console.error("[Signaler] insert failed:", error);
        if (typeof window !== "undefined") window.alert("Échec de l'envoi du signalement. Réessaie plus tard.");
        return;
      }
      setFlagSubmitted(true);
      setShowFlagModal(false);
      setFlagSuccessToast({
        message: "Signalement envoyé",
        referenceId: (inserted?.id as string | undefined)?.slice(0, 8),
      });
    } finally {
      setFlagSubmitting(false);
    }
  }

  // #52 — gate anti-flash : tant que le fetch charge (loadingAthlete) ou que
  // a est null (aucune vraie donnée encore), on rend un fallback spinner —
  // jamais le mock. Placé APRÈS tous les hooks et AVANT le premier accès
  // a.xxx (traitEntries ci-dessous) → narrowing TS de a à non-null + pas de
  // crash sur null.
  if (loadingAthlete || !a) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111317]">
        <div className="w-8 h-8 rounded-full border-2 border-[#2D3748] border-t-[#E63946] animate-spin" role="status" aria-label="Chargement du profil" />
      </div>
    );
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
        </div>
      </div>
      )}

      {/* pb : le bandeau de restriction ajoute une rangée au bloc bas fixe.
          Sans la réserver, les dernières sections finissent derrière lui. */}
      <div className={`max-w-7xl mx-auto px-6 py-8 space-y-6 relative z-1 ${contactable ? "pb-28" : "pb-40"}`}>

        {/* Vitrine — bandeau en tete de fiche : personne ne doit croire
            contacter un vrai athlete. */}
        <DemoRibbonIf athleteId={id} variant="profile" />

        {/* ── Toggle (hidden for partner) + Completeness ────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {isPartner ? <div /> : <ProfileToggle mode={mode} onChange={setMode} />}
          {/* La RPC partenaire ne projette PAS profile_completion : la barre
              affichait « 0 % » pour les 47 fiches, alors que le reel va de 33 a
              95. Une barre absente ne dit rien ; une barre a zero affirme une
              chose fausse sur un athlete. Masquee tant que la colonne n'est pas
              projetee — a rouvrir en l'AJOUTANT a la RPC. */}
          {!isPartner && (
            <div className="w-full sm:w-56">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1">Profil complété</p>
              <CompletenessBar percent={a.profileCompleteness} />
            </div>
          )}
        </div>

        {/* ══════════ HERO — 2 Columns ══════════ */}
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
          <div className="shrink-0 flex justify-center lg:justify-start">
            <PlayerCard a={a} isFree={lockContent} />
          </div>

          <div className="flex-1 min-w-0 lg:pt-2 space-y-5">
            <h1 className="font-head text-[36px] sm:text-[46px] font-black text-white uppercase tracking-tight leading-[0.92]">
              {/* IDENTITE = decision SERVEUR, jamais le palier ni la vitrine.
                  Tester `lockContent` ici rendait un en-tete VIDE sur le profil
                  demo : le verrou cedait, mais la RPC renvoie first_name a NULL
                  tant que identity_visible est faux. `identityVisible` est le
                  seul predicat qui sait s'il y a quelque chose a afficher. */}
              {a.identityVisible === false ? (
                <span className="inline-flex items-start gap-3" title="Nom réservé aux recruteurs Pro">
                  <span aria-hidden="true" className="select-none pointer-events-none blur-[6px]">Prénom<br />Nom</span>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
              ) : (
                <>{a.firstName}<br />{a.lastName}</>
              )}
              {a.jerseyNumber && <span className="text-[#E63946] ml-3">#{a.jerseyNumber}</span>}
            </h1>

            {/* Engagement metrics + status boxes */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-[#111317] rounded-lg px-4 py-2 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className="text-[16px] font-bold text-white">{viewCount}</span>
                <span className="text-[11px] text-[#6b7280]">{viewCount === 1 ? "vue totale" : "vues totales"}</span>
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
                  ) : tier === "free" ? (
                    <button
                      type="button"
                      onClick={() => { setUpgradeFeatureTitle("Le processus de recrutement"); setShowUpgradeModal(true); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/10 border border-[#E63946]/30 text-[11px] font-bold text-[#E63946] hover:bg-[#E63946]/20 hover:border-[#E63946]/50 transition-all"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Passer à Pro pour le processus
                    </button>
                  ) : (
                    <span className="text-[12px] text-[#6b7280]">Pas dans le processus</span>
                  )}
                </div>
              )}
              {/* Meme raison que la barre de completude : recruitment_status,
                  statut_recrutement_override, committed_school et open_to_offers
                  ne sont PAS projetes par la RPC partenaire. Le badge retombait
                  sur son defaut « OUVERT » pour les 47 fiches — faux pour 13
                  d'entre elles. Masque plutot que menteur. */}
              {!isPartner && (
                <div className="bg-[#111317] rounded-lg px-4 py-2">
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block mb-1">Statut recrutement</span>
                  <RecruitmentStatusBadgeGlobal status={recruitmentStatus as GlobalRecruitmentStatus} committedSchoolName={committedSchoolName} openToOffers={openToOffers} size="sm" />
                </div>
              )}

            </div>

            {!isPreview && canUsePipeline && pipelineStatus !== "none" && (
              <div className="flex items-center gap-3">
                <StatusChangeDropdown
                  currentStatus={pipelineStatus}
                  athleteId={id}
                  hasExistingThread={false}
                  onStatusChange={handleStatusChange}
                  onComposeIntro={() => router.push(`/recruteur/messages/nouveau?athlete=${id}`)}
                  onCelebrate={() => setShowCelebration(true)}
                />
              </div>
            )}

            {/* Visite planifiée + export agenda. Gate strict : le stage ET la
                date. Une visite sans date affiche le stage, pas la carte. */}
            {!isPreview && canUsePipeline && pipelineStatus === "visite_planifiee" && visitAt && (
              <div className="max-w-[420px]">
                <VisitCalendarCard
                  visitAtIso={visitAt}
                  athleteName={`${a.firstName} ${a.lastName}`}
                  sport={a.primarySport}
                  schoolName={a.schoolName}
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
                  {a.distinctions.slice(0, MAX_BADGES_AFFICHES).map((d, i) => (
                    <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} libelle={d.libelle} size="lg" />
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ══════════ COACH REPORT (both modes — content varies) ══════════ */}
        {lockContent ? (
          <section>
            <h2 className={sectionLabel}>Rapport de l&apos;entraîneur</h2>
            <FreeLock />
          </section>
        ) : (a.coachReport || coteGlobale >= 0) ? (
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
                        {/* Deux blocs 9/5 au lieu d'une liste de 14. Les libellés
                            des 5 fentes variables viennent de la grille de
                            l'athlète ; rien ne les distingue des fixes. */}
                        {traitGroups(grilleSet, grilleRef).map((group) => {
                          const rated = group.traits.filter((t) => {
                            const v = a.traitRatings ? a.traitRatings[t.camel as keyof typeof a.traitRatings] : 0;
                            return typeof v === "number" && v > 0;
                          });
                          // Un groupe dont aucun critère n'est noté ne s'affiche
                          // pas — son titre seul laisserait croire à un oubli.
                          if (rated.length === 0) return null;
                          return (
                            <div key={group.title} className="mb-5 last:mb-0">
                              <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">{group.title}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                {rated.map((trait) => {
                                  const val = a.traitRatings![trait.camel as keyof typeof a.traitRatings] as number;
                                  return (
                                    <div key={trait.column} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                                      <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                                      <StarRating rating={val} size="sm" />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
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
                        {/* `lg`, comme le bloc Profil athlete : c'est le MEME badge dans le
                            MEME sous-bloc Distinctions. Le `sm` venait d'un heritage, pas
                            d'une contrainte de place — conteneur en flex-wrap gap-3, donc
                            5 x 136 + 4 x 12 = 728 px tiennent. */}
                        <div className="flex flex-wrap gap-3">
                          {a.distinctions.slice(0, MAX_BADGES_AFFICHES).map((d, i) => (
                            <DistinctionBadge key={`${d.badge}-${i}`} badge={d.badge} detail={d.detail} libelle={d.libelle} size="lg" />
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ══════════ FAITS SAILLANTS (VIDEO) ══════════ */}
        <section>
          <h2 className={sectionLabel}>Faits saillants</h2>
          {lockContent ? (
            <FreeLock />
          ) : a.highlightVideoUrl || a.fullGameUrl ? (
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

        {/* Parcours d'équipes — remonté AU-DESSUS du profil académique et
            renforcé (en-tête plus grand + accent) : le parcours sportif est
            un signal de premier plan pour le recruteur (#8). Se masque tout
            seul si aucune entrée. Anchor = vraie affiliation Nexus. */}
        {!isPartner && (
          <div className="rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.04] p-4 sm:p-5">
            <TeamHistoryBlock
              entries={a.teamHistory}
              anchor={{
                teamName: a.isCivil ? (a.teamName || a.leagueName || "") : (a.schoolName || ""),
                sport: a.primarySport,
                position: a.primaryPosition,
                region: a.region,
              }}
              headingClassName="font-head text-[17px] sm:text-[19px] font-black tracking-tight uppercase text-white mb-4 flex items-center gap-2.5 before:content-[''] before:w-1 before:h-5 before:rounded-full before:bg-[#E63946]"
            />
          </div>
        )}

        {/* ══════════ ACADEMIC PROFILE — partner mode swaps for a
            locked placeholder so the redaction reads as
            intentional rather than missing. */}
        {isPartner ? (
          <section>
            <h2 className={sectionLabel}>Profil académique</h2>
            <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">
                Réservé aux recruteurs et coaches
              </p>
              <p className="text-[13px] text-[#6B7280] max-w-md">
                Ces informations académiques ne sont pas partagées avec les partenaires Nexus.
              </p>
            </div>
          </section>
        ) : lockContent ? (
          <section>
            <h2 className={sectionLabel}>Profil académique</h2>
            <FreeLock />
          </section>
        ) : (
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
        )}

        {/* ════════════════════════════════════════════════════
           DETAILED SECTIONS — only when toggle = Détaillé
        ════════════════════════════════════════════════════ */}
        {isDetailed && (
          <div className="space-y-6" key="detailed-sections">

            {/* ── Affiliation: school OR civil team ─────────── */}
            <section className="nx-slide-section">
              <h2 className={sectionLabel}>
                {affiliation === "school" ? "École" : "Équipe civile"}
              </h2>
              <div className={`${cardBase} p-5`}>
                {affiliation === "school" && (
                  <>
                    <InfoRow label={a.isCivil ? "Équipe civile" : "École"} value={a.isCivil ? (a.teamName || a.leagueName || "—") : (a.schoolName || "—")} icon="building" />
                    <InfoRow label="Région" value={a.region} icon="map" />
                    <InfoRow label="Ville" value={a.city} icon="mapPin" />
                  </>
                )}
                {/* Civil-only InfoRows for team detail removed —
                    moved to the generalized TeamDetailsBlock at the
                    bottom of "Informations sportives" (école + civil
                    unified, no duplicate). */}
                {affiliation === "civil_no_team" && (
                  <p className="text-[13px] text-[#9CA3AF] italic py-2">
                    Athlète en ligue civile, pas encore rattaché à une équipe.
                  </p>
                )}
              </div>
            </section>

            {/* ── Personal Info ─────────────────────────────── */}
            <section className="nx-slide-section">
              <h2 className={sectionLabel}>Informations personnelles</h2>
              <div className={`${cardBase} p-5`}>
                <InfoRow label="Âge" value={`${a.age} ans`} icon="calendar" />
                <InfoRow label="Genre" value={a.gender === "M" ? "Masculin" : a.gender === "F" ? "Féminin" : "Autre"} icon="user" />
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
                {/* a.teamName / a.leagueName / a.teamLevel rows were
                    civil-only via mapToRecruiterView (empty for école).
                    Replaced by the generalized TeamDetailsBlock below,
                    which surfaces team detail for BOTH école and civil
                    from the team_athletes → teams join. */}
                <TeamDetailsBlock teams={teamDetails} />
              </div>
            </section>

            {/* ── Academic Details (extended) ──────────────── */}
            {isPartner && (
              <section className="nx-slide-section">
                <h2 className={sectionLabel}>Détails académiques</h2>
                <div className="bg-[#1A1D24] rounded-xl border border-dashed border-white/10 px-6 py-12 flex flex-col items-center justify-center text-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                  <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">
                    Réservé aux recruteurs et coaches
                  </p>
                  <p className="text-[13px] text-[#6B7280] max-w-md">
                    Ces informations académiques ne sont pas partagées avec les partenaires Nexus.
                  </p>
                </div>
              </section>
            )}
            {!isPartner && (a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
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

            {/* ── Coach Reputation — hidden for partner mode ── */}
            {!isPartner && a.coachName && (
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
        {/* Période de restriction — même patron que « athlète sans coach » :
            l'action reste VISIBLE mais désactivée, et une phrase dit pourquoi.
            La cacher laisserait croire que la fonctionnalité n'existe pas. */}
        {/* FONDS OPAQUES en viewport mobile — `/95 + backdrop-blur` laissait le
            contenu transparaître à travers le bandeau et la barre, qui se
            lisaient alors comme un calque flottant posé sur les sections du
            bas plutôt que comme le socle de l'écran. Le contenu doit passer
            DERRIÈRE, invisible. En `md:` la barre est une pilule flottante
            détachée du bas de l'écran : là, le retrait translucide est voulu
            et reste en place. */}
        {!contactable && (
          <p className="md:max-w-[320px] md:ml-auto md:mb-2 bg-[#1A1D24] md:bg-[#1A1D24]/95 md:backdrop-blur-sm border-t md:border border-[#2D3748] md:rounded-xl px-4 py-2.5 text-[12px] leading-snug text-[#F59E0B]">
            {blackoutMsg}{" "}
            {blackoutSortieCourt(!!coachId)}
          </p>
        )}
        {/* Mobile — full-width bar */}
        <div className="md:hidden bg-[#111317] border-t border-[#2D3748] px-4 py-3 flex items-center gap-2">
          <button type="button" onClick={coachExit ? handleContactCoach : handleContactClick}
            disabled={coachExit ? contactingCoach : !contactable}
            title={coachExit ? "Écrire à l'entraîneur de cet athlète" : !contactable ? blackoutMsg : contactLocked ? "Contacter nécessite un abonnement Pro" : undefined}
            className="disabled:opacity-40 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2.5 bg-[#E63946] text-white rounded-xl px-6 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest transition-all hover:bg-[#D42B22] active:scale-[0.98] shadow-[0_0_20px_rgba(230,57,70,0.3)]">
            {contactLocked ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
            )}
            {coachExit ? (contactingCoach ? "Ouverture…" : "Écrire à son entraîneur") : "Contacter"}
          </button>
          <button type="button" onClick={toggleFav}
            disabled={favButtonDisabled}
            title={favButtonDisabled ? favDisabledTitle : (isFavorited ? "Retirer des favoris" : "Ajouter aux favoris")}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${favButtonDisabled ? "cursor-not-allowed opacity-40" : ""} ${isFavorited ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#1A1D24] border-[#2D3748]"}`}>
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
          <button type="button" onClick={coachExit ? handleContactCoach : handleContactClick}
            disabled={coachExit ? contactingCoach : !contactable}
            title={coachExit ? "Écrire à l'entraîneur de cet athlète" : !contactable ? blackoutMsg : contactLocked ? "Contacter nécessite un abonnement Pro" : undefined}
            className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2.5 bg-[#E63946] text-white rounded-xl px-8 py-4 font-head font-bold text-[14px] uppercase tracking-widest justify-center transition-all hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(230,57,70,0.4)] active:scale-[0.98] shadow-[0_4px_20px_rgba(230,57,70,0.3)]">
            {contactLocked ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
            )}
            {coachExit ? (contactingCoach ? "Ouverture…" : "Écrire à son entraîneur") : "Contacter"}
          </button>
          <button type="button" onClick={toggleFav}
            disabled={favButtonDisabled}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${favButtonDisabled ? "cursor-not-allowed opacity-40" : "hover:-translate-y-0.5"} ${isFavorited ? "bg-[#E63946]/10 border-[#E63946]/30" : `bg-[#1A1D24] border-[#2D3748] ${favButtonDisabled ? "" : "hover:border-[#E63946]/30"}`}`}
            title={favButtonDisabled ? favDisabledTitle : (isFavorited ? "Retirer des favoris" : "Ajouter aux favoris")}>
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


      {/* ══════════ CONTACT CHOICE MENU (coach vs athlete) ══════════ */}
      {showContactMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowContactMenu(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[420px] mx-4 shadow-2xl p-6">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Contacter</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-5">Qui veux-tu contacter au sujet de {a.firstName} {a.lastName}&nbsp;?</p>
            <div className="space-y-3">
              <button type="button" disabled={!coachId}
                onClick={() => { if (!coachId) return; setShowContactMenu(false); router.push(`/recruteur/messages/nouveau?athlete=${a.id}`); }}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-colors text-left ${!coachId ? "cursor-not-allowed opacity-40 bg-[#111317] border-[#2D3748]" : "bg-[#111317] border-[#2D3748] hover:border-[#E63946]/50 hover:bg-[#E63946]/[0.06]"}`}>
                <span className="w-10 h-10 rounded-lg bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-white">Contacter le coach</span>
                  <span className="block text-[12px] text-[#6b7280]">{coachId ? "Écris à l’entraîneur de l’athlète" : "Aucun coach connecté pour cet athlète"}</span>
                </span>
              </button>
              {/* Silence RSEQ — `contactable` DOIT figurer ici. Le bouton
                  principal bascule vers l'entraineur pendant une periode, mais
                  cette feuille porte sa PROPRE entree vers l'athlete : sans ce
                  test, elle reste cliquable et part droit sur le refus 23514
                  du trigger. Le serveur bloquerait de toute facon — l'ecran ne
                  doit pas laisser croire le contraire. */}
              <button type="button" disabled={contacting || favButtonDisabled || !contactable}
                onClick={() => { setShowContactMenu(false); handleContactAthlete(); }}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-colors text-left ${favButtonDisabled || !contactable ? "cursor-not-allowed opacity-40 bg-[#111317] border-[#2D3748]" : "bg-[#111317] border-[#2D3748] hover:border-[#E63946]/50 hover:bg-[#E63946]/[0.06]"}`}>
                <span className="w-10 h-10 rounded-lg bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-white">Contacter l&apos;athlète</span>
                  <span className="block text-[12px] text-[#6b7280]">{!contactable ? blackoutSortie(!!coachId) : isFavorited ? "Message direct à l'athlète" : "Ajoute-le aux favoris pour le contacter"}</span>
                </span>
              </button>
            </div>
            <button type="button" onClick={() => setShowContactMenu(false)}
              className="mt-4 w-full rounded-lg px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ══════════ FAVORITE-FIRST CONTACT PROMPT (RECRUTEUR_ATHLETE) ══════════ */}
      {showFavContactPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!contacting) setShowFavContactPrompt(false); }} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl w-full max-w-[440px] mx-4 shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">
              Ajouter aux favoris pour contacter
            </h3>
            <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-1">
              Pour contacter {a.firstName} {a.lastName} directement, ajoute-le d&apos;abord à tes favoris.
            </p>
            <p className="text-[12px] text-[#6b7280] leading-relaxed mb-5">
              Son coach et son parent seront avisés de ce premier contact.
            </p>
            {contactError && <p className="text-[13px] text-[#EF4444] mb-4">{contactError}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { if (!contacting) setShowFavContactPrompt(false); }}
                className="flex-1 rounded-lg px-4 py-3 text-[13px] font-bold text-[#9CA3AF] bg-[#111317] border border-[#2D3748] hover:text-white transition-colors">
                Annuler
              </button>
              <button type="button" onClick={() => void favoriteAndContact()} disabled={contacting}
                className="flex-1 rounded-lg px-4 py-3 text-[13px] font-head font-bold uppercase tracking-widest text-white bg-[#E63946] hover:bg-[#D42B22] transition-colors disabled:opacity-60">
                {contacting ? "..." : "Ajouter et contacter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct-contact error (already-favorited path) — modal carries its own. */}
      {contactError && !showFavContactPrompt && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#EF4444]/40 rounded-lg px-4 py-3 shadow-2xl max-w-[90vw]">
          <p className="text-[13px] text-[#EF4444]">{contactError}</p>
        </div>
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
                  disabled={!flagReason || flagSubmitting || !athleteUserId}
                  onClick={handleFlagSubmit}
                  className="flex items-center gap-2 bg-[#F59E0B] text-[#111317] rounded-lg px-5 py-2.5 font-bold text-[14px] uppercase tracking-wider transition-all hover:bg-[#D97706] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  {flagSubmitting ? "Envoi…" : "Envoyer le signalement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessToast data={flagSuccessToast} onDismiss={() => setFlagSuccessToast(null)} />
      <SuccessToast data={statusToast} onDismiss={() => setStatusToast(null)} />

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        role="recruteur"
        tierId="rec_pro"
        lockedFeatureTitle={upgradeFeatureTitle}
        returnTo={typeof window !== "undefined" ? window.location.pathname : undefined}
      />
    </div>
  );
}
