"use client";

// NOTE: la logique de fetch Supabase est dupliquée depuis
// AthleteRecruiterProfileBody.tsx. Refactor dans un hook
// useAthleteRecruiterProfile(id) prévu une fois le mobile validé.
// Itération 1 = squelette fonctionnel mobile-first, viewerMode "recruiter"
// uniquement. Si viewerMode preview/partner → on délègue au desktop body.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateAthleteCoachConversation } from "@/lib/queries/messaging/createAthleteCoachConversation";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { mockAthleteProfileFull } from "@/lib/mock/athleteProfileRecruiter";
import type {
  AthleteProfileRecruiterView,
  AthleteTraitRatings,
  GlobalRecruitmentStatus,
} from "@/lib/types/models";
import RecruitmentStatusBadgeGlobal from "@/components/ui/RecruitmentStatusBadge";
import DistinctionBadge from "@/components/shared/DistinctionBadge";
import { parseDistinctions, MAX_BADGES } from "@/lib/config/badges";
import { AdaptiveBadgesRow } from "@/components/shared/badges/AdaptiveBadgesRow";
import { SPORT_NAME_MAP } from "@/lib/config/sportBadges";
import type {
  RecruitmentStatus,
  RetireReason,
} from "@/lib/config/recruitmentStatuses";
import { getAthleteTracking } from "@/app/recruteur/_data/mockPipelineData";
import VisitCalendarCard from "@/components/shared/VisitCalendarCard";
import VisitDateEditor from "@/components/shared/VisitDateEditor";
import { persistPipelineStage } from "@/lib/pipeline/persistPipelineStage";
import { needsAutoMessage } from "@/lib/config/recruitmentStatuses";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { selectBestEvaluation } from "@/lib/evaluations/selectEvaluation";
import { useFavoritesCount } from "@/lib/hooks/useFavoritesCount";
import CelebrationToast from "@/app/recruteur/_components/CelebrationToast";
import UpgradeModal from "@/components/ui/UpgradeModal";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { HeartButton } from "@/components/mobile/HeartButton";
import NxIcon from "@/components/ui/NxIcon";
import StarRating from "@/components/ui/StarRating";
import VideoEmbed from "@/components/ui/VideoEmbed";
import {
  calculateCompletion,
  type AthleteLike,
  type EvalLike,
} from "@/lib/utils/profileCompletion";
import { isValidationExpired } from "@/lib/utils/profileValidation";
import { SESSION_KEY_PREFIX } from "@/lib/platform/mobileRoutes";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
import { findOrCreateRecruiterConversation, findOrCreateRecruiterAthleteConversation } from "@/lib/utils/findOrCreateRecruiterConversation";
import { AddToListSheet } from "@/components/shared/AddToListSheet";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import { TeamDetailsBlock, type TeamDetail } from "@/components/shared/athlete/TeamDetailsBlock";
import TeamHistoryBlock from "@/components/shared/athlete/TeamHistoryBlock";
import { parseTeamHistory } from "@/components/shared/athlete/teamHistory";
import { motion, AnimatePresence } from "framer-motion";
// Coach-only imports (Step 6 unification — viewer="coach" branch).
import { loadAthleteRaw, mapToRecruiterView } from "@/app/coach/athletes/_data/loadAthleteFromSupabase";
import ConsentAlert from "@/components/coach/profile/ConsentAlert";
import VerifyAlert from "@/components/coach/profile/VerifyAlert";
import SuggestionsAlert, { type PendingSuggestion } from "@/components/coach/profile/SuggestionsAlert";
import SuggestionSheet from "@/components/coach/SuggestionSheet";
import type { CoachTaskSuggestion } from "@/lib/coach/tasks";

export type AthleteProfileViewerMode = "recruiter" | "preview" | "partner";
/** Surface viewer — drives recruteur-only gates + coach-only additions.
 *  Default "recruiter" → existing call sites unaffected.
 *
 *  "self-preview" (Sprint C) = the athlete viewing their OWN profile via
 *  the athlete portal's Aperçu route. Reuses the RECRUITER-perspective
 *  data load (canonical "this is what a recruiter sees") but suppresses
 *  every recruiter-side action (favorites/contact/pipeline/lists) and
 *  every recruiter-scoped fetch (favorites/pipeline/recruiter_athlete_views).
 *  isRecruiter stays FALSE for self-preview so the existing
 *  `if (!isRecruiter) return;` early-returns in those useEffects continue
 *  to auto-suppress — the only gate widened is the recruiter-perspective
 *  athletes SELECT (so the canonical full-fat load still runs). */
export type AthleteProfileViewer = "recruiter" | "coach" | "self-preview";

interface Props {
  athleteId: string;
  viewerMode: AthleteProfileViewerMode;
  viewer?: AthleteProfileViewer;
}

const sectionLabel = "font-head text-[12px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-3";
const pillBase = "inline-flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full border";

// Mobile flat — pas de bg/border (style list iOS Settings)
const mobileSection = "px-1";
const mobileSubtle = "bg-white/[0.02] rounded-2xl";
const mobileRow = "flex items-center justify-between py-3 border-b border-white/[0.06] last:border-b-0";

// Helper haptic (Fix 7 iter 3.1) — no-op silencieux si plugin manquant (web build)
async function triggerHaptic(intensity: "Light" | "Medium" | "Heavy" = "Light") {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const style = intensity === "Light" ? ImpactStyle.Light : intensity === "Medium" ? ImpactStyle.Medium : ImpactStyle.Heavy;
    await Haptics.impact({ style });
  } catch { /* haptics non disponible */ }
}

// Mapping pulse dot par stage pipeline (Fix 3 iter 3.6).
// IDENTIFIE/CONTACTE = passifs (gris statique)
// EN_DISCUSSION/VISITE_PLANIFIEE = actifs engageants (rouge breathe + halo)
// ENGAGE/LETTRE_SIGNEE = finalisés positifs (vert statique)
// Tout autre statut = pas de dot affiché
const PIPELINE_DOT_MAP: Record<string, { color: string; animated: boolean; halo: boolean } | undefined> = {
  IDENTIFIE:        { color: "#6B7280", animated: false, halo: false },
  CONTACTE:         { color: "#6B7280", animated: false, halo: false },
  EN_DISCUSSION:    { color: "#E63946", animated: true,  halo: true  },
  VISITE_PLANIFIEE: { color: "#E63946", animated: true,  halo: true  },
  ENGAGE:           { color: "#22C55E", animated: false, halo: false },
  LETTRE_SIGNEE:    { color: "#22C55E", animated: false, halo: false },
};

type TabKey = "rapport" | "academique" | "sportif";
const TABS: { key: TabKey; label: string }[] = [
  { key: "rapport", label: "Rapport" },
  { key: "academique", label: "Académique" },
  { key: "sportif", label: "Sportif" },
];

const SPORT_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SPORT_NAME_MAP).map(([display, key]) => [key, display]),
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
  { key: "speed", label: "Vitesse / Explosivité" },
  { key: "power", label: "Force / Puissance" },
  { key: "endurance", label: "Endurance cardio" },
  { key: "agility", label: "Agilité / Coordination" },
  { key: "gameVision", label: "Vision du jeu" },
  { key: "tactics", label: "Sens tactique" },
];

const FLAG_REASONS = [
  "Informations incorrectes",
  "Profil incomplet ou trompeur",
  "Données statistiques douteuses",
  "Photo ou contenu inapproprié",
  "Autre",
];

/* ── Helper sub-components (copiés du desktop body) ─────────────── */

function ProfileToggle({ mode, onChange }: { mode: "simple" | "detailed"; onChange: (m: "simple" | "detailed") => void }) {
  // Iter 7.8b Section B — pill plus lisible : padding bumpé (px-5 py-2.5),
  // texte 13px (au lieu de 12), tracking moins serré, container plus aéré.
  const pill = (active: boolean) =>
    `px-5 py-2.5 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] transition-all cursor-pointer ${
      active
        ? "bg-[#E63946] text-white shadow-[0_0_10px_rgba(230,57,70,0.25)]"
        : "text-[#9CA3AF] hover:text-white"
    }`;
  return (
    <div className="flex items-center gap-1.5 bg-[#13151a] rounded-full p-1.5 w-fit">
      <button type="button" onClick={() => onChange("simple")} className={pill(mode === "simple")}>Simplifié</button>
      <button type="button" onClick={() => onChange("detailed")} className={pill(mode === "detailed")}>Détaillé</button>
    </div>
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

function positionAbbr(pos: string): string {
  const match = pos.match(/\(([^)]+)\)/);
  if (match) return match[1].toUpperCase();
  return pos.length > 4 ? pos.slice(0, 3).toUpperCase() : pos.toUpperCase();
}

/** Mobile PlayerCard — 280x392 (vs 300x420 desktop). Même structure / ticket.
    starsRevealed: nombre d'étoiles visibles (0-5). Permet l'animation cascade au mount.
    cardRevealed: contrôle l'animation d'arrivée propre (opacity+scale) — sans glitch latéral.
    photoParallaxY: décalage Y appliqué sur la photo pour effet parallax subtil au scroll. */
function PlayerCardMobile({ a, isFree, starsRevealed = 5, cardRevealed = true, photoParallaxY = 0, layoutIdPrefix = "athlete-photo" }: { a: AthleteProfileRecruiterView; isFree: boolean; starsRevealed?: number; cardRevealed?: boolean; photoParallaxY?: number; layoutIdPrefix?: string }) {
  const ratingValue = a.overallRating;
  const posAbbr = positionAbbr(a.primaryPosition);
  const sportKey = SPORT_NAME_MAP[a.primarySport];
  const sportDisplay = sportKey ? (SPORT_DISPLAY[sportKey] || a.primarySport) : a.primarySport;
  const badgeActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });

  return (
    /* Wow wrapper — .nx-wow-idle bounce + sheen sweep on the canon
       recruiter/coach/self-preview mobile view. Wraps the v30 core
       (the .nx-v30-wrap below) as a SEPARATE element so the idle
       keyframe transform composes with the v30's static cardRevealed
       scale/translate without colliding. The sheen overlay is a
       sibling of .nx-v30-wrap inside the wow wrapper. */
    <div className="nx-wow-idle mx-auto" style={{ position: "relative", width: 280 }}>
    <div
      className="nx-v30-wrap relative mx-auto"
      style={{
        width: 280,
        paddingTop: 6,
        paddingBottom: 10,
        opacity: cardRevealed ? 1 : 0,
        transform: cardRevealed ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
        transformOrigin: 'center top',
        transition: 'opacity 350ms ease-out, transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {/* Override les transitions par défaut .nx-v30-card/.nx-v30-ticket/.nx-v30-badge
          qui causent un glissement latéral au mount (rotate animation depuis 0deg). */}
      <div className="nx-v30-badge absolute z-30" style={{ top: 10, right: -12, transition: 'none' }} title={badgeActive ? "Profil vérifié" : a.isVerified ? "Badge désactivé — confirmation requise" : "Profil non vérifié"}>
        <div className="rounded-full" style={{ border: '3px solid #111317' }}>
          {badgeActive ? (
            <svg width="44" height="44" viewBox="0 0 54 54" fill="none">
              <defs>
                <radialGradient id="rcm_bg" cx="38%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#29AAFF" />
                  <stop offset="55%" stopColor="#0094F0" />
                  <stop offset="100%" stopColor="#0060C0" />
                </radialGradient>
              </defs>
              <circle cx="27" cy="27" r="26" fill="#0060C0" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="url(#rcm_bg)" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          ) : (
            <svg width="44" height="44" viewBox="0 0 54 54" fill="none">
              <circle cx="27" cy="27" r="26" fill="#4B5563" opacity="0.35" />
              <circle cx="27" cy="27" r="24" fill="#6B7280" />
              <circle cx="27" cy="27" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <path d="M16,27 L22,34 L38,18" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </div>
      </div>

      <motion.div
        layoutId={`${layoutIdPrefix}-${a.id}`}
        className="nx-v30-card relative overflow-visible"
        style={{ width: 280, borderRadius: 10, transition: 'none' }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="relative overflow-hidden" style={{ width: 280, height: 392, borderRadius: 10, background: '#2F3440' }}>
          {/* Photo : parallax (Fix 8 iter 3.1) + mask gradient fade-out (Fix 4 iter 3.5).
              Le mask est appliqué UNIQUEMENT sur la photo, pas sur les overlays
              (étoiles, nom, jersey, ticket) qui sont des frères dans le parent. */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translateY(${photoParallaxY}px)`,
              willChange: photoParallaxY !== 0 ? 'transform' : undefined,
              maskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 75%, transparent 100%)",
            }}
          >
            <AthletePhotoFill
              photoUrl={a.photoUrl}
              firstName={a.firstName}
              lastName={a.lastName}
              className="object-[center_15%]"
            />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2 z-[2]" style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, transparent 100%)' }} />
          <div className={`absolute bottom-4 left-4 z-[3]${isFree ? " select-none pointer-events-none blur-[5px]" : ""}`}>
            <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{isFree ? "Prénom" : a.firstName}</p>
            <p style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '0.04em', lineHeight: 1, textTransform: 'uppercase' }}>{isFree ? "Nom" : a.lastName}</p>
          </div>
        </div>

        {/* Ticket — Iter 7.11 Section 2.2 : z-[999] → z-[5]. Le z-[999] sur
            cet absolute (positioné dans PlayerCard) écrasait toute la pile
            sticky en haut quand la PlayerCard scrollait sous la TabBar : le
            ticket transparaissait à travers (visible "INTERCEPTIONS" + autres
            champs au-dessus de RAPPORT/ACADÉMIQUE/SPORTIF). z-[5] suffit pour
            le tenir au-dessus du contenu interne PlayerCard sans écraser la
            sticky tabs (z-30) ni la TopBar (z-40). */}
        <div className="nx-v30-ticket absolute z-[5] overflow-hidden" style={{ bottom: -14, right: -18, borderRadius: 4, border: '1.5px solid rgba(255,255,255,0.08)', transition: 'none' }}>
          <div className="flex" style={{ width: 290 }}>
            <div className="flex flex-col justify-between" style={{ background: '#1E2128', padding: '10px 12px 10px 14px', minWidth: 84, gap: 4 }}>
              {[
                { lbl: "Sport", val: sportDisplay },
                { lbl: "Pos", val: posAbbr || "—" },
                { lbl: "No.", val: a.jerseyNumber ? `#${a.jerseyNumber}` : "—" },
              ].map((r) => (
                <div key={r.lbl}>
                  <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 7, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', marginBottom: 1 }}>{r.lbl}</div>
                  <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.06em', lineHeight: 1 }}>{r.val}</div>
                </div>
              ))}
            </div>
            <div className="nx-v30-perf flex flex-col items-center justify-center" style={{ width: 12, background: '#E6E6E6', borderLeft: '1.5px dashed rgba(11,18,32,0.2)', borderRight: '1.5px dashed rgba(11,18,32,0.2)', gap: 3 }}>
              {[...Array(8)].map((_, i) => (
                <span key={i} className="flex-shrink-0" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(11,18,32,0.2)' }} />
              ))}
            </div>
            <div className="flex-1 flex flex-col justify-center" style={{ background: '#FFFFFF', padding: '10px 14px' }}>
              <div className="relative overflow-hidden" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 5 }}>
                {Array.from({ length: 5 }, (_, i) => {
                  const revealed = i < starsRevealed;
                  return (
                    <svg
                      key={i}
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill={ratingValue >= i + 1 ? "#F59E0B" : ratingValue >= i + 0.5 ? "#F59E0B" : "#D1D5DB"}
                      stroke="none"
                      style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? 'scale(1)' : 'scale(0.5)',
                        transformOrigin: 'center',
                        transition: 'opacity 220ms ease-out, transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  );
                })}
              </div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#1E2128', marginBottom: 2, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{a.isCivil
                ? (a.teamName || a.leagueName || "")
                : (a.schoolName || "").replace(/^École secondaire /i, "É.S. ").replace(/^École sec\. /i, "É.S. ")}</div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#9CA3AF', lineHeight: 1.2, whiteSpace: 'nowrap' as const }}>{a.region}</div>
              <div style={{ fontFamily: 'var(--font-outfit), sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#E63946', marginTop: 3 }}>Promotion {a.graduationYear}</div>
            </div>
            <div className="flex items-center justify-center flex-shrink-0" style={{ background: '#E63946', width: 22, writingMode: 'vertical-rl' as const, fontFamily: 'var(--font-outfit), sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.7)' }}>NEXUS</div>
          </div>
        </div>
      </motion.div>
    </div>
      {/* Sheen sweep overlay — same canon as AthletePlayerCard's animate
          prop. Confined to the 280-wide card body ; gradient sweep on
          nx-wow-sheen 4500ms infinite. pointer-events:none so taps reach
          the favorite-heart + status pills underneath. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            bottom: -20,
            width: 80,
            background:
              "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.32) 50%, transparent 70%)",
            animation: "nx-wow-sheen 4500ms ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

function FreeLock() {
  return (
    <div className="bg-white/[0.02] rounded-2xl border border-dashed border-white/10 px-6 py-10 flex flex-col items-center justify-center text-center">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <p className="text-[14px] text-[#9CA3AF] font-semibold mb-1">Réservé aux recruteurs Pro</p>
      <p className="text-[13px] text-[#6B7280] max-w-xs">Cette section est réservée aux recruteurs Pro.</p>
    </div>
  );
}

/** Avatar mini (56x56) pour la version Hero collapsed. */
function HeroMiniAvatar({ a, isFree }: { a: AthleteProfileRecruiterView; isFree: boolean }) {
  const badgeActive = a.isVerified && !isValidationExpired({ verified: !!a.isVerified, last_profile_validation: a.lastValidation ?? null });
  return (
    <div className="relative w-[56px] h-[56px] rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 bg-[#2F3440]">
      <AthletePhotoFill
        photoUrl={a.photoUrl}
        firstName={isFree ? "" : a.firstName}
        lastName={isFree ? "" : a.lastName}
        className={`object-[center_15%]${isFree ? " blur-[5px]" : ""}`}
      />
      {badgeActive && (
        <div className="absolute -bottom-1 -right-1 w-[20px] h-[20px] rounded-full bg-[#111317] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6"><path d="M12 2L4 5v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V5l-8-3z"/><path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
    </div>
  );
}

/** Rangée de badges adaptative — NO horizontal scroll. Layout par
 *  count (N = 1..5) :
 *    1 → un badge centré, taille "lg" pour une présence
 *    2 → deux centrés, espacés
 *    3 → trois centrés, distribution régulière
 *    4 → quatre centrés, distribution serrée pour remplir la ligne
 *    5 → deux rangées (3 en haut, 2 en bas), chacune centrée
 *  La hauteur du bloc grandit naturellement pour N=5 (pas de clipping).
 *  L'animation pop par badge (cascade via badgesRevealed) est préservée.
 */
function BadgesRow({
  distinctions,
  mounted,
  badgesRevealed,
}: {
  distinctions: { badge: string; detail?: string }[];
  mounted: boolean;
  badgesRevealed: number;
}) {
  // Layout extracted to components/shared/badges/AdaptiveBadgesRow.
  // The shared component owns the reveal wrapper + the 1/2/3/4/5
  // adaptive geometry verbatim ; the athlete-side renderItem
  // continues to draw DistinctionBadge. Output is byte-identical to
  // the previous private implementation.
  return (
    <AdaptiveBadgesRow
      items={distinctions}
      mounted={mounted}
      badgesRevealed={badgesRevealed}
      maxBadges={MAX_BADGES}
      renderItem={(d, _i, sizeHint) => (
        <DistinctionBadge badge={d.badge} detail={d.detail} size={sizeHint} />
      )}
    />
  );
}

/** Tab bar 3 onglets + indicateur rouge glissant (style MobileTabBar). */
function TabBar({ activeTab, onChange }: { activeTab: TabKey; onChange: (k: TabKey) => void }) {
  const activeIndex = TABS.findIndex((t) => t.key === activeTab);
  // Iter 7.10 Section 2 — bg-[#111317]/95 backdrop-blur-md → bg-[#111317]
  // plein. Le backdrop-blur sur élément sticky bug sur iOS WebView et
  // crée une ligne fine perceptible + 5% de transparence. Wrapper externe
  // déjà bg-[#111317] plein, on aligne le TabBar interne pour cohérence.
  return (
    <div className="relative bg-[#111317]">
      <div className="flex">
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`flex-1 h-12 flex items-center justify-center text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${
                isActive ? "text-[#E63946]" : "text-[#6b7280] active:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Sliding indicator — Iter 7.8b Section B : underline centré, ~50%
          de la largeur de chaque tab (au lieu de 80%), centré sous le label
          via mx-auto. Plus propre visuellement. */}
      <div
        className="absolute bottom-0 left-0 h-[2px] w-1/3 flex justify-center"
        style={{
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform 280ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      >
        <div className="w-[50%] h-full bg-[#E63946] rounded-full" />
      </div>
    </div>
  );
}

/** Rangée flat (label gauche / valeur droite) — style iOS Settings, sans bg-card. */
function FlatRow({ label, value, icon }: { label: string; value?: string | number | null; icon?: string }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className={mobileRow}>
      <span className="text-[15px] text-[#9CA3AF] flex items-center gap-2">
        {icon && <NxIcon name={icon} size={14} className="text-[#6B7280]" />}
        {label}
      </span>
      <span className="text-[16px] font-bold text-white text-right">{value}</span>
    </div>
  );
}

/** Count-up animation hook (Fix 2 iter 3.5).
    Anime de oldValue → targetValue avec ease-out cubic via RAF.
    Re-trigger si targetValue change (utile au pull-to-refresh).
    Si targetValue <= 0 : skip, retourne 0 direct. */
function useCountUp(targetValue: number, duration = 800, startDelay = 600): number {
  const [display, setDisplay] = useState(0);
  const prevTargetRef = useRef(0);
  useEffect(() => {
    if (targetValue <= 0) { setDisplay(targetValue); prevTargetRef.current = targetValue; return; }
    const from = prevTargetRef.current;
    const to = targetValue;
    if (from === to) return;
    let rafId = 0;
    let startTime = 0;
    const startTimeout = window.setTimeout(() => {
      const step = (t: number) => {
        if (!startTime) startTime = t;
        const elapsed = t - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setDisplay(Math.round(from + (to - from) * eased));
        if (progress < 1) rafId = window.requestAnimationFrame(step);
        else prevTargetRef.current = to;
      };
      rafId = window.requestAnimationFrame(step);
    }, startDelay);
    return () => {
      window.clearTimeout(startTimeout);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [targetValue, duration, startDelay]);
  return display;
}

/* ═══════════════════════════════════════════════════════════════
   StatusVisitSheet — bottom sheet « Changer le statut » (design BP,
   remplace le dropdown cassé qui débordait hors écran).

   Même chrome que PipelineDetailSheet (RecruteurPipelineMobile) : overlay
   + panneau bas arrondi portalé + safe-area + drag-to-close. Contenu :
     (a) les statuts en BOUTONS (grille, une couleur par statut) ;
     (b) une SECTION VISITE quand le statut courant est VISITE_PLANIFIEE :
         mini date-picker (VisitDateEditor → visit_at) + VisitCalendarCard
         réutilisé pour l'ajout à l'agenda.

   Présentationnel : l'écriture (statut + visit_at) reste chez le parent
   (persistPipelineStage — chemin unique côté fiche).
═══════════════════════════════════════════════════════════════ */

// Une couleur par statut (hiérarchie recrutement CLAUDE.md) — dot toujours
// coloré, l'état actif renforce fond + bordure dans la même teinte.
const SHEET_STATUSES: { id: RecruitmentStatus; label: string; color: string }[] = [
  { id: "identifie",        label: "Identifié",        color: "#6B7280" }, // gris
  { id: "contacte",         label: "Contacté",         color: "#6366F1" }, // indigo
  { id: "en_discussion",    label: "En discussion",    color: "#F59E0B" }, // ambre
  { id: "visite_planifiee", label: "Visite planifiée", color: "#A855F7" }, // violet
  { id: "engage",           label: "Engagé",           color: "#3B82F6" }, // bleu
  { id: "lettre_signee",    label: "Lettre signée",    color: "#22C55E" }, // vert
];

function StatusVisitSheet({
  open, onClose, currentStatus, visitAtIso,
  athleteName, sport, schoolName,
  onSelectStatus, onSaveVisitDate, savingVisit = false,
}: {
  open: boolean;
  onClose: () => void;
  currentStatus: RecruitmentStatus;
  visitAtIso: string | null;
  athleteName: string;
  sport?: string;
  schoolName?: string;
  onSelectStatus: (next: RecruitmentStatus) => void;
  onSaveVisitDate: (iso: string | undefined) => void | Promise<void>;
  savingVisit?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!open) { setDragOffset(0); setIsDragging(false); } }, [open]);

  if (!mounted) return null;

  const closeSheet = () => { triggerHaptic("Light"); onClose(); };
  const isVisit = currentStatus === "visite_planifiee";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - dragOffset / 600 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[55] bg-black/60"
            onClick={closeSheet}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: dragOffset }}
            exit={{ y: "100%" }}
            transition={isDragging ? { duration: 0 } : { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
            // touchAction pan-y (#2) : verrouille le geste en vertical — le sheet
            // ne peut plus glisser gauche-droite (down = fermer uniquement).
            style={{ maxHeight: "90dvh", paddingBottom: "env(safe-area-inset-bottom)", touchAction: "pan-y" }}
          >
            {/* Handle iOS — drag area (swipe-down to close) */}
            <div
              onTouchStart={(e) => { setIsDragging(true); dragStartYRef.current = e.touches[0].clientY; }}
              onTouchMove={(e) => {
                if (dragStartYRef.current === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - dragStartYRef.current);
                setDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (dragOffset > 100) closeSheet();
                else setDragOffset(0);
                setIsDragging(false); dragStartYRef.current = 0;
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <div className="flex justify-center pt-3 pb-3">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
            </div>

            <button
              type="button"
              onClick={closeSheet}
              aria-label="Fermer"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:bg-white/5 z-10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {/* (a) Grille des statuts */}
              <div>
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-2">Changer le statut</h3>
                <div className="grid grid-cols-2 gap-2">
                  {SHEET_STATUSES.map((s) => {
                    const active = currentStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { triggerHaptic("Light"); onSelectStatus(s.id); }}
                        // Statut actif désactivé — évite qu'un re-tap de « Visite
                        // planifiée » ré-écrive le stage et efface la date saisie.
                        disabled={active}
                        aria-pressed={active}
                        className="flex items-center gap-2 py-3 px-3 rounded-2xl text-[12px] uppercase tracking-wider font-bold transition-colors border disabled:cursor-default"
                        style={
                          active
                            ? { backgroundColor: `${s.color}22`, borderColor: s.color, color: s.color }
                            : { backgroundColor: "#1A1D24", borderColor: "transparent", color: "#e0e0e0" }
                        }
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="truncate">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* (b) Section visite — seulement quand le statut courant est
                  VISITE_PLANIFIEE : poser/modifier la date + export agenda. */}
              {isVisit && (
                <div className="space-y-4 pt-1 border-t border-white/[0.06]">
                  <div>
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-3">Visite planifiée</h3>
                    <VisitDateEditor
                      visitAtIso={visitAtIso}
                      onSave={onSaveVisitDate}
                      saving={savingVisit}
                    />
                  </div>
                  {/* VisitCalendarCard réutilisé — gate strict : une date. */}
                  {visitAtIso && (
                    <VisitCalendarCard
                      visitAtIso={visitAtIso}
                      athleteName={athleteName}
                      sport={sport}
                      schoolName={schoolName}
                    />
                  )}
                </div>
              )}

              {/* Retiré — sortie du processus (supprime la row), style muet. */}
              <div className="pt-1 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => { triggerHaptic("Light"); onSelectStatus("retire"); }}
                  className="w-full py-3 rounded-2xl text-[12px] uppercase tracking-wider font-bold bg-[#1A1D24] text-[#9CA3AF] active:bg-white/[0.04] transition-colors"
                >
                  Retirer du processus
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */

export default function AthleteRecruiterProfileBodyMobile({ athleteId, viewerMode, viewer = "recruiter" }: Props) {
  // Iter 1 : on ne gère QUE viewerMode "recruiter" en mobile dédié.
  // Pour preview/partner, le PageClient route vers le desktop body.
  if (viewerMode !== "recruiter") return null;

  // Step 6 unification — viewer flag drives recruteur-only gates +
  // coach-only additions. Recruiter output MUST stay byte-identical.
  //
  // Sprint C : isSelfPreview is the athlete viewing their OWN profile via
  // /athlete/profil/apercu. Critical invariants :
  //   - isRecruiter stays FALSE → the 3 recruiter-scoped useEffects
  //     (favorites, pipeline, recruiter_athlete_views) auto-suppress
  //     via their existing `if (!isRecruiter) return;` early-returns.
  //     NEVER touch a recruiter-scoped table from an athlete session.
  //   - isCoach stays FALSE → coach alert stack + "Modifier le profil"
  //     CTA + SuggestionSheet do not render.
  //   - The recruiter-perspective athletes SELECT (line 600 useEffect)
  //     IS the canonical "how a recruiter sees this athlete" load — its
  //     gate is widened below to admit isSelfPreview. RLS-clean because
  //     the "athletes can read own profile" policy (USING user_id =
  //     auth.uid()) covers the own-row read independently of the
  //     recruiter-only verified/active policies.
  const isRecruiter = viewer === "recruiter";
  const isCoach = viewer === "coach";
  const isSelfPreview = viewer === "self-preview";

  const id = athleteId;
  const { maxFavorites, tier, loading: tierLoading } = useSubscription();
  const canMessageCoach = tier === "pro" || tier === "all_star";
  const canUsePipeline = tier === "pro" || tier === "all_star";
  // Iter 7.23 Sprint 4 — gating PRO pour custom_lists (cohérent avec FeatureGate
  // feature="custom_lists" requiredTier="pro" du desktop).
  const canCustomLists = tier === "pro" || tier === "all_star";
  // Sprint C : self-preview is the fully-revealed "Pro recruiter" perspective —
  // force isFreeRecruiter false so identityCols include first_name/last_name in
  // the load, and so the standalone isFreeRecruiter-gated blurs (name 1668,
  // photo 2050, coach comments 1909, PlayerCardMobile isFree prop 1654)
  // collapse cleanly. The athlete's own subscription tier (typically "free"
  // for athletes) would otherwise trigger free-tier blurs that lie about how
  // a recruiter sees them.
  const isFreeRecruiter = tier === "free" && !isSelfPreview;
  const { count: myFavCount, setCount: setMyFavCount } = useFavoritesCount();
  // #52 — init à null (plus de mock initial) : aucun faux athlète rendu avant
  // les vraies données. Le gate loadingAthlete plus bas court-circuite le rendu.
  const { data: currentUser } = useCurrentUser();
  const currentUserId = currentUser?.authUser.id;
  const [a, setA] = useState<AthleteProfileRecruiterView | null>(null);
  const [loadingAthlete, setLoadingAthlete] = useState(true);
  const [recruitmentStatus, setRecruitmentStatus] = useState<GlobalRecruitmentStatus>("OUVERT");
  const [committedSchoolName, setCommittedSchoolName] = useState("");
  const [openToOffers, setOpenToOffers] = useState<boolean | null>(null);
  const [myPipelineStage, setMyPipelineStage] = useState<string | null>(null);
  const [visitAt, setVisitAt] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [isAllStar, setIsAllStar] = useState(false);

  const [affiliation, setAffiliation] = useState<"school" | "civil_with_team" | "civil_no_team">("school");
  const [civilTeamInfo, setCivilTeamInfo] = useState<{
    teamName: string;
    leagueName: string;
    ageGroup: string | null;
    division: string | null;
    coaches: string[];
  } | null>(null);
  // Generalized list of teams for the bottom-of-Sportif TeamDetailsBlock —
  // populated for ALL athletes (école + civil), derived from
  // team_athletes → teams join. Replaces the civil-only "Équipe civile"
  // block that used to live in the Académique tab.
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

  // Step 6 unification — coach reload trigger + pending suggestions state.
  // Used only when viewer === "coach"; harmless React state otherwise.
  const [coachReloadVersion, setCoachReloadVersion] = useState(0);
  const [pendingSuggestions, setPendingSuggestions] = useState<PendingSuggestion[]>([]);

  /* ── Fetch athlète (copié du desktop) ──
     Step 6 unification : branche coach en haut de useEffect. Si viewer ===
     "coach", on utilise loadAthleteRaw + mapToRecruiterView (data path coach),
     plus une query séparée pour pendingSuggestions. La branche recruteur
     reste IDENTIQUE byte-pour-byte (en-dessous). */
  useEffect(() => {
    if (!isCoach) return;
    // #52 — id placeholder (Capacitor static export, premier render avant
    // résolution du vrai id) : ne pas fetcher un faux id, rester en loading.
    if (id === "placeholder") return;
    let cancelled = false;
    (async () => {
      const { data, error } = await loadAthleteRaw(id);
      if (cancelled) return;
      if (error || !data) {
        console.error("[ProfileBody coach] load failed:", error?.message);
        setLoadingAthlete(false);
        return;
      }
      const mapped = mapToRecruiterView(data as Record<string, unknown>);
      setA(mapped);
      // Lecture first-class : mapToRecruiterView porte maintenant les 2
      // champs (fix : ils étaient droppés, badge tombait toujours sur
      // "OUVERT" même pour des athlètes recrutés).
      setRecruitmentStatus((mapped.recruitmentStatus as GlobalRecruitmentStatus | undefined) || "OUVERT");
      setCommittedSchoolName(mapped.committedSchoolName || "");
      // open_to_offers volontairement NON câblé côté coach (legacy) :
      // la state `openToOffers` reste à null → le badge n'affiche pas la
      // sous-ligne "Ouvert/Fermé aux offres" (guard interne du badge :
      // openToOffers !== null && openToOffers !== undefined). One pill,
      // recruitment_status seul. Le branche recruteur (plus bas) continue
      // de la setter depuis raw → l'output recruteur reste identique.
      // Suggestions en attente pour cet athlète (SuggestionsAlert).
      const supabase = createClient();
      const { data: sugs } = await supabase
        .from("athlete_suggestions")
        .select("id, champ, valeur_actuelle, valeur_proposee, message, created_at")
        .eq("athlete_id", id)
        .eq("status", "EN_ATTENTE")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setPendingSuggestions(
        (sugs ?? []).map((s) => ({
          id: s.id as string,
          champ: (s.champ as string) ?? "",
          valeur_actuelle: (s.valeur_actuelle as string) ?? "",
          valeur_proposee: (s.valeur_proposee as string) ?? "",
          message: (s.message as string) ?? "",
          created_at: (s.created_at as string) ?? "",
        })),
      );
      setLoadingAthlete(false);
    })();
    return () => { cancelled = true; };
  }, [id, isCoach, coachReloadVersion]);

  useEffect(() => {
    // Sprint C : self-preview shares this canonical recruiter-perspective
    // load. The athletes SELECT runs under the "athletes can read own
    // profile" RLS policy when the caller is the athlete themselves
    // (USING user_id = auth.uid()), so no recruiter-role privilege is
    // required — the same SELECT + joins resolves cleanly. isFreeRecruiter
    // is forced false above for self-preview, so identityCols always
    // include first_name/last_name in this branch.
    if (!isRecruiter && !isSelfPreview) return;
    if (tierLoading) return;
    // #52 — id placeholder (Capacitor) : pas de fetch faux id, rester en loading.
    if (id === "placeholder") return;
    const supabase = createClient();
    const identityCols = isFreeRecruiter ? "" : "first_name, last_name,";
    supabase
      .from("athletes")
      .select(`
        id, user_id, ${identityCols}
        photo_url, verified, profile_completion, last_profile_validation,
        numero_jersey, annee_diplomation, date_naissance, genre,
        video_faits_saillants_url, hudl_url, youtube_url, instagram_url,
        video_match_complet_url, video_entrainement_url,
        moyenne_generale, matieres_fortes, mentions_academiques,
        programme_cegep_vise, ouvert_cegep_prive, ouvert_cegep_anglophone,
        pret_changer_region, regions_cegep_preferees,
        taille_pieds, taille_pouces, poids_lbs, envergure, taille_mains,
        main_dominante, pied_dominant,
        test_40_verges, saut_vertical, saut_longueur, developpe_couche, navette_agilite, sprint_100m,
        bio, cote_globale_entraineur, consentement_parental,
        statut_recrutement_override, notes_coach, ouvert_entraineur_cegep,
        coach_id, recruitment_status, committed_school_id, open_to_offers,
        parcours_equipes, school_id,
        sports!athletes_sport_id_fkey(nom),
        positions!athletes_position_id_fkey(nom, abreviation),
        schools!school_id(name, region, city, type),
        committed_school:schools!committed_school_id(name),
        team_athletes(teams!team_id(id, name, league, age_group, division, gender, season, is_active, sport_id, sports!sport_id(nom), schools!school_id(id, name, type))),
        evaluations(
          vitesse_explosivite, force_puissance, endurance_cardio, agilite_coordination,
          vision_du_jeu, sens_tactique,
          leadership, discipline, coachabilite, intelligence_jeu,
          competitivite, esprit_equipe, resilience, attitude_mentalite,
          cote_globale, rapport_entraineur, distinctions, updated_at, coach_id,
          evaluator:users!evaluations_coach_id_fkey(first_name, last_name)
        ),
        users!athletes_coach_id_fkey(first_name, last_name)
      ` as unknown as "*")
      .eq("id", id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoadingAthlete(false); return; }

        const d = data as Record<string, unknown>;
        setAthleteUserId((d.user_id as string | null) ?? null);
        const evals = d.evaluations as Record<string, unknown>[] | null;
        // Pick by rule (détaillée > simple, then most recent updated_at) —
        // NOT evaluations[0] (unordered, often a non-owning coach's row).
        const eval0 = selectBestEvaluation(evals);

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

        const schoolRel = Array.isArray(d.schools) ? d.schools[0] : d.schools;
        const school = schoolRel as { name: string; region: string; city: string; type: string } | null;

        const birthDate = d.date_naissance as string | null;
        const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

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
          teamHistory: parseTeamHistory(d.parcours_equipes),
          isCivil: !d.school_id || school?.type === "LIGUE_CIVILE",
          schoolName: (() => {
            if (!d.school_id) return "";
            if (school?.type === "LIGUE_CIVILE") return "";
            return school?.name || "";
          })(),
          teamName: (() => {
            const civil = !d.school_id || school?.type === "LIGUE_CIVILE";
            if (!civil) return undefined;
            const taRel = d.team_athletes as unknown;
            const taArr = Array.isArray(taRel) ? taRel : taRel ? [taRel] : [];
            const firstTa = taArr[0] as Record<string, unknown> | null;
            const teamRel = firstTa ? (Array.isArray(firstTa.teams) ? firstTa.teams[0] : firstTa.teams) : null;
            return (teamRel as { name?: string } | null)?.name;
          })(),
          leagueName: (() => {
            const civil = !d.school_id || school?.type === "LIGUE_CIVILE";
            if (!civil) return undefined;
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
          // #1 latest-wins : la colonne dénormalisée cote_globale_entraineur est
          // le last-write (lisible par tous) → elle prime sur eval0 (que la RLS
          // scope à la ligne du coach courant, d'où le 4.6 vu par le coach).
          overallRating: (d.cote_globale_entraineur as number) ?? (eval0?.cote_globale as number) ?? 0,
          // #1 attribution : l'évaluateur de l'éval retenue (post-RLS élargie, ça
          // peut être le directeur). Le rendu affiche « Évaluée par {nom} » quand
          // ce n'est pas le coach qui regarde.
          evaluatorCoachId: (eval0?.coach_id as string) || null,
          evaluatorName: ((): string | null => {
            const evRaw = eval0?.evaluator;
            const ev = (Array.isArray(evRaw) ? evRaw[0] : evRaw) as { first_name?: string; last_name?: string } | null;
            return ev ? (`${ev.first_name || ""} ${ev.last_name || ""}`.trim() || null) : null;
          })(),
          traitRatings: traitRatings as AthleteProfileRecruiterView["traitRatings"],
          distinctions: parseDistinctions(eval0?.distinctions),
          favoriteCount: 0,
          viewsThisMonth: 0,
        };

        setA(mapped);
        setCoachId((d.coach_id as string) || null);

        const schoolId = d.school_id as string | null;
        if (!schoolId) {
          setAffiliation("civil_no_team");
          setCivilTeamInfo(null);
        } else if (school?.type !== "LIGUE_CIVILE") {
          setAffiliation("school");
          setCivilTeamInfo(null);
        } else {
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
        // sort happen INSIDE TeamDetailsBlock (single source of truth for
        // ordering across both bodies).
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
  }, [id, isFreeRecruiter, tierLoading, isRecruiter, isSelfPreview]);

  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const effectiveMode: "simple" | "detailed" = mode;
  const isDetailed = effectiveMode === "detailed";

  const [isFavorited, setIsFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  // Ex-favBurst state retiré en iter 5.4 — animation gérée par HeartButton.

  // Pull-to-refresh (Fix 5 iter 3.1)
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const PULL_THRESHOLD = 80;

  // Modal swipe-down dismiss (Fix 2 iter 3.2)
  const [modalDragOffset, setModalDragOffset] = useState(0);
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  // Fade-out skeleton (Fix 3 iter 3.2)
  const [skeletonVisible, setSkeletonVisible] = useState(true);
  const router = useRouter();

  // Action Sheet menu 3-points (Fix 3 iter 3.5)
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionSheetDragOffset, setActionSheetDragOffset] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  // Bottom action bar hide-on-scroll-down (Fix 6 iter 3.5)
  const [actionBarVisible, setActionBarVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  // KPI count-up display values (Fix 2 iter 3.5)
  const viewCountDisplay = useCountUp(viewCount);
  const favCountDisplay = useCountUp(favCount);

  // États modal Signaler — remontés ici pour résoudre l'ordre de déclaration
  // (iter 3.2). Le useEffect modal reset les utilise plus bas dans le même bloc.
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagDetails, setFlagDetails] = useState("");
  const [flagSubmitted, setFlagSubmitted] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [athleteUserId, setAthleteUserId] = useState<string | null>(null);
  // Iter 7.8e-UI Section D — état du tap "Contacter le coach" (find or create
  // conversation puis navigate vers le thread mobile, plus le composer email).
  const [contactingCoach, setContactingCoach] = useState(false);
  // Iter 7.23 Sprint 4 — état du sheet "Ajouter à une liste".
  const [addToListOpen, setAddToListOpen] = useState(false);
  // Toast unifié Dynamic Island (iter 4.0) — remplace l'ex-flagSuccessToast local
  const toast = useMobileToast();

  // Step 6 unification — coach action sheet / sheet state.
  const [sheetSuggestion, setSheetSuggestion] = useState<PendingSuggestion | null>(null);
  const [coachRejectingId, setCoachRejectingId] = useState<string | null>(null);
  const [coachRejectReason, setCoachRejectReason] = useState("");

  const coachReload = useCallback(() => setCoachReloadVersion((v) => v + 1), []);

  const coachConfirmConsent = useCallback(async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("athletes")
      .update({ consentement_parental: true, consentement_parental_date: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error({ message: "Erreur de confirmation" });
      return;
    }
    triggerHaptic("Medium");
    toast.success({ message: "Consentement parental confirmé" });
    coachReload();
  }, [id, coachReload, toast]);

  const coachVerify = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("athletes")
      .update({
        verified: true,
        verification_method: "manuel_coach",
        verified_at: nowIso,
        verified_by: user.id,
        last_profile_validation: nowIso,
        // Re-pose symétrique : on efface le flag « modifié depuis vérif »
        // pour que l'athlète sorte de la file « À traiter » (cf. lib/coach/tasks).
        modified_since_verification: false,
      })
      .eq("id", id);
    if (error) {
      toast.error({ message: "Erreur de vérification" });
      return;
    }
    triggerHaptic("Medium");
    toast.success({ message: "Athlète vérifié" });
    coachReload();
  }, [id, coachReload, toast]);

  const coachApprove = useCallback(async (suggestionId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("athlete_suggestions")
      .update({ status: "APPROUVEE" })
      .eq("id", suggestionId);
    if (error) {
      toast.error({ message: "Erreur d'approbation" });
      return;
    }
    toast.success({ message: "Suggestion approuvée" });
    setSheetSuggestion(null);
    setCoachRejectingId(null);
    setCoachRejectReason("");
    coachReload();
  }, [coachReload, toast]);

  const coachReject = useCallback(async (suggestionId: string, reason: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("athlete_suggestions")
      .update({ status: "REJETEE", raison_rejet: reason || null })
      .eq("id", suggestionId);
    if (error) {
      toast.error({ message: "Erreur de rejet" });
      return;
    }
    toast.success({ message: "Suggestion rejetée" });
    setSheetSuggestion(null);
    setCoachRejectingId(null);
    setCoachRejectReason("");
    coachReload();
  }, [coachReload, toast]);

  // Adapter PendingSuggestion → CoachTaskSuggestion pour SuggestionSheet.
  const sheetCoachTask: CoachTaskSuggestion | null = sheetSuggestion
    ? {
        id: sheetSuggestion.id,
        athleteId: id,
        athleteName: a ? `${a.firstName} ${a.lastName}`.trim() : "",
        champ: sheetSuggestion.champ,
        valeurActuelle: sheetSuggestion.valeur_actuelle || null,
        valeurProposee: sheetSuggestion.valeur_proposee,
        message: sheetSuggestion.message || null,
        createdAt: sheetSuggestion.created_at,
      }
    : null;

  const handleContactCoach = useCallback(async () => {
    if (!coachId || !a || contactingCoach) return;
    triggerHaptic("Medium");
    setContactingCoach(true);
    const result = await findOrCreateRecruiterConversation({ coachId, athleteId: a.id });
    if (result.ok) {
      router.push(`/recruteur/messages?id=${result.conversationId}`);
      return;
    }
    setContactingCoach(false);
    if (result.tierDenial) {
      toast.error({ message: "Pro requis", detail: "L'envoi de messages nécessite un abonnement Pro." });
    } else {
      toast.error({ message: "Échec", detail: result.error || "Impossible d'ouvrir la conversation." });
    }
  }, [coachId, contactingCoach, a?.id, router, toast]);

  // Rapport coach expandable (Fix 3 iter 2.8) — clamp à 3 lignes par défaut
  // si la citation dépasse 150 caractères. Bouton "Lire la suite / Réduire".
  const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);
  const SHORT_QUOTE_THRESHOLD = 150;

  // Hero collapse + animation cascade au mount (iter 2.6)
  const [activeTab, setActiveTab] = useState<TabKey>("rapport");
  const [mounted, setMounted] = useState(false);
  // Iter 6.0c — initial à true pour ne pas conflicter avec le shared element
  // morph (motion.div layoutId) qui arrive depuis la card de Recherche. La
  // transition opacity/scale du cardRevealed jouait pendant les 350ms du
  // morph et faisait scintiller le hero. La cascade (stars/name/badges)
  // tourne toujours via les autres setStateRevealed plus bas.
  const [cardRevealed, setCardRevealed] = useState(true);
  const [photoReady, setPhotoReady] = useState(false);
  const [starsRevealed, setStarsRevealed] = useState(0);
  const [nameRevealed, setNameRevealed] = useState(false);
  const [badgesRevealed, setBadgesRevealed] = useState(0);
  const [essentialsRevealed, setEssentialsRevealed] = useState(false);
  const [tabFadeKey, setTabFadeKey] = useState(0);

  // Slide sans chevauchement (Fix 1 iter 2.9).
  // Découpage en 2 sous-phases : (A) HeroExpanded glisse vers le haut et
  // sort COMPLÈTEMENT avant que (B) HeroCollapsed ne descende depuis le
  // haut. À aucun moment les 2 versions ne sont visibles ensemble.
  // scrollY mis à jour via RAF — le slide est piloté par transform/opacity
  // (pas de transition CSS, c'est l'état React qui drive chaque frame).
  const SCROLL_START = 80;
  const SCROLL_END = 200;
  const EXPANDED_SLIDE_DISTANCE = 1200; // px à monter pour sortir le hero étendu complètement
  // ↑ ajusté en iter 3.0 : le hero étendu fait ~800px (card 400 + name 60 +
  // status 50 + pipeline 66 + KPIs 104 + badges 74 + paddings). Avec 600,
  // les badges restaient encore visibles à progress=0.5. 1200 garantit que
  // toute la zone est hors-écran y compris pour futures additions de contenu.
  // HERO_LAYOUT_HEIGHT (iter 3.3) — plafond du marginBottom négatif. Doit
  // correspondre à la hauteur RÉELLE de flux du hero étendu (~800px), pas à
  // la distance de slide visuelle. Sinon le doc se rétracte trop et bloque
  // le scroll jusqu'au bas du tab content.
  const HERO_LAYOUT_HEIGHT = 800;
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let lastScrollY = 0;
    let ticking = false;
    const onScroll = () => {
      lastScrollY = window.scrollY || window.pageYOffset || 0;
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          setScrollY(lastScrollY);
          // Fix 6 iter 3.5 — hide-on-scroll-down de l'action bar.
          // Hide si on descend après le hero (>200), show si on remonte ou
          // si on est proche du top (<100). Comparaison via ref pour éviter
          // les setState parasites quand la valeur ne change pas.
          const prev = lastScrollYRef.current;
          if (lastScrollY < 100) {
            setActionBarVisible((v) => v ? v : true);
          } else if (lastScrollY > prev && lastScrollY > 200) {
            setActionBarVisible((v) => v ? false : v);
          } else if (lastScrollY < prev) {
            setActionBarVisible((v) => v ? v : true);
          }
          lastScrollYRef.current = lastScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Top bar dynamic blur (Fix 1 iter 3.5) — true dès scrollY > 20
  const topBarScrolled = scrollY > 20;

  const transitionProgress = Math.max(0, Math.min(1, (scrollY - SCROLL_START) / (SCROLL_END - SCROLL_START)));
  // Phase A : HeroExpanded glisse vers le haut sur la première moitié (progress 0 → 0.5)
  // Phase B : HeroCollapsed glisse depuis le haut sur la seconde moitié (progress 0.5 → 1.0)
  const expandedSlideProgress = Math.max(0, Math.min(1, transitionProgress * 2));
  const collapsedSlideProgress = Math.max(0, Math.min(1, (transitionProgress - 0.5) * 2));

  const expandedTranslateY = -expandedSlideProgress * EXPANDED_SLIDE_DISTANCE;
  // expandedLayoutCollapse (Fix iter 3.3) — découplé du translateY visuel.
  // Plafonné à HERO_LAYOUT_HEIGHT pour éviter de retirer plus d'espace de flux
  // que le hero n'en occupe naturellement → préserve la hauteur scrollable.
  const expandedLayoutCollapse = -expandedSlideProgress * HERO_LAYOUT_HEIGHT;
  const expandedOpacity = expandedSlideProgress >= 1 ? 0 : 1; // binaire : visible jusqu'à totalement sorti
  const collapsedTranslateY = (1 - collapsedSlideProgress) * -80;
  const collapsedOpacity = collapsedSlideProgress > 0 ? 1 : 0; // binaire : visible dès que ça entre
  const collapsedActive = collapsedSlideProgress > 0;
  // alias pour compat avec le reste du code (anciens noms iter 2.6/2.8)
  const isCollapsed = collapsedActive;
  const isCollapsedActive = collapsedActive;

  // Photo preload (Fix 2) — déclenche photoReady quand l'image est en cache navigateur
  useEffect(() => {
    if (!a?.photoUrl) { setPhotoReady(true); return; }
    setPhotoReady(false);
    const img = new window.Image();
    img.onload = () => setPhotoReady(true);
    img.onerror = () => setPhotoReady(true); // fail-open : on n'attend pas indéfiniment
    img.src = a.photoUrl;
    // safety timeout 2s
    const t = window.setTimeout(() => setPhotoReady(true), 2000);
    return () => { window.clearTimeout(t); img.onload = null; img.onerror = null; };
  }, [a?.photoUrl]);

  // Mount cascade (Fix 2) — attend photoReady, puis cascade : card → étoiles → nom → badges → essentials
  useEffect(() => {
    if (loadingAthlete) return;
    if (!photoReady) return;
    setMounted(true);
    const distinctionsCount = Math.min(a?.distinctions?.length ?? 0, MAX_BADGES);
    const timers: number[] = [];
    // T+16 ms — card reveal (laisse le rendu initial se faire)
    timers.push(window.setTimeout(() => setCardRevealed(true), 16));
    // T+350-550 ms — 5 étoiles (50ms écart)
    for (let i = 1; i <= 5; i++) {
      timers.push(window.setTimeout(() => setStarsRevealed(i), 350 + i * 50));
    }
    // T+650 ms — nom fade-up
    timers.push(window.setTimeout(() => setNameRevealed(true), 650));
    // T+800 ms + 80ms/badge
    for (let i = 1; i <= distinctionsCount; i++) {
      timers.push(window.setTimeout(() => setBadgesRevealed(i), 800 + i * 80));
    }
    // T+1000 ms — essentials
    timers.push(window.setTimeout(() => setEssentialsRevealed(true), 1000));
    return () => { timers.forEach((t) => window.clearTimeout(t)); };
  }, [loadingAthlete, photoReady, a?.distinctions?.length]);

  // Fade-in du contenu de tab à chaque switch + haptic (Fix 7 iter 3.1)
  const handleTabChange = (k: TabKey) => {
    triggerHaptic("Light");
    setActiveTab(k);
    setTabFadeKey((v) => v + 1);
  };

  // Mode toggle Simplifié/Détaillé avec haptic (Fix 7 iter 3.1)
  const handleModeChange = (m: "simple" | "detailed") => {
    triggerHaptic("Light");
    setMode(m);
  };

  // Reset offset modal à chaque fermeture (Fix 2 iter 3.2)
  useEffect(() => {
    if (!showFlagModal) {
      setModalDragOffset(0);
      setIsDraggingModal(false);
    }
  }, [showFlagModal]);

  // Reset offset action sheet à chaque fermeture (Fix 3 iter 3.5)
  useEffect(() => {
    if (!showActionSheet) {
      setActionSheetDragOffset(0);
      setIsDraggingSheet(false);
    }
  }, [showActionSheet]);

  // Skeleton fade-out 200ms après fin du loading (Fix 3 iter 3.2)
  useEffect(() => {
    if (!loadingAthlete) {
      const t = window.setTimeout(() => setSkeletonVisible(false), 200);
      return () => window.clearTimeout(t);
    }
    setSkeletonVisible(true);
  }, [loadingAthlete]);

  const favAtCap = maxFavorites !== -1 && myFavCount >= maxFavorites;
  const favButtonDisabled = favAtCap && !isFavorited;
  const favDisabledTitle = `Limite de ${maxFavorites} favoris atteinte — favoris illimités réservés aux membres Pro.`;

  const toggleFav = async () => {
    if (favButtonDisabled) return;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const userId = session.user.id;
    const { data: existing } = await supabase
      .from("recruiter_favorites").select("id")
      .eq("recruiter_id", userId).eq("athlete_id", id).maybeSingle();
    if (existing) {
      await supabase.from("recruiter_favorites").delete().eq("id", existing.id);
      setIsFavorited(false);
      setMyFavCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("recruiter_favorites").insert({ recruiter_id: userId, athlete_id: id });
      setIsFavorited(true);
      setMyFavCount((c) => c + 1);
      // Haptic + scale animation gérés par HeartButton (iter 5.4) — pas de burst
      triggerHaptic("Medium");
    }
  };

  // ── "Contacter l'athlète" (RECRUTEUR_ATHLETE) — favorite-first gate ──
  const [contactingAthlete, setContactingAthlete] = useState(false);
  const [showFavContactPrompt, setShowFavContactPrompt] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);

  const openAthleteThread = useCallback(async () => {
    if (!a) return;
    setContactingAthlete(true);
    const res = await findOrCreateRecruiterAthleteConversation(a.id);
    if (res.ok) { router.push(`/recruteur/messages?id=${res.conversationId}`); return; }
    setContactingAthlete(false);
    setShowFavContactPrompt(false);
    toast.error({ message: "Échec", detail: res.error || "Impossible d'ouvrir la conversation." });
  }, [a?.id, router, toast]);

  const handleContactAthlete = useCallback(() => {
    if (favButtonDisabled || contactingAthlete) return;
    triggerHaptic("Medium");
    if (isFavorited) { void openAthleteThread(); return; }
    setShowFavContactPrompt(true);
  }, [favButtonDisabled, contactingAthlete, isFavorited, openAthleteThread]);

  const favoriteAndContact = useCallback(async () => {
    await toggleFav();
    await openAthleteThread();
  }, [openAthleteThread]);

  useEffect(() => {
    // Recruiter-only — recruiter_favorites RLS scopes to the row owner,
    // so a coach query returns 0 rows silently (no error) but the
    // resulting setIsFavorited(false) is moot for coach (heart UI is
    // already gated behind isRecruiter). Skip to avoid wasted queries
    // and keep the recruiter-tables call surface coach-free.
    if (!isRecruiter) return;
    const checkFav = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("recruiter_favorites").select("id").eq("recruiter_id", session.user.id).eq("athlete_id", id).maybeSingle();
      setIsFavorited(!!data);
    };
    checkFav();
  }, [id, isRecruiter]);

  useEffect(() => {
    // Recruiter-only — same rationale as checkFav above.
    if (!isRecruiter) return;
    const loadPipeline = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: pipelineData } = await supabase
        .from("recruiter_pipeline").select("stage, visit_at")
        .eq("recruiter_id", session.user.id).eq("athlete_id", id).maybeSingle();
      setMyPipelineStage(pipelineData?.stage || null);
      setVisitAt((pipelineData?.visit_at as string | null) ?? null);
      // Dropdown piloté par la DB, plus par getAthleteTracking() (mock).
      if (pipelineData?.stage) {
        setPipelineStatus(String(pipelineData.stage).toLowerCase() as RecruitmentStatus);
      }
    };
    loadPipeline();
  }, [id, isRecruiter]);

  useEffect(() => {
    // Recruiter-only side-effect (RLS : recruiters manage own
    // recruiter_athlete_views rows). A coach session would get RLS-denied
    // here, which is what produced "[recordView] failed: {}" after the
    // viewer unification — the policy redacts the error fields so the
    // object stringifies to `{}`. Coach must not record a recruiter view.
    if (!isRecruiter) return;
    const recordView = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("recruiter_athlete_views")
        .upsert(
          { recruiter_id: user.id, athlete_id: id, viewed_at: new Date().toISOString() },
          { onConflict: "recruiter_id,athlete_id,view_date" },
        );
      if (error) console.error("[recordView] failed:", error);
    };
    recordView();
  }, [id, isRecruiter]);

  useEffect(() => {
    if (!coachId) return;
    const loadReputation = async () => {
      const supabase = createClient();
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

  // #52 — ne pas matérialiser un objet partiel quand a est null (sinon le
  // gate !a serait contourné). Fusion du compteur seulement sur a chargé.
  useEffect(() => { setA(prev => (prev ? { ...prev, favoriteCount: favCount } : prev)); }, [favCount]);

  // Pull-to-refresh (Fix 1 iter 3.2) — passive partout, jamais preventDefault.
  // Early-exit si modal Signaler ouvert (sinon document.touchstart vole les
  // taps du modal et bloque le scroll natif).
  useEffect(() => {
    let startY = 0;
    let currentDistance = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (showFlagModal) return;
      if ((window.scrollY || 0) === 0) {
        startY = e.touches[0].clientY;
      } else {
        startY = 0;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (showFlagModal) return;
      if ((window.scrollY || 0) !== 0) return;
      if (startY === 0) return;
      currentDistance = Math.max(0, Math.min(e.touches[0].clientY - startY, 120));
      setPullDistance(currentDistance);
      setIsPulling(currentDistance > 0);
    };
    const onTouchEnd = async () => {
      if (showFlagModal) return;
      if (currentDistance >= PULL_THRESHOLD && !isRefreshing) {
        setIsRefreshing(true);
        triggerHaptic("Medium");
        const supabase = createClient();
        const [favRes, viewRes] = await Promise.all([
          supabase.rpc("count_athlete_favorites", { athlete_uuid: id }),
          supabase.rpc("count_athlete_views", { athlete_uuid: id }),
        ]);
        setFavCount((favRes.data as number) ?? 0);
        setViewCount((viewRes.data as number) ?? 0);
        window.setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setIsPulling(false);
        }, 600);
      } else {
        setPullDistance(0);
        setIsPulling(false);
      }
      startY = 0;
      currentDistance = 0;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [id, isRefreshing, showFlagModal]);

  const initialTracking = getAthleteTracking(id);
  const [pipelineStatus, setPipelineStatus] = useState<RecruitmentStatus>(initialTracking?.status || "none");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // Bottom sheet « Changer le statut » (remplace StatusChangeDropdown).
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);

  /* Stage désormais PERSISTÉ (avant : state local → perdu au refresh).
     Optimiste, rollback si Postgres refuse (RLS Free → user_has_pro()). */
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
      toast.error({
        message: res.reason === "pro_required"
          ? "Fonctionnalité Pro"
          : "Statut non enregistré",
        detail: res.reason === "pro_required"
          ? "Passe à Pro pour gérer ton processus."
          : undefined,
      });
      return;
    }

    setMyPipelineStage(newStatus === "retire" ? null : newStatus.toUpperCase());
  }

  /* Sélection d'un statut depuis le bottom sheet. Réplique la sémantique du
     StatusChangeDropdown desktop :
       - Contacté depuis « Identifié » sans thread → on route vers le composer
         (le statut « contacté » se posera en auto au 1ᵉʳ message), pas d'écriture.
       - Lettre signée → toast de célébration.
     Le sheet reste OUVERT en passant à VISITE_PLANIFIEE (pour saisir la date) ;
     il se ferme sur tout autre statut. */
  function handleSheetSelectStatus(next: RecruitmentStatus) {
    if (next === "contacte" && needsAutoMessage(pipelineStatus, false)) {
      setStatusSheetOpen(false);
      router.push(`/recruteur/messages/nouveau?athlete=${id}`);
      return;
    }
    handleStatusChange(next);
    if (next === "lettre_signee") setShowCelebration(true);
    if (next !== "visite_planifiee") setStatusSheetOpen(false);
  }

  /* Modification de la date de visite depuis le sheet — CHEMIN UNIQUE côté
     fiche : persistPipelineStage avec le stage courant (VISITE_PLANIFIEE) et
     la nouvelle date. Optimiste, rollback si l'écriture échoue. */
  async function handleSaveVisitDate(iso: string | undefined) {
    const prev = visitAt;
    setSavingVisit(true);
    setVisitAt(iso ?? null);
    const res = await persistPipelineStage({
      athleteId: id,
      status: "visite_planifiee",
      visitAtIso: iso,
    });
    setSavingVisit(false);
    if (!res.ok) {
      setVisitAt(prev);
      toast.error({
        message: res.reason === "pro_required" ? "Fonctionnalité Pro" : "Date non enregistrée",
        detail: res.reason === "pro_required" ? "Passe à Pro pour gérer ton processus." : undefined,
      });
      return;
    }
    toast.success({ message: iso ? "Date de visite enregistrée" : "Date de visite effacée" });
  }

  async function handleFlagSubmit() {
    if (!flagReason || flagSubmitting) return;
    if (!athleteUserId) {
      if (typeof window !== "undefined") window.alert("Ce profil n'est pas réclamé par un compte utilisateur. Le signalement ne peut pas être déposé pour le moment.");
      return;
    }
    setFlagSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
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
        toast.error({ message: "Échec de l'envoi", detail: "Réessaie dans quelques instants" });
        return;
      }
      setFlagSubmitted(true);
      setShowFlagModal(false);
      // Toast Dynamic Island (iter 4.0) — variant success + détail Réf expandable
      const referenceId = (inserted?.id as string | undefined)?.slice(0, 8);
      toast.success({
        message: "Signalement envoyé",
        detail: referenceId ? `Réf. ${referenceId}` : undefined,
      });
    } finally {
      setFlagSubmitting(false);
    }
  }

  // #52 — gate anti-flash (parité web) : tant que le fetch charge
  // (loadingAthlete), que a est null, ou que l'id est encore le placeholder
  // Capacitor → fallback spinner, jamais le mock. APRÈS tous les hooks, AVANT
  // le premier accès a.xxx → narrowing non-null + pas de crash.
  if (loadingAthlete || !a || id === "placeholder") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#111317" }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#2D3748] border-t-[#E63946] animate-spin" role="status" aria-label="Chargement du profil" />
      </div>
    );
  }

  const traitEntries = a.traitRatings ? Object.entries(a.traitRatings) as [keyof AthleteTraitRatings, number][] : [];
  const ratedTraits = traitEntries.filter(([, v]) => v > 0);
  const traitAvg = ratedTraits.length > 0 ? ratedTraits.reduce((s, [, v]) => s + v, 0) / ratedTraits.length : null;
  // #1 latest-wins : la COTE GLOBALE affichée = la note publique (overallRating =
  // cote_globale_entraineur last-write, 5.0), PAS la moyenne des traits (qui, pour
  // un coach, sont les SIENS via la RLS → 4.6). traitAvg reste le repli.
  const coteGlobale = a.overallRating || traitAvg || 0;

  const tests: { label: string; value?: string }[] = [
    { label: "40 verges", value: a.fortyYard },
    { label: "Saut vertical", value: a.verticalJump },
    { label: "Saut en longueur", value: a.broadJump },
    { label: "Bench press", value: a.benchPress },
    { label: "Navette / Agilité", value: a.shuttleAgility },
    { label: "100m sprint", value: a.sprint100m },
  ];
  const hasTests = tests.some((t) => t.value);

  const mediaLinks: { label: string; url?: string; iconName: string }[] = [
    { label: "Hudl", url: a.hudlUrl, iconName: "chart" },
    { label: "YouTube", url: a.youtubeUrl, iconName: "monitor" },
    { label: "Instagram", url: a.instagramUrl, iconName: "camera" },
  ];

  /* ── Statut recrutement label (lisible) ── */
  const recruitmentLabel = (() => {
    if (recruitmentStatus === "RECRUTE" && committedSchoolName) return `Recruté à ${committedSchoolName.toUpperCase()}`;
    const map: Record<string, string> = {
      OUVERT: "Ouvert", IDENTIFIE: "Identifié", CONTACTE: "Contacté",
      EN_DISCUSSION: "En discussion", VISITE_PLANIFIEE: "Visite planifiée",
      ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée", RECRUTE: "Recruté",
    };
    return map[recruitmentStatus] || recruitmentStatus;
  })();

  /* ── JSX MOBILE ── */
  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#111317" }}>
      {/* Iter 7.12 Section 2 — TopBar fond PLEIN #111317 en permanence.
          Avant : fond transparent au repos, /72 blur après scroll>20 → le
          contenu scrollé transparaissait à travers la TopBar (vraie cause
          du « INTERCEPTIONS visible dans la zone tabs », pas le ticket
          PlayerCard). Maintenant : opaque dès le repos, le bloc TopBar+tabs
          forme une zone solide continue, contenu disparaît net dessous. */}
      <div
        className="sticky top-0 z-40 min-h-11 flex items-center px-4"
        style={{ backgroundColor: "#111317", paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* Iter 6.1c — back vers le tab d'origine (sessionStorage 'lastRecruiterTab').
            Pipeline → profil → back doit revenir vers Pipeline et pas Recherche.
            Step 6 — coach back vers /coach/athletes (le roster). */}
        <button
          type="button"
          aria-label="Retour"
          onClick={() => {
            triggerHaptic("Light");
            // Sprint C : self-preview back → athlete profile editor.
            // CRITICAL : do NOT fall through to the recruiter dest list
            // below — pushing into /recruteur/* from an athlete session
            // is exactly the "athlete becomes recruiter" trap the
            // self-preview flow was built to avoid.
            if (isSelfPreview) { router.push("/athlete/profil"); return; }
            if (isCoach) { router.push("/coach/athletes"); return; }
            let dest = "/recruteur/recherche";
            try {
              const last = sessionStorage.getItem("lastRecruiterTab");
              if (last === "pipeline") dest = "/recruteur/pipeline";
              else if (last === "favoris") dest = "/recruteur/favoris";
              else if (last === "listes") dest = "/recruteur/listes";
              else if (last === "activites") dest = "/recruteur/activites";
              else if (last && last.startsWith("list-detail:")) {
                // Iter 7.18 Sprint 3 — back-nav précis vers le détail de la liste
                // d'origine (pas l'Index Listes). UUID encodé après le préfixe.
                const id = last.slice("list-detail:".length);
                if (id) dest = `/recruteur/listes/${id}`;
              }
              sessionStorage.removeItem("lastRecruiterTab");
            } catch { /* no-op */ }
            router.push(dest);
          }}
          className="text-[#8a8d96] active:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        {/* Iter 7.7 Section A — label "Profil athlète" retiré : créait une
            confusion visuelle de "2 titres superposés" avec le nom de
            l'athlète du HeroCollapsed au scroll. Spacer flex-1 conservé pour
            que back (gauche) et menu (droite) restent à leur place. */}
        <div className="flex-1" />
        <button
          type="button"
          aria-label="Plus d'options"
          onClick={() => { triggerHaptic("Light"); setShowActionSheet(true); }}
          className="text-[#8a8d96] active:text-white w-8 h-8 flex items-center justify-center"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
        </button>
      </div>

      {/* ── Indicateur pull-to-refresh (Fix iter 3.3 : z-[55] sous le modal z-[60]) */}
      {(isPulling || isRefreshing) && (
        <div
          className="fixed left-0 right-0 z-[55] flex justify-center items-center pointer-events-none"
          style={{ top: 44, height: Math.max(pullDistance, isRefreshing ? 60 : 0) }}
        >
          <div
            className="rounded-full p-2"
            style={{
              background: "rgba(230, 57, 70, 0.1)",
              transform: isRefreshing ? "rotate(0deg)" : `rotate(${pullDistance * 4}deg)`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E63946"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: isRefreshing ? "nx-spin 1s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
          </div>
          <style jsx>{`
            @keyframes nx-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* ── Skeleton loader (Fix 3 iter 3.2) — pulse vertical cohérent avec
          le bottom-up de la player card. Fade-out 200ms après loadingAthlete=false. */}
      {skeletonVisible && (
        <div
          className="fixed inset-x-0 top-11 bottom-0 z-30 bg-[#111317] overflow-hidden px-4 pt-6 space-y-5"
          style={{
            opacity: loadingAthlete ? 1 : 0,
            transition: "opacity 200ms ease-out",
            pointerEvents: loadingAthlete ? "auto" : "none",
          }}
        >
          {/* Skeleton player card 280×392 */}
          <div className="mx-auto nx-skel" style={{ width: 280, height: 392, borderRadius: 10, animationDelay: "0ms" }} />
          {/* Skeleton nom */}
          <div className="h-10 rounded-lg mx-auto nx-skel" style={{ width: "70%", animationDelay: "100ms" }} />
          {/* Skeleton statut pill */}
          <div className="h-8 rounded-full mx-auto nx-skel" style={{ width: "60%", animationDelay: "200ms" }} />
          {/* Skeleton 2 cubes KPI */}
          <div className="flex justify-center gap-3 pt-2">
            <div className="h-24 w-[100px] rounded-2xl nx-skel" style={{ animationDelay: "300ms" }} />
            <div className="h-24 w-[100px] rounded-2xl nx-skel" style={{ animationDelay: "300ms" }} />
          </div>
          {/* Skeleton badges */}
          <div className="flex justify-center gap-4 pt-2">
            <div className="w-14 h-14 rounded-lg nx-skel" style={{ animationDelay: "400ms" }} />
            <div className="w-14 h-14 rounded-lg nx-skel" style={{ animationDelay: "400ms" }} />
            <div className="w-14 h-14 rounded-lg nx-skel" style={{ animationDelay: "400ms" }} />
          </div>
          <style jsx>{`
            .nx-skel {
              background: #1A1D24;
              animation: nx-pulse 1.4s ease-in-out infinite;
            }
            @keyframes nx-pulse {
              0%, 100% { opacity: 0.35; }
              50% { opacity: 0.65; }
            }
          `}</style>
        </div>
      )}

      {/* ── HERO expanded — slide + collapse + overscroll stretch iOS (Fix 5 iter 3.5).
          Overscroll : quand pullDistance > 0 ET hero pas en cours de slide, on
          étire légèrement le hero (translateY + scale max 5%) pour le ressenti
          rubber-band. Désactivé pendant le slide et pendant le modal. */}
      {(() => {
        const canOverscroll = expandedSlideProgress === 0 && !showFlagModal && pullDistance > 0;
        const overscrollTranslate = canOverscroll ? pullDistance * 0.3 : 0;
        const overscrollScale = canOverscroll ? 1 + Math.min(pullDistance / 800, 0.05) : 1;
        return (
        <div
          className="px-4 pt-4 pb-4"
          style={{
            opacity: expandedOpacity,
            transform: `translateY(${expandedTranslateY + overscrollTranslate}px) scale(${overscrollScale})`,
            transformOrigin: "top center",
            marginBottom: expandedLayoutCollapse,
            pointerEvents: expandedSlideProgress >= 1 ? "none" : "auto",
            willChange: "opacity, transform, margin-bottom",
          }}
        >
        {/* COACH-only — alert stack en haut du scroll (Step 6 unification).
            Priority order : Consent > Verify > Suggestions. Chaque composant
            se masque lui-même quand le critère est résolu (consentement_parental,
            verified, pendingSuggestions.length). */}
        {isCoach && (
          <div className="space-y-3 mb-4">
            <ConsentAlert consentGiven={a.parentalConsent} onConfirm={coachConfirmConsent} />
            <VerifyAlert
              isVerified={!!a.isVerified}
              needsReverify={!!a.modifiedSinceVerification}
              onVerify={coachVerify}
            />
            <SuggestionsAlert
              pendingSuggestions={pendingSuggestions}
              onApprove={coachApprove}
              onReject={coachReject}
              onTapSuggestion={(s) => {
                triggerHaptic("Light");
                setCoachRejectingId(null);
                setCoachRejectReason("");
                setSheetSuggestion(s);
              }}
            />
          </div>
        )}

        {/* Player Card */}
        <div className="py-1">
          <PlayerCardMobile a={a} isFree={isRecruiter && isFreeRecruiter} starsRevealed={starsRevealed} cardRevealed={cardRevealed} photoParallaxY={expandedSlideProgress === 0 ? scrollY * 0.15 : 0} layoutIdPrefix={isCoach ? "coach-athlete-photo" : "athlete-photo"} />
        </div>

        {/* Nom + jersey (fade-up depuis 8px) */}
        <div
          className="text-center pt-5"
          style={{
            opacity: nameRevealed ? 1 : 0,
            transform: nameRevealed ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 300ms ease-out, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <h1 className="font-head text-[34px] font-black uppercase tracking-tight leading-[0.95]">
            {/* Step 6 — name blur gate is recruteur-only ; coach voit toujours le nom. */}
            {isRecruiter && isFreeRecruiter ? (
              <span className="inline-flex items-start gap-2" title="Nom réservé aux recruteurs Pro">
                <span aria-hidden className="select-none pointer-events-none blur-[6px]">Prénom Nom</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </span>
            ) : (
              <>
                {a.firstName} {a.lastName}
                {a.jerseyNumber && <span className="text-[#E63946] ml-2">#{a.jerseyNumber}</span>}
              </>
            )}
          </h1>
        </div>

        {/* Statut recrutement (athlète) — pill prominent centré */}
        <div
          className="mt-5 flex justify-center"
          style={{
            opacity: essentialsRevealed ? 1 : 0,
            transition: "opacity 320ms ease-out",
          }}
        >
          <RecruitmentStatusBadgeGlobal
            status={recruitmentStatus}
            committedSchoolName={committedSchoolName}
            openToOffers={openToOffers}
            size="md"
          />
        </div>

        {/* Mon statut pipeline (recruteur) — RECRUITER-ONLY (Step 6 gate). */}
        {isRecruiter && (
        <div
          className="mt-4 flex flex-col items-center gap-1.5"
          style={{
            opacity: essentialsRevealed ? 1 : 0,
            transition: "opacity 320ms ease-out 60ms",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Mon statut</span>
          {tier === "free" ? (
            IS_CAPACITOR ? (
              // iOS (3.1.1) : pas de CTA d'achat. Pill descriptif non-cliquable.
              <span className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.1] rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Suivi de processus — Pro
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="inline-flex items-center gap-2 bg-[#E63946]/10 border border-[#E63946]/30 rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wider text-[#E63946] active:bg-[#E63946]/20"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Passer à Pro pour le processus
              </button>
            )
          ) : myPipelineStage ? (() => {
            const upper = myPipelineStage.toUpperCase();
            const dotCfg = PIPELINE_DOT_MAP[upper]; // undefined si statut non répertorié → pas de dot
            const haloColor = "rgba(230,57,70,0.15)"; // halo uniquement sur rouge animé
            return (
              <span className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wider text-white">
                {dotCfg && (
                  <span
                    className={dotCfg.animated ? "nx-pulse-dot" : ""}
                    style={{
                      width: 8, height: 8, borderRadius: 9999, background: dotCfg.color,
                      boxShadow: dotCfg.halo ? `0 0 0 4px ${haloColor}` : undefined,
                    }}
                  />
                )}
                {({
                  IDENTIFIE: "Identifié", CONTACTE: "Contacté", EN_DISCUSSION: "En discussion",
                  VISITE_PLANIFIEE: "Visite planifiée", ENGAGE: "Engagé", LETTRE_SIGNEE: "Lettre signée",
                } as Record<string, string>)[upper] || myPipelineStage.replace(/_/g, " ")}
                <style jsx>{`
                  @keyframes nx-breathe {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.85); }
                  }
                  .nx-pulse-dot { animation: nx-breathe 1.6s ease-in-out infinite; }
                `}</style>
              </span>
            );
          })() : (
            <span className="text-[12px] italic text-[#6b7280]">Pas dans le processus</span>
          )}
        </div>
        )}

        {/* KPIs en cubes — gris subtil, cœur rouge seul élément accentué (Fix 2 iter 3.0).
            RECRUITER-ONLY (Step 6 gate) — coach n'a pas ces engagement metrics. */}
        {isRecruiter && (viewCount > 0 || favCount > 0) && (
          <div
            className="mt-6 flex justify-center gap-4"
            style={{
              opacity: essentialsRevealed ? 1 : 0,
              transition: "opacity 320ms ease-out 120ms",
            }}
          >
            <div
              className="flex flex-col items-center justify-center py-4 px-6 min-w-[100px]"
              style={{
                background: "#1A1D24",
                borderRadius: 12,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="mb-2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <p className="text-[32px] font-head font-black text-white leading-none tabular-nums">{viewCountDisplay}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Vues</p>
            </div>
            <div
              className="flex flex-col items-center justify-center py-4 px-6 min-w-[100px]"
              style={{
                background: "#1A1D24",
                borderRadius: 12,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#E63946" stroke="none" className="mb-2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <p className="text-[32px] font-head font-black text-white leading-none tabular-nums">{favCountDisplay}</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Favoris</p>
            </div>
          </div>
        )}

        {/* Badges (size sm partout, justify-center, gap-x-6 gap-y-3) — plus bas dans la hiérarchie */}
        {a.distinctions.length > 0 && (
          <div className="mt-6">
            <BadgesRow distinctions={a.distinctions} mounted={mounted} badgesRevealed={badgesRevealed} />
          </div>
        )}

        {/* « Changer le statut » — ouvre un BOTTOM SHEET portalé (remplace le
            dropdown cassé qui débordait hors écran). RECRUITER-ONLY (Step 6). */}
        {isRecruiter && canUsePipeline && pipelineStatus !== "none" && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); setStatusSheetOpen(true); }}
              className="inline-flex items-center gap-2 rounded-full border border-[#2D3748] bg-[#1A1D24] px-5 py-2.5 text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] active:bg-white/[0.04] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Changer le statut
            </button>
          </div>
        )}

        {/* Visite planifiée + export agenda — gate strict : stage ET date. */}
        {isRecruiter && canUsePipeline && pipelineStatus === "visite_planifiee" && visitAt && (
          <div className="mt-4">
            <VisitCalendarCard
              visitAtIso={visitAt}
              athleteName={`${a.firstName} ${a.lastName}`}
              sport={a.primarySport}
              schoolName={a.schoolName}
            />
          </div>
        )}
        </div>
        );
      })()}

      {/* ── HERO COLLAPSED standalone (Fix 1 iter 2.9 — Phase B) ──
          Caché complètement (position absolute, top:-80) tant que
          HeroExpanded n'est pas totalement sorti (collapsedSlideProgress=0).
          Bascule en sticky top:44 dès que la phase B démarre (progress > 0.5)
          et glisse depuis -80 jusqu'à 0 (translateY) tout en restant pinné. */}
      {/* Iter 7.11 Section 2.2 — HeroCollapsed : bg-[#111317]/95 backdrop-blur-md
          → bg-[#111317] plein. Le /95 (5% transparent) + backdrop-blur sur
          sticky laissait passer le content scroll entre y=44 et y=124 (entre
          TopBar et sticky tabs). Cohérent avec le wrapper sticky tabs déjà
          opaque depuis 7.9. */}
      <div
        className="bg-[#111317] border-b border-white/[0.04] overflow-hidden"
        style={{
          position: collapsedActive ? "sticky" : "absolute",
          // top suit le header (sticky top:0) qui fait désormais safe-area + 44px.
          top: collapsedActive ? "calc(env(safe-area-inset-top) + 44px)" : -80,
          left: 0,
          right: 0,
          height: 80,
          opacity: collapsedOpacity,
          transform: `translateY(${collapsedTranslateY}px)`,
          pointerEvents: collapsedActive ? "auto" : "none",
          zIndex: 25,
          willChange: "opacity, transform",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 h-full">
          <HeroMiniAvatar a={a} isFree={isFreeRecruiter} />
          <h2 className="flex-1 font-head text-[16px] font-black uppercase tracking-tight leading-tight truncate min-w-0">
            {isFreeRecruiter ? (
              <span className="blur-[5px] select-none">Prénom Nom</span>
            ) : (
              <>
                {a.firstName} {a.lastName}
                {a.jerseyNumber && <span className="text-[#E63946] ml-1">#{a.jerseyNumber}</span>}
              </>
            )}
          </h2>
          <div className="flex items-center gap-1 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="none" aria-hidden>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-[14px] font-bold text-white">{coteGlobale.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* ── Sticky wrapper TabBar + Toggle (sans HeroCollapsed dedans).
          Top dynamique : 44 quand HeroCollapsed inactif, 124 quand actif
          (44 TopBar + 80 HeroCollapsed). Évite le chevauchement avec
          HeroCollapsed pinned.
          Iter 7.9 Section 3 — fond PLEIN #111317 (au lieu de /95 backdrop-blur)
          + z-30 (au lieu de z-20) pour que le contenu scrollé ne transparaisse
          plus sous le bloc sticky. */}
      <div
        className="sticky z-30 bg-[#111317]"
        style={{ top: isCollapsedActive ? "calc(env(safe-area-inset-top) + 124px)" : "calc(env(safe-area-inset-top) + 44px)" }}
      >
        <TabBar activeTab={activeTab} onChange={handleTabChange} />
        {/* Toggle Simplifié/Détaillé centré. Iter 7.8c-UI Section B —
            border-t retiré (séparation par l'espace seul, plus aéré). */}
        <div className="px-4 py-2 flex justify-center">
          <ProfileToggle mode={mode} onChange={handleModeChange} />
        </div>
      </div>

      {/* ── Main scroll container (tab content) ──
          Iter 7.8b Section B BUG FIX : padding-bottom élargi pour dégager la
          sticky action bar "Contacter le coach" (hauteur réelle ~72px) + tab
          bar (64px) + safe-area + buffer 16px. Avant : 56+64+safe = trop court,
          le bas du contenu Détaillé passait SOUS la barre fixe. */}
      <div
        key={tabFadeKey}
        className="px-4 pt-5 space-y-6"
        style={{
          paddingBottom: "calc(80px + 72px + 24px + env(safe-area-inset-bottom))",
          animation: "nx-tab-fade 200ms ease-out",
        }}
      >
        <style jsx>{`
          @keyframes nx-tab-fade {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* ╔══ TAB 1 — RAPPORT ENTRAÎNEUR ══╗ */}
        {activeTab === "rapport" && (
          <>
            {/* FreeLock gate : Step 6 — recruteur-only. Coach voit toujours. */}
            {isRecruiter && isFreeRecruiter ? (
              <FreeLock />
            ) : (
              <>
                {/* Citation — tap-to-expand avec gradient fade (Fix 5 iter 3.0) */}
                {a.coachReport && (() => {
                  const isLongQuote = a.coachReport.length > SHORT_QUOTE_THRESHOLD;
                  return (
                    <section className={mobileSection}>
                      <div className="relative">
                        <span className="absolute -top-2 -left-1 text-[48px] font-serif text-[#E63946]/12 leading-none select-none z-[1]">&ldquo;</span>
                        <div
                          className={`relative pl-4 ${isLongQuote ? "cursor-pointer select-none" : ""}`}
                          style={{ borderLeft: "3px solid #E63946" }}
                          onClick={() => { if (isLongQuote) { triggerHaptic("Light"); setIsQuoteExpanded((v) => !v); } }}
                        >
                          <p
                            className={`text-[16px] text-white italic leading-relaxed ${isLongQuote && !isQuoteExpanded ? "line-clamp-3" : ""}`}
                          >
                            &ldquo;{a.coachReport}&rdquo;
                          </p>
                          {/* Gradient fade-out sur la dernière ligne quand collapsé */}
                          {isLongQuote && !isQuoteExpanded && (
                            <div
                              className="absolute bottom-0 left-0 right-0 pointer-events-none"
                              style={{
                                height: 32,
                                background: "linear-gradient(to bottom, transparent 0%, #111317 100%)",
                              }}
                            />
                          )}
                        </div>
                        <p className="text-[13px] font-bold text-[#9CA3AF] mt-3 pl-4">— {a.coachName}{a.coachSchool ? `, ${a.coachSchool}` : ""}</p>
                      </div>
                    </section>
                  );
                })()}
                {/* Score vertical centré (Fix 2 iter 2.9 — séparateurs dorés retirés en 7.8e-UI Section B :
                    les borderTop inline rgba(255,255,255,0.04) dessinaient la "ligne grise sous le toggle"
                    persistante après les 3 itérations précédentes. Cherché en border-t/border-b Tailwind à
                    chaque fois, donc raté — c'était un style inline. Séparation conservée via l'espace. */}
                <section className={mobileSection}>
                  <div className="flex flex-col items-center pt-6 pb-6">
                    <StarRating rating={coteGlobale} size="md" showNumber={false} />
                    <p className="text-[32px] font-head font-black text-white mt-3 leading-none">
                      {coteGlobale.toFixed(1)}<span className="text-[16px] text-[#6B7280] font-normal">/5</span>
                    </p>
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6B7280] mt-2">Cote Globale</p>
                    {/* #1 attribution : quand la cote publique vient d'un AUTRE
                        évaluateur que le coach qui regarde (ex. le directeur). */}
                    {a.evaluatorCoachId && a.evaluatorName && a.evaluatorCoachId !== currentUserId && (
                      <p className="text-[11px] text-[#3B82F6] font-semibold mt-1">Évaluée par {a.evaluatorName}</p>
                    )}
                    {isDetailed && ratedTraits.length > 0 && (
                      <p className="text-[11px] text-[#6B7280] mt-1">Moyenne sur {ratedTraits.length} {ratedTraits.length > 1 ? "traits" : "trait"}</p>
                    )}
                  </div>
                </section>

                {/* Vidéo Faits saillants — pleine largeur */}
                {a.highlightVideoUrl && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Faits saillants</h2>
                    <VideoEmbed url={a.highlightVideoUrl} title="Faits saillants" />
                  </section>
                )}
                {!a.highlightVideoUrl && !a.coachReport && (
                  <p className="text-[13px] text-[#6b7280] italic text-center py-6">Aucun rapport ni vidéo pour le moment.</p>
                )}

                {/* DETAILED rapport */}
                {isDetailed && a.traitRatings && ratedTraits.length > 0 && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Détail par trait</h2>
                    <div>
                      {TRAIT_LIST.map((trait) => {
                        const val = a.traitRatings ? a.traitRatings[trait.key] : 0;
                        if (!val || val <= 0) return null;
                        return (
                          <div key={trait.key} className={mobileRow}>
                            <span className="text-[13px] text-[#c8c8cc]">{trait.label}</span>
                            <StarRating rating={val} size="sm" />
                          </div>
                        );
                      })}
                      {/* Iter 7.9 Section 2 — borderTop inline retiré (parasite RAPPORT Détaillé). Espacement seul. */}
                      {traitAvg !== null && (
                        <div className="mt-4 pt-3 flex items-center justify-between">
                          <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider">Moyenne</span>
                          <div className="flex items-center gap-2">
                            <StarRating rating={traitAvg} size="md" />
                            <span className="text-[14px] font-head font-black text-white">{traitAvg.toFixed(1)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* DETAILED vidéos additionnelles */}
                {isDetailed && (a.fullGameUrl || a.practiceVideoUrl) && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Vidéos additionnelles</h2>
                    <div className="flex flex-col gap-4">
                      {a.fullGameUrl && (
                        <div>
                          <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#6b7280] mb-2">Match complet</p>
                          <VideoEmbed url={a.fullGameUrl} title="Match complet" />
                        </div>
                      )}
                      {a.practiceVideoUrl && (
                        <div>
                          <p className="text-[10px] font-semibold tracking-[2px] uppercase text-[#6b7280] mb-2">Entraînement</p>
                          <VideoEmbed url={a.practiceVideoUrl} title="Entraînement" />
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* DETAILED liens média (Hudl/YouTube/IG) */}
                {isDetailed && (a.hudlUrl || a.youtubeUrl || a.instagramUrl) && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Liens externes</h2>
                    <div className="flex flex-col gap-2">
                      {mediaLinks.filter((m) => ["Hudl", "YouTube", "Instagram"].includes(m.label) && m.url).map((m) => (
                        <a key={m.label} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-b-0 active:bg-white/[0.03]">
                          <NxIcon name={m.iconName} size={18} className="text-[#6B7280]" />
                          <span className="flex-1 text-[14px] font-bold text-[#c8c8cc]">{m.label}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#6b7280]">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ╔══ TAB 2 — PROFIL ACADÉMIQUE ══╗ */}
        {activeTab === "academique" && (
          <>
            {/* FreeLock gate : Step 6 — recruteur-only. Coach voit toujours. */}
            {isRecruiter && isFreeRecruiter ? (
              <FreeLock />
            ) : (
              <>
                {/* Iter 7.9 Section 2 — 3 KPI stack : border-b parasites retirées
                    entre GPA / Programme / Graduation. Espacement seul. */}
                <section className={mobileSection}>
                  <div>
                    <div className="py-4 text-center">
                      <p className="text-[28px] font-head font-black text-white leading-none">{a.gpa ? `${a.gpa}%` : "—"}</p>
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-1.5">Moyenne générale</p>
                    </div>
                    <div className="py-4 text-center">
                      {(() => {
                        let display = "—";
                        if (a.program && typeof a.program === "string" && a.program.length > 0) {
                          display = a.program;
                        } else {
                          let arr = a.targetCegepProgram;
                          if (typeof arr === "string") { try { arr = JSON.parse(arr as unknown as string); } catch { arr = []; } }
                          if (Array.isArray(arr) && arr.length > 0) display = arr.join(", ");
                        }
                        return <p className="text-[16px] font-bold text-white leading-snug">{display}</p>;
                      })()}
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-1.5">Programme visé</p>
                    </div>
                    <div className="py-4 text-center">
                      <p className="text-[16px] font-bold text-white">Juin {a.graduationYear}</p>
                      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#9CA3AF] mt-1.5">Graduation</p>
                    </div>
                  </div>
                  {/* Préférences — mini-cards avec checkmark vert / X gris (Fix 4 iter 2.9) */}
                  <div className="mt-6">
                    <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Préférences</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { active: a.openToRelocate, label: "Déménager" },
                        { active: a.openToPrivate, label: "Privé" },
                        { active: a.openToAnglophone, label: "Anglophone" },
                      ].map((pref) => (
                        <div
                          key={pref.label}
                          className="flex flex-col items-center justify-center py-3 px-2"
                          style={{ background: "#1A1D24", borderRadius: 12 }}
                        >
                          {pref.active ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          )}
                          <p className="text-[11px] font-bold uppercase tracking-wider text-white mt-2">{pref.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* DETAILED — école + matières/mentions/régions */}
                {isDetailed && (
                  <>
                    {/* Académique affiliation card — gated to skip
                        civil_with_team since the team detail moved to
                        the bottom of the Sportif tab (TeamDetailsBlock,
                        école + civil generalized). For école athletes
                        we still show the École identity card here ; for
                        civil_no_team we show the explanatory line. */}
                    {affiliation !== "civil_with_team" && (
                    <section className={mobileSection}>
                      <h2 className={sectionLabel}>{affiliation === "school" ? "École" : "Équipe civile"}</h2>
                      {/* Carte unique centrée (Fix 6 iter 2.7) — école/équipe en gros, lieu/détails en sous-titre */}
                      {affiliation === "school" && a.schoolName && (
                        <div className="rounded-2xl py-6 px-4 flex flex-col items-center text-center" style={{ background: "#1A1D24" }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                            <path d="M3 21h18" /><path d="M5 21V7l8-4 8 4v14" /><path d="M9 9v.01M9 13v.01M9 17v.01M15 9v.01M15 13v.01M15 17v.01" />
                          </svg>
                          <p className="text-[18px] font-bold text-white leading-tight">{a.schoolName}</p>
                          {(a.region || a.city) && (
                            <p className="text-[13px] text-[#9CA3AF] mt-2">
                              {[a.city, a.region].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                      {affiliation === "civil_no_team" && (
                        <div className="rounded-2xl py-6 px-4 text-center" style={{ background: "#1A1D24" }}>
                          <p className="text-[13px] text-[#9CA3AF] italic">Athlète en ligue civile sans équipe rattachée.</p>
                        </div>
                      )}
                    </section>
                    )}

                    {/* Détails académiques — mini-cards cohérentes avec Sportif (Fix 2 iter 2.8).
                        Layout : 1 item plein largeur, 2+ items grid 2 col. */}
                    {(a.strongSubjects?.length > 0 || a.academicHonors?.length > 0 || a.preferredRegions?.length > 0 || (Array.isArray(a.targetCegepProgram) && a.targetCegepProgram.length > 0)) && (
                      <section className={mobileSection}>
                        <h2 className={sectionLabel}>Détails académiques</h2>
                        <div className="space-y-6">
                          {(() => {
                            let prog = a.targetCegepProgram;
                            if (typeof prog === "string") { try { prog = JSON.parse(prog as unknown as string); } catch { prog = []; } }
                            if (Array.isArray(prog) && prog.length > 0) {
                              return (
                                <div>
                                  <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Programme CÉGEP visé</p>
                                  <div className={prog.length === 1 ? "w-full" : "grid grid-cols-2 gap-3"}>
                                    {prog.map((p: string) => (
                                      <div key={p} className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                                        <p className="text-[14px] font-bold uppercase text-white leading-tight line-clamp-2">{p}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {a.strongSubjects?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Matières fortes</p>
                              <div className={a.strongSubjects.length === 1 ? "w-full" : "grid grid-cols-2 gap-3"}>
                                {a.strongSubjects.map((s) => (
                                  <div key={s} className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                                    <p className="text-[14px] font-bold uppercase text-white leading-tight line-clamp-2">{s}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {a.academicHonors?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Mentions académiques</p>
                              <div className={a.academicHonors.length === 1 ? "w-full" : "grid grid-cols-2 gap-3"}>
                                {a.academicHonors.map((h) => (
                                  <div key={h} className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                                    <p className="text-[14px] font-bold uppercase text-white leading-tight line-clamp-2">{h}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {a.preferredRegions?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-3">Régions CÉGEP préférées</p>
                              <div className={a.preferredRegions.length === 1 ? "w-full" : "grid grid-cols-2 gap-3"}>
                                {a.preferredRegions.map((r) => (
                                  <div key={r} className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                                    <p className="text-[14px] font-bold uppercase text-[#c8c8cc] leading-tight line-clamp-2">{r}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ╔══ TAB 3 — INFOS SPORTIVES ══╗ */}
        {activeTab === "sportif" && (
          <>
            {/* Profil athlète (taille / poids — flat) */}
            {(a.heightDisplay || a.weightDisplay) && (
              <section className={mobileSection}>
                <div className="flex items-center justify-around mb-2">
                  {a.heightDisplay && (
                    <div className="text-center">
                      <p className="text-[28px] font-head font-[800] text-white leading-none">{a.heightDisplay}</p>
                      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#6b7280] mt-1">Taille</p>
                    </div>
                  )}
                  {a.weightDisplay && (
                    <div className="text-center">
                      <p className="text-[28px] font-head font-[800] text-white leading-none">
                        {a.weightDisplay.replace(" lbs", "")}<span className="text-[14px] font-semibold text-[#6b7280]"> lbs</span>
                      </p>
                      <p className="text-[11px] font-semibold tracking-[2px] uppercase text-[#6b7280] mt-1">Poids</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Sport principal — mini-cards 2x2 (Fix 4 iter 2.7).
                Position : préfère l'abréviation entre parenthèses (ex: "ILB")
                via positionAbbr(); le nom complet "Secondeur intérieur" est
                trop long pour un cube. */}
            {(a.primarySport || a.primaryPosition || a.jerseyNumber || a.teamName || a.leagueName || a.teamLevel) && (
              <section className={mobileSection}>
                <h2 className={sectionLabel}>Sport principal</h2>
                <div className="grid grid-cols-2 gap-3">
                  {a.primarySport && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[18px] font-head font-black text-white leading-tight line-clamp-2 uppercase">{a.primarySport}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Sport</p>
                    </div>
                  )}
                  {a.primaryPosition && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[22px] font-head font-black text-white leading-none">{positionAbbr(a.primaryPosition)}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Position</p>
                    </div>
                  )}
                  {a.jerseyNumber && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[22px] font-head font-black text-white leading-none">#{a.jerseyNumber}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Numéro</p>
                    </div>
                  )}
                  {a.teamLevel && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[16px] font-head font-black text-white leading-tight line-clamp-2 uppercase">{a.teamLevel}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Niveau</p>
                    </div>
                  )}
                  {a.teamName && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[16px] font-head font-black text-white leading-tight line-clamp-2 uppercase">{a.teamName}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Équipe</p>
                    </div>
                  )}
                  {a.leagueName && (
                    <div className="py-4 px-3 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                      <p className="text-[16px] font-head font-black text-white leading-tight line-clamp-2 uppercase">{a.leagueName}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mt-2">Ligue</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Parcours d'équipes — après Sport principal ; se masque si vide.
                Anchor = vraie affiliation Nexus (display-only, non éditable). */}
            <TeamHistoryBlock
              entries={a.teamHistory}
              anchor={{
                teamName: a.isCivil ? (a.teamName || a.leagueName || "") : (a.schoolName || ""),
                sport: a.primarySport,
                position: a.primaryPosition,
                region: a.region,
              }}
            />

            {/* DETAILED — secondaire + mesures + tests */}
            {isDetailed && (
              <>

                {(a.wingspan || a.handSize || a.dominantHand || a.dominantFoot) && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Mesures physiques</h2>
                    {/* Taille/Poids déjà affichés en haut du tab Sportif — exclus ici pour éviter le doublon */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Envergure", value: a.wingspan },
                        { label: "Main", value: a.handSize },
                        { label: "Main dom.", value: a.dominantHand },
                        { label: "Pied dom.", value: a.dominantFoot },
                      ].filter(m => m.value).map((m) => (
                        <div key={m.label} className="py-3 px-2 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                          <p className="text-[18px] font-head font-black text-white leading-none">{m.value}</p>
                          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-1.5">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {hasTests && (
                  <section className={mobileSection}>
                    <h2 className={sectionLabel}>Tests athlétiques</h2>
                    <div className="grid grid-cols-2 gap-3">
                      {tests.filter((t) => t.value).map((t) => (
                        <div key={t.label} className="py-3 px-2 text-center" style={{ background: "#1A1D24", borderRadius: 12 }}>
                          <p className="text-[18px] font-head font-black text-white leading-none">{t.value}</p>
                          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-1.5">{t.label}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Réputation coach — DERNIER (Fix 4 iter 2.8) */}
            {a.coachName && (
              <section className={mobileSection}>
                <h2 className={sectionLabel}>Réputation du coach</h2>
                {coachRepData && coachRepData.reviewCount > 0 ? (
                  <>
                    <div className="flex flex-col items-center pt-2 pb-4">
                      <p className="text-[13px] font-bold text-[#c8c8cc] mb-3">{a.coachName}</p>
                      <StarRating rating={coachRepData.avgRating} size="md" showNumber={false} />
                      <p className="text-[28px] font-head font-black text-white mt-2 leading-none">
                        {coachRepData.avgRating.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span>
                      </p>
                      <p className="text-[12px] font-bold tracking-wider uppercase text-[#9CA3AF] mt-3">
                        {coachRepData.reviewCount} {coachRepData.reviewCount > 1 ? "avis" : "avis"} · {coachRepData.recommandePct}% recommandé
                      </p>
                    </div>

                    {isDetailed && (
                      <div className="mt-4 pt-4">{/* Iter 7.9 Section 2 — border-t parasite retirée (réputation coach Détaillé). Espacement seul. */}
                        {isAllStar ? (
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6B7280] text-center mb-3">Détails</p>
                            {[
                              { label: "Qualité des profils", value: coachRepData.avgQualite },
                              { label: "Réactivité", value: coachRepData.avgReactivite },
                              { label: "Honnêteté", value: coachRepData.avgHonnetete },
                              { label: "Professionnalisme", value: coachRepData.avgPro },
                            ].map((c) => {
                              const filled = Math.round(c.value);
                              return (
                                <div key={c.label} className="flex items-center gap-3">
                                  <span className="text-[13px] text-[#c8c8cc] flex-1">{c.label}</span>
                                  <span className="text-[14px] font-bold text-white tabular-nums w-8 text-right">{c.value.toFixed(1)}</span>
                                  <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map((dot) => (
                                      <span
                                        key={dot}
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: dot <= filled ? "#E63946" : "#2A2D35" }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center gap-2 py-2">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            <p className="text-[11px] font-bold text-[#F59E0B]">Détail réservé All Star</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-bold text-[#c8c8cc] mb-2 text-center">{a.coachName}</p>
                    <p className="text-[13px] text-[#4a4d56] italic text-center">Aucune évaluation reçue pour le moment.</p>
                  </>
                )}
              </section>
            )}

            {/* ── Équipes : small buried list at the bottom of Sportif.
                Generalized for école + civil (the old civil-only block
                in Académique was removed in favor of this single block).
                Derived from team_athletes → teams ; multi-team aware. */}
            <section className={mobileSection}>
              <TeamDetailsBlock teams={teamDetails} />
            </section>
          </>
        )}
      </div>

      {/* ── Sticky bottom action bar — Portal vers document.body (Fix #9 iter 6.0b).
          Avant : `position: fixed` à l'intérieur d'un ancêtre transform/will-change
          (AnimatedRoute motion.div) perdait son ancrage viewport pendant la
          transition d'entrée → la barre apparaissait stuck au milieu de l'écran.
          Portal échappe au containing block de l'ancêtre transform.
          RECRUITER-ONLY (Step 6 gate) — coach a sa propre barre "Modifier le profil"
          rendue plus bas. */}
      {isRecruiter && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed left-0 right-0 z-30 px-3 py-2.5 flex items-center gap-2"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 80px)",
            backgroundColor: "rgba(17,19,23,0.85)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
            transform: `translateY(${actionBarVisible && !showFlagModal && !showActionSheet ? 0 : 120}px)`,
            transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {canMessageCoach && (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); setShowContactMenu(true); }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#E63946] text-white rounded-2xl px-4 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
              Contacter
            </button>
          )}
          {/* Iter 7.23 Sprint 4 — bouton "Ajouter à une liste" (PRO-only).
              Icône liste-avec-+ pour signaler l'action d'ajout. Tap → ouvre
              AddToListSheet (réutilise useRecruiterLists + checkboxes
              pré-cochées via useAthleteListMembership). */}
          {canCustomLists && (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); setAddToListOpen(true); }}
              aria-label="Ajouter à une liste"
              className="w-12 h-12 rounded-2xl flex items-center justify-center border bg-[#1A1D24] border-[#2D3748] text-white active:bg-white/[0.06] transition-colors flex-shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h13" /><path d="M3 12h13" /><path d="M3 18h9" />
                <line x1="18" y1="15" x2="18" y2="21" /><line x1="15" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors ${favButtonDisabled ? "opacity-40" : ""} ${isFavorited ? "bg-[#E63946]/10 border-[#E63946]/30" : "bg-[#1A1D24] border-[#2D3748]"}`}
            title={favButtonDisabled ? favDisabledTitle : undefined}
          >
            <HeartButton
              isFavorited={isFavorited}
              onToggle={toggleFav}
              size="md"
              disabled={favButtonDisabled}
            />
          </div>
        </div>,
        document.body,
      )}

      {/* ══ Contact choice sheet (coach vs athlete) ══ */}
      {showContactMenu && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowContactMenu(false)} />
          <div className="relative w-full max-w-[520px] bg-[#1A1D24] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Contacter</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-4">Qui veux-tu contacter au sujet de {a?.firstName} {a?.lastName}&nbsp;?</p>
            <div className="space-y-3">
              <button type="button" disabled={contactingCoach || !coachId}
                onClick={() => { setShowContactMenu(false); handleContactCoach(); }}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-[#111317] border border-[#2D3748] active:bg-[#E63946]/[0.06] transition-colors text-left ${contactingCoach || !coachId ? "opacity-60" : ""}`}>
                <span className="w-10 h-10 rounded-lg bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-white">Contacter le coach</span>
                  <span className="block text-[12px] text-[#6b7280]">{coachId ? "Écris à l’entraîneur de l’athlète" : "Aucun coach connecté pour cet athlète"}</span>
                </span>
              </button>
              <button type="button" disabled={contactingAthlete || favButtonDisabled}
                onClick={() => { setShowContactMenu(false); handleContactAthlete(); }}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-colors text-left ${favButtonDisabled ? "opacity-40 bg-[#111317] border-[#2D3748]" : "bg-[#111317] border-[#2D3748] active:bg-[#E63946]/[0.06]"}`}>
                <span className="w-10 h-10 rounded-lg bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold text-white">Contacter l&apos;athlète</span>
                  <span className="block text-[12px] text-[#6b7280]">{isFavorited ? "Message direct à l'athlète" : "Ajoute-le aux favoris pour le contacter"}</span>
                </span>
              </button>
            </div>
            <button type="button" onClick={() => setShowContactMenu(false)}
              className="mt-4 w-full rounded-xl px-4 py-3 text-[13px] font-bold text-[#9CA3AF] active:text-white transition-colors">
              Annuler
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* ══ Favorite-first contact prompt (RECRUTEUR_ATHLETE) ══ */}
      {showFavContactPrompt && mounted && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!contactingAthlete) setShowFavContactPrompt(false); }} />
          <div className="relative w-full max-w-[520px] bg-[#1A1D24] border-t border-white/[0.08] rounded-t-3xl px-5 pt-5 pb-8">
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-5" />
            <div className="w-12 h-12 rounded-full bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-2">Ajouter aux favoris pour contacter</h3>
            <p className="text-[14px] text-[#9CA3AF] leading-relaxed mb-1">
              Pour contacter {a?.firstName} {a?.lastName} directement, ajoute-le d&apos;abord à tes favoris.
            </p>
            <p className="text-[12px] text-[#6b7280] leading-relaxed mb-5">Son coach et son parent seront avisés de ce premier contact.</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { if (!contactingAthlete) setShowFavContactPrompt(false); }}
                className="flex-1 rounded-xl px-4 py-3.5 text-[13px] font-bold text-[#9CA3AF] bg-[#111317] border border-[#2D3748] active:text-white transition-colors">
                Annuler
              </button>
              <button type="button" onClick={() => void favoriteAndContact()} disabled={contactingAthlete}
                className="flex-1 rounded-xl px-4 py-3.5 text-[13px] font-head font-bold uppercase tracking-widest text-white bg-[#E63946] active:bg-[#D42B22] transition-colors disabled:opacity-60">
                {contactingAthlete ? "..." : "Ajouter et contacter"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ══ COACH-only — sticky "Modifier le profil" CTA + SuggestionSheet (Step 6) ══ */}
      {isCoach && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed left-0 right-0 z-30 px-3 py-2.5"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 80px)",
            backgroundColor: "rgba(17,19,23,0.85)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderTop: "0.5px solid rgba(255,255,255,0.08)",
            transform: `translateY(${actionBarVisible && !sheetSuggestion ? 0 : 120}px)`,
            transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div className="flex items-stretch gap-2">
            {/* Q4 — Envoyer un message (athlète↔coach). Find-or-create + route
                vers le fil coach. Le coach est déjà sur la fiche de l'athlète. */}
            <button
              type="button"
              onClick={async () => {
                triggerHaptic("Light");
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { conversationId } = await findOrCreateAthleteCoachConversation(supabase, { athleteId: id, coachId: user.id });
                if (conversationId) router.push(`/coach/demandes?id=${conversationId}`);
                else toast.error({ message: "Impossible d'ouvrir la conversation" });
              }}
              className="flex items-center justify-center gap-1.5 shrink-0 px-4 py-4 rounded-2xl border border-[#22C55E]/40 text-[#22C55E] font-head font-bold text-[13px] uppercase tracking-widest active:bg-[#22C55E]/10"
              aria-label="Envoyer un message"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Message
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("Medium");
                // Capacitor static export : matche le pattern stash-puis-push
                // d'app/page.tsx (errorPath fallback). Sans le stash, le shell
                // placeholder/modifier reçoit athleteId="placeholder" et la
                // pre-fill du wizard échoue (loadAthleteRaw rejette le non-UUID
                // → blank form). Le web push direct l'id réel.
                if (IS_CAPACITOR) {
                  try { sessionStorage.setItem(`${SESSION_KEY_PREFIX}id`, id); } catch { /* no-op */ }
                  router.push("/coach/athletes/placeholder/modifier/");
                } else {
                  router.push(`/coach/athletes/${id}/modifier`);
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-[#E63946] text-white rounded-2xl px-4 py-4 font-head font-bold text-[13px] uppercase tracking-widest active:bg-[#D42B22] shadow-[0_0_20px_rgba(230,57,70,0.3)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Modifier le profil
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* SuggestionSheet (coach only, portaled inside the sheet component). */}
      {isCoach && (
        <SuggestionSheet
          open={!!sheetSuggestion}
          suggestion={sheetCoachTask}
          athleteName={a ? `${a.firstName} ${a.lastName}`.trim() : ""}
          rejecting={!!sheetSuggestion && coachRejectingId === sheetSuggestion.id}
          rejectReason={coachRejectReason}
          onClose={() => { setSheetSuggestion(null); setCoachRejectingId(null); setCoachRejectReason(""); }}
          onStartReject={() => sheetSuggestion && setCoachRejectingId(sheetSuggestion.id)}
          onCancelReject={() => { setCoachRejectingId(null); setCoachRejectReason(""); }}
          onChangeReason={setCoachRejectReason}
          onApprove={() => sheetSuggestion && coachApprove(sheetSuggestion.id)}
          onReject={() => sheetSuggestion && coachReject(sheetSuggestion.id, coachRejectReason)}
        />
      )}


      {isRecruiter && (
        <CelebrationToast show={showCelebration} onDone={() => setShowCelebration(false)} />
      )}

      {/* Bottom sheet « Changer le statut » + section visite (remplace le
          StatusChangeDropdown). Portalé, rendu au niveau racine. */}
      {isRecruiter && canUsePipeline && a && (
        <StatusVisitSheet
          open={statusSheetOpen}
          onClose={() => setStatusSheetOpen(false)}
          currentStatus={pipelineStatus}
          visitAtIso={visitAt}
          athleteName={`${a.firstName} ${a.lastName}`}
          sport={a.primarySport}
          schoolName={a.schoolName}
          onSelectStatus={handleSheetSelectStatus}
          onSaveVisitDate={handleSaveVisitDate}
          savingVisit={savingVisit}
        />
      )}

      {/* Modal Signaler — Portal pour échapper aux ancêtres transform/will-change
          (Fix 1 iter 3.4). Sans portal, un ancêtre avec transform crée un nouveau
          containing block et `position: fixed` devient relatif à cet ancêtre →
          le modal était positionné dans la zone du composant, pas du viewport.
          RECRUITER-ONLY (Step 6 gate). */}
      {isRecruiter && showFlagModal && typeof document !== "undefined" && createPortal((() => {
        let handleStartY = 0;
        return (
        <>
          <div
            className="fixed inset-0 z-[60]"
            style={{
              background: `rgba(0,0,0,${Math.max(0.2, 0.6 - modalDragOffset / 300)})`,
              animation: isDraggingModal ? undefined : "nx-modal-fade 200ms ease-out forwards",
            }}
            onClick={() => { triggerHaptic("Light"); setShowFlagModal(false); }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[60] bg-[#1A1D24] rounded-t-2xl shadow-2xl"
            style={{
              animation: isDraggingModal || modalDragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              transform: `translateY(${modalDragOffset}px)`,
              transition: isDraggingModal ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              paddingBottom: "env(safe-area-inset-bottom)",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            {/* Handle iOS — zone tap élargie (padding) pour swipe-down */}
            <div
              className="flex justify-center pt-3 pb-3 cursor-grab touch-none"
              onTouchStart={(e) => {
                setIsDraggingModal(true);
                handleStartY = e.touches[0].clientY;
              }}
              onTouchMove={(e) => {
                if (!isDraggingModal && handleStartY === 0) return;
                const dy = Math.max(0, e.touches[0].clientY - handleStartY);
                setModalDragOffset(dy);
              }}
              onTouchEnd={() => {
                if (modalDragOffset > 100) {
                  triggerHaptic("Light");
                  setShowFlagModal(false);
                } else {
                  setModalDragOffset(0);
                }
                setIsDraggingModal(false);
                handleStartY = 0;
              }}
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-[18px] font-bold text-white">Signaler ce profil</h3>
              <p className="text-[13px] text-[#9CA3AF] mt-1">Sélectionne une raison ci-dessous</p>
            </div>

            {/* Raisons */}
            <div className="px-4 py-4 space-y-2">
              {FLAG_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => { triggerHaptic("Light"); setFlagReason(reason); }}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition-colors ${
                    flagReason === reason
                      ? "bg-[#E63946]/10 border border-[#E63946]/30"
                      : "border border-transparent"
                  }`}
                  style={flagReason === reason ? undefined : { background: "#0C0E12" }}
                >
                  <span className="text-[14px] font-medium text-white">{reason}</span>
                </button>
              ))}
            </div>

            {/* Détails optionnels */}
            <div className="px-6 py-4">
              <label className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280] mb-2 block">Détails (optionnel)</label>
              <textarea
                value={flagDetails}
                onChange={(e) => setFlagDetails(e.target.value)}
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-[16px] text-white resize-none focus:outline-none"
                style={{ background: "#0C0E12" }}
                placeholder="Précise si besoin..."
              />
            </div>

            {/* Actions */}
            <div className="px-4 py-4 flex gap-3">
              <button
                type="button"
                onClick={() => { triggerHaptic("Light"); setShowFlagModal(false); }}
                className="flex-1 py-3 rounded-2xl text-[14px] font-bold text-white"
                style={{ background: "#0C0E12" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic("Medium"); handleFlagSubmit(); }}
                disabled={!flagReason || flagSubmitting || !athleteUserId}
                className="flex-1 py-3 rounded-2xl bg-[#E63946] text-[14px] font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {flagSubmitting ? "Envoi..." : "Signaler"}
              </button>
            </div>

          </div>
          <style jsx>{`
            @keyframes nx-modal-slideup {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes nx-modal-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </>
        );
      })(), document.body)}

      {/* Action Sheet menu 3-points (Fix 3 iter 3.5) — Portal pour échapper aux
          transforms ancêtres. Pattern iOS : items dans une card + Annuler
          dans une card séparée (avec gap). Swipe-down dismiss + backdrop tap. */}
      {isRecruiter && showActionSheet && typeof document !== "undefined" && createPortal((() => {
        let handleStartY = 0;
        const closeSheet = () => { triggerHaptic("Light"); setShowActionSheet(false); };
        const handleShare = async () => {
          triggerHaptic("Light");
          setShowActionSheet(false);
          const athleteName = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "cet athlète";
          const shareUrl = `https://nexussports.ca/athletes/${id}`;
          const shareData = {
            title: `Profil de ${athleteName} sur Nexus`,
            text: `Découvre le profil de ${athleteName} sur Nexus`,
            url: shareUrl,
            dialogTitle: "Partager ce profil",
          };
          // Priorité 1 : @capacitor/share natif (iOS share sheet / Android intent)
          try {
            const { Share } = await import("@capacitor/share");
            await Share.share(shareData);
            return;
          } catch { /* plugin absent ou refusé : fallback web */ }
          // Priorité 2 : Web Share API (Safari / Chrome récent)
          try {
            if (typeof navigator !== "undefined" && navigator.share) {
              await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
              return;
            }
          } catch { /* user cancel ok */ }
          // Priorité 3 : copie dans le clipboard + toast Dynamic Island
          try {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              await navigator.clipboard.writeText(shareUrl);
              toast.info({ message: "Lien copié" });
            }
          } catch { /* clipboard refusé : silencieux */ }
        };
        const handleOpenFlag = () => {
          triggerHaptic("Light");
          setShowActionSheet(false);
          window.setTimeout(() => { if (!flagSubmitted) setShowFlagModal(true); }, 150);
        };
        const items: { label: string; icon: React.ReactNode; onClick: () => void; destructive?: boolean }[] = [
          {
            label: "Partager le profil",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            ),
            onClick: handleShare,
          },
          {
            label: "Signaler le profil",
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            ),
            onClick: handleOpenFlag,
            destructive: true,
          },
        ];
        return (
          <>
            <div
              className="fixed inset-0 z-[60]"
              style={{
                background: `rgba(0,0,0,${Math.max(0.2, 0.6 - actionSheetDragOffset / 300)})`,
                animation: isDraggingSheet ? undefined : "nx-modal-fade 200ms ease-out forwards",
              }}
              onClick={closeSheet}
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-[60]"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
                padding: "0 12px calc(env(safe-area-inset-bottom) + 16px) 12px",
                transform: `translateY(${actionSheetDragOffset}px)`,
                transition: isDraggingSheet ? "none" : "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                animation: isDraggingSheet || actionSheetDragOffset > 0 ? undefined : "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              {/* Card items */}
              <div className="bg-[#1A1D24] rounded-2xl overflow-hidden">
                {/* Handle iOS — zone tap élargie pour swipe-down */}
                <div
                  className="flex justify-center pt-3 pb-3"
                  onTouchStart={(e) => { setIsDraggingSheet(true); handleStartY = e.touches[0].clientY; }}
                  onTouchMove={(e) => {
                    if (!isDraggingSheet && handleStartY === 0) return;
                    const dy = Math.max(0, e.touches[0].clientY - handleStartY);
                    setActionSheetDragOffset(dy);
                  }}
                  onTouchEnd={() => {
                    if (actionSheetDragOffset > 100) { closeSheet(); }
                    else { setActionSheetDragOffset(0); }
                    setIsDraggingSheet(false);
                    handleStartY = 0;
                  }}
                >
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                {items.map((it, idx) => (
                  <button
                    key={it.label}
                    type="button"
                    onClick={it.onClick}
                    className="w-full flex items-center gap-3 px-5 text-left active:bg-white/[0.04]"
                    style={{
                      height: 56,
                      borderTop: idx > 0 ? "0.5px solid rgba(255,255,255,0.08)" : undefined,
                      color: it.destructive ? "#E63946" : "#FFFFFF",
                    }}
                  >
                    {it.icon}
                    <span className="text-[15px] font-medium">{it.label}</span>
                  </button>
                ))}
              </div>
              {/* Cancel card séparée (pattern iOS) */}
              <button
                type="button"
                onClick={closeSheet}
                className="w-full mt-2 rounded-2xl bg-[#1A1D24] active:bg-white/[0.04]"
                style={{ height: 56, color: "#E63946", fontSize: 15, fontWeight: 600 }}
              >
                Annuler
              </button>
            </div>
          </>
        );
      })(), document.body)}

      {/* Ex-toast local épuré (iter 3.5) retiré — remplacé par MobileToast Dynamic Island (iter 4.0) */}

      {/* RECRUITER-ONLY (Step 6 gate). */}
      {isRecruiter && (
        <UpgradeModal
          open={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          role="recruteur"
          tierId="rec_pro"
          lockedFeatureTitle="Le processus de recrutement"
          returnTo={typeof window !== "undefined" ? window.location.pathname : undefined}
        />
      )}

      {/* Iter 7.23 Sprint 4 — AddToListSheet rendu en sibling du UpgradeModal.
          RECRUITER-ONLY (Step 6 gate). */}
      {isRecruiter && (
        <AddToListSheet
          open={addToListOpen}
          onClose={() => setAddToListOpen(false)}
          athleteId={a.id}
          athleteFullName={`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() || "Athlète"}
        />
      )}
    </div>
  );
}
