"use client";

import ReputationScoreCard from "@/components/reputation/ReputationScoreCard";
import BadgeGrid from "@/components/reputation/BadgeGrid";
import QuickStatsPills from "@/components/reputation/QuickStatsPills";
import CriteriaBreakdown from "@/components/reputation/CriteriaBreakdown";
import ReviewFeed from "@/components/reputation/ReviewFeed";
import CareerToggle from "@/components/reputation/CareerToggle";
import { mockCoachReputation, mockCoachReviews } from "@/lib/mock";
import { RSEQ_SPORTS, QC_REGIONS } from "@/lib/mock/recruiterSettings";

/* ═══════════════════════════════════════════════════════════════
   Coach Reputation — /coach/reputation
   Score, badges, évaluations recruteurs, opportunités CÉGEP
═══════════════════════════════════════════════════════════════ */

export default function CoachReputationPage() {
  const rep = mockCoachReputation;

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="font-head text-[22px] font-black text-white uppercase tracking-tight">
          Ma réputation
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          Votre score est basé sur les évaluations des recruteurs CÉGEP après
          chaque échange.
        </p>
      </div>

      {/* ── Section 1 — Score global + Badges ───────────────── */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Left — Score */}
          <div className="flex-1">
            <ReputationScoreCard
              overallScore={rep.overallScore}
              totalReviews={rep.totalReviews}
              totalReviewers={rep.totalReviewers}
              recommendRate={rep.recommendRate}
              isPublic={rep.isPublic}
            />
          </div>

          {/* Right — Badges */}
          <div className="flex-1">
            <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-4">
              Badges gagnés
            </p>
            <BadgeGrid
              currentBadge={rep.badge}
              hasPlaceurBadge={rep.hasPlaceurBadge}
              totalReviews={rep.totalReviews}
              overallScore={rep.overallScore}
              recommendRate={rep.recommendRate}
              totalPlacements={rep.totalPlacements}
            />
          </div>
        </div>

        {/* Quick stats pills */}
        <div className="mt-6 pt-6 border-t border-[#1e2128]">
          <QuickStatsPills
            avgResponseTimeHours={rep.avgResponseTimeHours}
            totalPlacements={rep.totalPlacements}
            profileCompletionRate={rep.profileCompletionRate}
          />
        </div>
      </div>

      {/* ── Section 2 — Détail par critère ──────────────────── */}
      <CriteriaBreakdown
        profileQuality={rep.profileQualityAvg}
        responsiveness={rep.responsivenessAvg}
        honesty={rep.honestyAvg}
        professionalism={rep.professionalismAvg}
      />

      {/* ── Section 3 — Évaluations reçues ──────────────────── */}
      <ReviewFeed reviews={mockCoachReviews} />

      {/* ── Section 4 — Opportunités CÉGEP ──────────────────── */}
      <CareerToggle
        initialOpen={rep.openToOpportunities}
        initialSports={rep.targetSports ?? []}
        initialRegions={rep.targetRegions ?? []}
        initialRole={rep.targetRole}
        initialBio={rep.careerBio ?? ""}
        allSports={RSEQ_SPORTS}
        allRegions={QC_REGIONS}
      />
    </div>
  );
}
