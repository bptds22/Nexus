"use client";

import { useState } from "react";
import ReviewStarInput from "./ReviewStarInput";
import ReviewRecommendToggle from "./ReviewRecommendToggle";
import ReviewCommentInput from "./ReviewCommentInput";
import ReviewAnonymityNotice from "./ReviewAnonymityNotice";
import EntityLink from "@/components/shared/EntityLink";

const CRITERIA = [
  { key: "profileQuality", label: "Qualité des profils", helper: "Les données étaient-elles complètes et fiables ?" },
  { key: "responsiveness", label: "Réactivité", helper: "Le coach a-t-il répondu rapidement ?" },
  { key: "evaluationHonesty", label: "Honnêteté des évaluations", helper: "L'évaluation correspondait-elle à la réalité ?" },
  { key: "professionalism", label: "Professionnalisme", helper: "La communication était-elle de qualité ?" },
] as const;

interface Props {
  coachName: string;
  coachId?: string;
  athleteName?: string;
  athletePosition?: string;
  onSubmit: (data: {
    profileQuality: number;
    responsiveness: number;
    evaluationHonesty: number;
    professionalism: number;
    wouldRecommend: boolean;
    comment: string;
  }) => void;
  onDismiss: () => void;
}

export default function ReviewWidgetForm({ coachName, coachId, athleteName, athletePosition, onSubmit, onDismiss }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({
    profileQuality: 0,
    responsiveness: 0,
    evaluationHonesty: 0,
    professionalism: 0,
  });
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");

  const allScoresFilled = Object.values(scores).every((s) => s > 0);
  const canSubmit = allScoresFilled && recommend !== null;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      profileQuality: scores.profileQuality,
      responsiveness: scores.responsiveness,
      evaluationHonesty: scores.evaluationHonesty,
      professionalism: scores.professionalism,
      wouldRecommend: recommend!,
      comment,
    });
  }

  return (
    <div
      className="relative rounded-xl p-6 space-y-5 animate-[slideDown_400ms_ease-out_both]"
      style={{
        background: "#1A1D24",
        borderLeft: "3px solid #E63946",
        border: "1px solid #2D3748",
        borderLeftWidth: 3,
        borderLeftColor: "#E63946",
      }}
    >
      {/* Dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-4 right-4 transition-colors"
        style={{ color: "#4B5563", fontSize: 22, lineHeight: 1 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#9CA3AF"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#4B5563"; }}
      >
        ×
      </button>

      {/* Header */}
      <div>
        <p className="font-head text-[14px] font-bold uppercase tracking-[0.15em]" style={{ color: "#E63946" }}>
          Évaluez votre échange
        </p>
        <p className="text-[16px] text-[#D1D5DB] mt-1">
          avec <EntityLink type="coach" id={coachId} name={coachName} portal="recruiter" />
        </p>
        {athleteName && (
          <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
            À propos de {athleteName}{athletePosition ? ` (${athletePosition})` : ""}
          </p>
        )}
      </div>

      {/* 4 Criteria */}
      <div className="rounded-lg overflow-hidden" style={{ background: "#13151a", border: "1px solid #2A2D35" }}>
        {CRITERIA.map((c, idx) => (
          <div
            key={c.key}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: idx < CRITERIA.length - 1 ? "1px solid #2A2D35" : "none" }}
          >
            <div className="flex-1 mr-4">
              <p className="text-[14px] font-bold text-white">{c.label}</p>
              <p className="text-[12px]" style={{ color: "#6B7280" }}>{c.helper}</p>
            </div>
            <ReviewStarInput
              value={scores[c.key]}
              onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))}
            />
          </div>
        ))}
      </div>

      {/* Recommend */}
      <ReviewRecommendToggle value={recommend} onChange={setRecommend} />

      {/* Comment */}
      <ReviewCommentInput value={comment} onChange={setComment} />

      {/* Anonymity */}
      <ReviewAnonymityNotice />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full font-head text-[14px] font-bold uppercase tracking-[0.12em] rounded-lg py-3.5 transition-all"
        style={{
          background: canSubmit ? "#E63946" : "#333",
          color: canSubmit ? "#FFFFFF" : "#666",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        Envoyer l&apos;évaluation
      </button>
    </div>
  );
}
