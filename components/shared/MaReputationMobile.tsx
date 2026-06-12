"use client";

/* ═══════════════════════════════════════════════════════════════
   MaReputationMobile — Coach's public profile / reputation mobile.

   Composes the existing components/reputation/* widgets around a
   new CoachHeroBlock identity hero + the extracted AdaptiveBadgesRow
   for the 4 reputation badges.

   Accepts an optional coachId prop so the same component serves :
   - own-view  : auth.uid() (default)
   - recruiter→coach view (future) : coach's id passed from
     /recruteur/coach/[id]/page.tsx

   No tier gate — coach reputation is free.

   Layout :
   - Sticky scroll-blur header (back chevron + "Ma Réputation")
   - CoachHeroBlock (photo + name + school/team)
   - ReputationScoreCard (public or pending placeholder)
   - 4 reputation badges via AdaptiveBadgesRow
   - QuickStatsPills
   - CriteriaBreakdown (only when ≥3 reviews)
   - ReviewFeed
   - NavRow → /coach/reputation/carriere drill-down

   The CareerToggle isn't inlined — it's a heavy editor; we drill
   into it instead so the main page stays scannable.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ReputationScoreCard from "@/components/reputation/ReputationScoreCard";
import QuickStatsPills from "@/components/reputation/QuickStatsPills";
import CriteriaBreakdown from "@/components/reputation/CriteriaBreakdown";
import ReviewFeed from "@/components/reputation/ReviewFeed";
import { CoachHeroBlock } from "@/components/shared/CoachHeroBlock";
import { AdaptiveBadgesRow } from "@/components/shared/badges/AdaptiveBadgesRow";
import { Group, NavRow, triggerHaptic } from "@/components/shared/settings";
import { BADGE_COLORS } from "@/lib/types/models";
import { useCoachReputationStats } from "@/lib/queries/coach/useCoachReputationStats";

interface Props {
  /** When omitted, viewers their own reputation (auth.uid()). When
   *  provided, displays the named coach (for the future
   *  /recruteur/coach/[id] reuse). */
  coachId?: string | null;
  /** Override the back-button destination. Defaults to
   *  /coach/tableau-de-bord for own-view ; the recruiter→coach
   *  view will want to go back to the previous list. */
  backHref?: string;
}

/* ── Reputation badge definitions (subset of desktop BadgeGrid).
   The desktop component lives in components/reputation/BadgeGrid.tsx
   ; we replicate the earned/unearned logic here so the mobile feed
   can render via AdaptiveBadgesRow + a slim cell. ──────────────── */

interface ReputationBadgeDef {
  key: "evaluated" | "recommended" | "elite" | "placeur";
  label: string;
  iconColor: string;
  bgColor: string;
  icon: React.ReactNode;
  isEarned: (s: BadgeInput) => boolean;
  progressText: (s: BadgeInput) => string;
  conditionText: string;
}

interface BadgeInput {
  totalReviews: number;
  overallScore: number;
  recommendRate: number;
  totalPlacements: number;
}

const CheckSvg = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const MedalSvg = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6" />
    <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11" />
  </svg>
);
const RocketSvg = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 3 0 3 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-3 0-3" />
  </svg>
);
const TargetSvg = ({ color, size = 22 }: { color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const BADGES: ReputationBadgeDef[] = [
  {
    key: "evaluated",
    label: "Évalué",
    iconColor: BADGE_COLORS.evaluated,
    bgColor: "rgba(59,130,246,0.15)",
    icon: <CheckSvg color={BADGE_COLORS.evaluated} />,
    isEarned: (s) => s.totalReviews >= 3,
    progressText: (s) => s.totalReviews < 3 ? `Encore ${3 - s.totalReviews}` : "",
    conditionText: "3+ évaluations reçues",
  },
  {
    key: "recommended",
    label: "Recommandé",
    iconColor: BADGE_COLORS.recommended,
    bgColor: "rgba(255,255,255,0.10)",
    icon: <MedalSvg color={BADGE_COLORS.recommended} />,
    isEarned: (s) => s.totalReviews >= 5 && s.recommendRate >= 80,
    progressText: (s) => {
      if (s.totalReviews < 5) return `Encore ${5 - s.totalReviews}`;
      if (s.recommendRate < 80) return `${Math.ceil(80 - s.recommendRate)} pt`;
      return "";
    },
    conditionText: "5+ évaluations et 80%+ recommandation",
  },
  {
    key: "elite",
    label: "Coach Élite",
    iconColor: BADGE_COLORS.elite,
    bgColor: "rgba(230,57,70,0.15)",
    icon: <RocketSvg color={BADGE_COLORS.elite} />,
    isEarned: (s) => s.totalReviews >= 15 && s.overallScore >= 4.5 && s.recommendRate >= 90,
    progressText: (s) => {
      if (s.totalReviews < 15) return `Encore ${15 - s.totalReviews}`;
      if (s.overallScore < 4.5) return `Score ${(4.5 - s.overallScore).toFixed(1)}`;
      if (s.recommendRate < 90) return `${90 - Math.floor(s.recommendRate)}%`;
      return "";
    },
    conditionText: "15+ évaluations, moyenne 4.5+, 90%+ recommandation",
  },
  {
    key: "placeur",
    label: "Placeur",
    iconColor: BADGE_COLORS.placeur,
    bgColor: "rgba(255,255,255,0.10)",
    icon: <TargetSvg color={BADGE_COLORS.placeur} />,
    isEarned: (s) => s.totalPlacements >= 5,
    progressText: (s) => s.totalPlacements < 5 ? `Encore ${5 - s.totalPlacements}` : "",
    conditionText: "5+ athlètes signés (LETTRE_SIGNEE)",
  },
];

/* ── Single badge cell (mobile-tuned BadgeGrid item) ──────────── */

function ReputationBadgeCell({
  def, stats, openTooltip, onTapTooltip,
}: {
  def: ReputationBadgeDef;
  stats: BadgeInput;
  openTooltip: string | null;
  onTapTooltip: (key: string | null) => void;
}) {
  const earned = def.isEarned(stats);
  const progress = def.progressText(stats);
  const showTip = openTooltip === def.key;
  return (
    <div className="relative flex flex-col items-center" style={{ width: 78 }}>
      <button
        type="button"
        aria-label={def.label}
        onClick={() => {
          triggerHaptic("Light");
          if (earned) return;
          onTapTooltip(showTip ? null : def.key);
        }}
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: 48,
          height: 48,
          backgroundColor: earned ? def.bgColor : "#1A1D24",
          opacity: earned ? 1 : 0.55,
        }}
      >
        {def.icon}
        {earned && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: def.iconColor }}
            aria-hidden
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#111317" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </button>
      <span
        className="mt-1.5 text-center text-[11px] font-bold leading-tight"
        style={{ color: earned ? "#fff" : "#6B7280" }}
      >
        {def.label}
      </span>
      {!earned && progress && (
        <span className="text-[10px] text-[#4B5563] text-center mt-0.5 leading-tight">
          {progress}
        </span>
      )}
      {showTip && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[180px] bg-[#111317] border border-white/[0.08] text-[#D1D5DB] text-[11px] p-2.5 rounded-lg shadow-lg z-30 leading-snug">
          {def.conditionText}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

export function MaReputationMobile({ coachId, backHref }: Props) {
  const router = useRouter();
  const { data, isLoading } = useCoachReputationStats(coachId);
  const [scrollY, setScrollY] = useState(0);
  const [openTooltip, setOpenTooltip] = useState<string | null>(null);

  /* Sticky-header scroll-blur (canon idiom across mobile screens). */
  useEffect(() => {
    let raf = 0; let last = 0; let tick = false;
    const onScroll = () => {
      last = window.scrollY || 0;
      if (!tick) {
        raf = window.requestAnimationFrame(() => { setScrollY(last); tick = false; });
        tick = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);
  const scrolled = scrollY > 20;

  function handleBack() {
    triggerHaptic("Light");
    if (backHref) {
      router.push(backHref);
    } else {
      router.push("/coach/tableau-de-bord");
    }
  }

  if (isLoading && !data) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Chargement…</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar">
        <div className="px-4 pt-10 pb-3 text-[#6b7280] text-[14px]">Profil indisponible.</div>
      </div>
    );
  }

  const careerOuverte = data.careerOpen;
  const careerSummary = [
    careerOuverte ? "Ouvert" : "Fermé",
    data.careerSports.length ? `${data.careerSports.length} sport${data.careerSports.length > 1 ? "s" : ""}` : null,
    data.careerRegions.length ? `${data.careerRegions.length} région${data.careerRegions.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");

  const stats: BadgeInput = {
    totalReviews: data.totalReviews,
    overallScore: data.overallScore,
    recommendRate: data.recommendRate,
    totalPlacements: data.totalPlacements,
  };

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-[#111317] text-white nx-mobile-pb-tabbar"
      onClick={() => { if (openTooltip) setOpenTooltip(null); }}
    >
      {/* Sticky header */}
      <div
        className="sticky top-0 z-30"
        style={{
          backgroundColor: scrolled ? "rgba(17,19,23,0.85)" : "#111317",
          backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrolled ? "0.5px solid rgba(255,255,255,0.08)" : "0.5px solid transparent",
          transition: "background-color 200ms, backdrop-filter 200ms, border-bottom-color 200ms",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="h-11 flex items-center px-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={handleBack}
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/[0.08] text-[#8a8d96]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center font-head text-[17px] font-black text-white uppercase tracking-tight pr-9">
            Ma Réputation
          </h1>
        </div>
      </div>

      {/* Identity hero */}
      <CoachHeroBlock
        name={data.displayName}
        photoUrl={data.photoUrl}
        firstName={data.firstName}
        lastName={data.lastName}
        school={data.schoolName}
        team={data.teamName}
        verified={false}
      />

      {/* Score card (public or pending placeholder) */}
      <div className="px-4 pt-2">
        <ReputationScoreCard
          overallScore={data.overallScore}
          totalReviews={data.totalReviews}
          totalReviewers={data.totalReviews}
          recommendRate={data.recommendRate}
          isPublic={data.isPublic}
        />
      </div>

      {/* Badges row — AdaptiveBadgesRow with 4 reputation badges. */}
      <div className="px-4 pt-5 pb-1">
        <p className="text-[12px] font-bold tracking-[0.18em] uppercase text-[#6B7280] mb-3 text-center">
          Badges gagnés
        </p>
        <AdaptiveBadgesRow
          items={BADGES}
          renderItem={(def) => (
            <ReputationBadgeCell
              def={def}
              stats={stats}
              openTooltip={openTooltip}
              onTapTooltip={(k) => setOpenTooltip(k)}
            />
          )}
        />
      </div>

      {/* Quick stats pills — centered on mobile so wrapped rows don't
          look ragged left-aligned ; the wide "Temps de réponse moyen"
          centers on its own row and the two narrower pills center
          together on row 2. Desktop layout unaffected (opt-in prop). */}
      <div className="px-4 pt-5">
        <QuickStatsPills
          avgResponseTimeHours={data.avgResponseTimeHours}
          totalPlacements={data.totalPlacements}
          profileCompletionRate={data.profileCompletionRate}
          className="justify-center"
        />
      </div>

      {/* Criteria breakdown (only when score is public, ≥3 reviews) */}
      {data.totalReviews >= 3 && (
        <div className="px-4 pt-5">
          <CriteriaBreakdown
            profileQuality={data.profileQualityAvg}
            responsiveness={data.responsivenessAvg}
            honesty={data.honestyAvg}
            professionalism={data.professionalismAvg}
          />
        </div>
      )}

      {/* Review feed */}
      <div className="px-4 pt-5">
        <ReviewFeed reviews={data.reviews} />
      </div>

      {/* Career toggle → drill-down */}
      <div className="pt-5 pb-6">
        <Group>
          <NavRow
            label="Opportunités CÉGEP"
            sublabel={careerSummary || "Configure tes préférences de carrière"}
            isFirst
            onTap={() => { triggerHaptic("Light"); router.push("/coach/reputation/carriere"); }}
          />
        </Group>
      </div>

      <div className="h-8" />
    </div>
  );
}
