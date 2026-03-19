"use client";

import React, { useState, useRef, useEffect } from "react";
import type { CoachReview } from "@/lib/types/models";
import StarRating from "@/components/ui/StarRating";

/* ── Props ── */
interface ReviewCardProps {
  review: CoachReview;
}

/* ── Relative time helper ── */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  const diffW = Math.floor(diffD / 7);
  const diffM = Math.floor(diffD / 30);
  const diffY = Math.floor(diffD / 365);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} minute${diffMin > 1 ? "s" : ""}`;
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? "s" : ""}`;
  if (diffD < 7) return `Il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
  if (diffW < 5) return `Il y a ${diffW} semaine${diffW > 1 ? "s" : ""}`;
  if (diffM < 12) return `Il y a ${diffM} mois`;
  return `Il y a ${diffY} an${diffY > 1 ? "s" : ""}`;
}

/* Stars: use shared StarRating component */

/* ── Component ── */
export default function ReviewCard({ review }: ReviewCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [localReply, setLocalReply] = useState<string | undefined>(review.coachReply);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 280;

  useEffect(() => {
    if (showReplyForm && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showReplyForm]);

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    setLocalReply(replyText.trim());
    setShowReplyForm(false);
    setReplyText("");
  };

  const displayReply = localReply;

  return (
    <div className="bg-[#22262E] rounded-lg p-4 sm:p-5">
      {/* Line 1: stars + score + recommend / timestamp */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <StarRating rating={review.overallScore} size="md" />
          <span className="text-white font-bold text-[14px]">
            {review.overallScore.toFixed(1)}
          </span>
          {review.wouldRecommend ? (
            <span className="text-[12px] text-[#22C55E] flex items-center gap-1">
              {"\uD83D\uDC4D"} Recommandé
            </span>
          ) : (
            <span className="text-[12px] text-[#E63946] flex items-center gap-1">
              {"\uD83D\uDC4E"} Non recommandé
            </span>
          )}
        </div>
        <span className="text-[12px] text-[#6B7280]">
          {relativeTime(review.createdAt)}
        </span>
      </div>

      {/* Comment */}
      {review.comment ? (
        <p className="text-[14px] text-[#D1D5DB] italic mt-3">
          &laquo;&nbsp;{review.comment}&nbsp;&raquo;
        </p>
      ) : (
        <p className="text-[14px] text-[#4B5563] mt-3">
          Aucun commentaire laissé.
        </p>
      )}

      {/* Context */}
      <p className="text-[12px] text-[#6B7280] mt-2">
        À propos de {review.athleteName} ({review.athletePosition})
      </p>

      {/* Existing reply */}
      {displayReply && (
        <div className="bg-[rgba(230,57,70,0.05)] rounded-lg p-3 mt-2">
          <span className="text-[12px] text-[#E63946] font-bold">
            ↩ Votre réponse :
          </span>
          <p className="text-[13px] text-[#D1D5DB] mt-1">{displayReply}</p>
        </div>
      )}

      {/* Reply button */}
      {!displayReply && !showReplyForm && (
        <button
          onClick={() => setShowReplyForm(true)}
          className="text-[12px] text-[#E63946] hover:underline mt-2 bg-transparent border-none cursor-pointer"
        >
          Répondre
        </button>
      )}

      {/* Reply form with slide-down */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{
          maxHeight: showReplyForm ? 200 : 0,
          opacity: showReplyForm ? 1 : 0,
        }}
      >
        <div className="mt-3">
          <textarea
            ref={textareaRef}
            value={replyText}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setReplyText(e.target.value);
            }}
            placeholder="Votre réponse..."
            className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-[#4B5563]">
              {replyText.length}/{MAX_CHARS}
            </span>
            <button
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
              className="bg-[#E63946] text-white text-[12px] px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#d63040] transition-colors"
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
