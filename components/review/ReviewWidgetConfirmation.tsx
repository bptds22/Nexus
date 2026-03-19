import EntityLink from "@/components/shared/EntityLink";
import StarRating from "@/components/ui/StarRating";

interface Props {
  coachName: string;
  coachId?: string;
  overallScore: number;
  wouldRecommend: boolean;
}

/* Stars: use shared StarRating component */

export default function ReviewWidgetConfirmation({ coachName, coachId, overallScore, wouldRecommend }: Props) {
  return (
    <div
      className="rounded-xl p-5 animate-[fadeIn_300ms_ease-out_both]"
      style={{
        background: "rgba(34,197,94,0.05)",
        borderLeft: "3px solid #22C55E",
        border: "1px solid rgba(34,197,94,0.2)",
        borderLeftWidth: 3,
        borderLeftColor: "#22C55E",
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-[24px] shrink-0">✅</span>
        <div className="space-y-2">
          <p className="text-[16px] font-bold text-white">Merci pour votre évaluation !</p>
          <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
            Votre feedback aide <EntityLink type="coach" id={coachId} name={coachName} portal="recruiter" className="text-[13px]" /> à s&apos;améliorer et les autres recruteurs à identifier les meilleurs entraîneurs.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <StarRating rating={overallScore} size="md" />
            <span className="text-[14px] font-bold text-white">{overallScore.toFixed(1)}/5</span>
            <span
              className="text-[13px] font-bold ml-2"
              style={{ color: wouldRecommend ? "#22C55E" : "#E63946" }}
            >
              {wouldRecommend ? "👍 Recommandé" : "👎 Non recommandé"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
