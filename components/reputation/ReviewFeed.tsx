"use client";

import React, { useState, useMemo } from "react";
import type { CoachReview } from "@/lib/types/models";
import ReviewCard from "./ReviewCard";

/* ── Props ── */
interface ReviewFeedProps {
  reviews: CoachReview[];
}

/* ── Empty state icon ── */
const AwardIcon = () => (
  <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
    <circle cx="12" cy="8" r="6" />
    <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.11" />
  </svg>
);

/* ── Component ── */
export default function ReviewFeed({ reviews }: ReviewFeedProps) {
  const [visibleCount, setVisibleCount] = useState(5);

  const sortedReviews = useMemo(
    () =>
      [...reviews].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [reviews]
  );

  const visibleReviews = sortedReviews.slice(0, visibleCount);
  const hasMore = visibleCount < sortedReviews.length;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6">
      <h3 className="font-head text-[16px] font-bold text-white">
        Évaluations reçues
      </h3>
      <p className="text-[12px] text-[#6B7280] mt-1 mb-4">
        Les commentaires sont anonymes. Seul vous pouvez les voir.
      </p>

      {reviews.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center gap-3 py-8">
          <AwardIcon />
          <p className="text-[14px] text-[#6B7280] text-center">
            Vous n&apos;avez pas encore reçu d&apos;évaluation.
          </p>
          <p className="text-[13px] text-[#4B5563] text-center max-w-sm">
            Les recruteurs pourront vous évaluer après un échange de messages.
          </p>
          <a
            href="#"
            className="mt-2 inline-flex items-center bg-[#E63946] text-white text-[13px] font-bold px-5 py-2.5 rounded-lg hover:bg-[#d63040] transition-colors"
          >
            Compléter mon profil
          </a>
        </div>
      ) : (
        /* ── Review list ── */
        <div className="flex flex-col gap-3">
          {visibleReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + 5)}
              className="mt-2 self-center border border-[#2A2D35] text-[#9CA3AF] text-[13px] rounded-lg px-4 py-2 hover:bg-[#22262E] transition-colors bg-transparent cursor-pointer"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
    </div>
  );
}
