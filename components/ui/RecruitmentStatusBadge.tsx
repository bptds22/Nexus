import type { GlobalRecruitmentStatus } from "@/lib/types/models";
import { RECRUITMENT_STATUS_CONFIG } from "@/lib/types/models";

interface RecruitmentStatusBadgeProps {
  status: GlobalRecruitmentStatus;
  committedSchoolName?: string;
  openToOffers?: boolean | null;
  size?: "sm" | "md";
}

export default function RecruitmentStatusBadge({
  status,
  committedSchoolName,
  openToOffers,
  size = "md",
}: RecruitmentStatusBadgeProps) {
  const cfg = RECRUITMENT_STATUS_CONFIG[status];
  if (!cfg) return null;

  const isRecruited = status === "RECRUTE";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  const label = isRecruited && committedSchoolName
    ? `Recruté à ${committedSchoolName}`
    : cfg.label;

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full ${padding} ${textSize} font-bold tracking-wider uppercase`}
        style={{ backgroundColor: `${cfg.dotColor}15`, color: cfg.dotColor }}
      >
        <span className={`${dotSize} rounded-full shrink-0`} style={{ backgroundColor: cfg.dotColor }} />
        {label}
      </span>
      {isRecruited && openToOffers !== null && openToOffers !== undefined && (
        <span className={`${textSize} font-bold ${openToOffers ? "text-green-500" : "text-[#6B7280]"}`}>
          {openToOffers ? "Ouvert aux offres" : "Fermé aux offres"}
        </span>
      )}
    </span>
  );
}
