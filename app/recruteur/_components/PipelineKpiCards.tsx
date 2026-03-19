import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";
import { StatusIcon } from "./RecruitmentStatusBadge";

/* ─────────────────────────────────────────────────────────────────
   PipelineKpiCards
   Clickable KPI boxes: icon + count + label per active status.
   Auto = gray, Commitment = red.
───────────────────────────────────────────────────────────────── */

type FilterKey = "tous" | RecruitmentStatus;

interface Props {
  counts: Record<RecruitmentStatus, number>;
  activeFilter?: FilterKey;
  onFilterChange?: (filter: FilterKey) => void;
}

const DISPLAY_STATUSES: RecruitmentStatus[] = [
  "identifie", "contacte", "en_discussion", "visite_planifiee", "engage", "lettre_signee",
];

export default function PipelineKpiCards({ counts, activeFilter, onFilterChange }: Props) {
  const interactive = !!onFilterChange;
  const totalActive = DISPLAY_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
      {/* "Tous" box */}
      {interactive && (
        <button
          type="button"
          onClick={() => onFilterChange("tous")}
          className="flex flex-col items-center gap-1.5 rounded-lg py-3 px-2 border transition-all cursor-pointer"
          style={{
            borderColor: activeFilter === "tous" ? "#E63946" : "#2D3748",
            background: activeFilter === "tous" ? "rgba(230,51,41,0.10)" : "transparent",
            boxShadow: activeFilter === "tous" ? "0 0 12px rgba(230,51,41,0.15)" : "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={activeFilter === "tous" ? "#E63946" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
          <span
            className="text-[20px] font-head font-black leading-none"
            style={{ color: activeFilter === "tous" ? "#E63946" : "#9CA3AF" }}
          >
            {totalActive}
          </span>
          <span
            className="text-[9px] font-bold tracking-[0.15em] uppercase"
            style={{ color: activeFilter === "tous" ? "rgba(230,51,41,0.7)" : "rgba(255,255,255,0.4)" }}
          >
            Tous
          </span>
        </button>
      )}

      {DISPLAY_STATUSES.map((s) => {
        const cfg = getStatusConfig(s);
        const count = counts[s] || 0;
        const isCommitment = cfg.phase === "commitment";
        const dimmed = count === 0;
        const isSelected = activeFilter === s;

        const borderColor = isSelected
          ? cfg.color
          : dimmed ? "#2D3748" : isCommitment ? "rgba(230,51,41,0.3)" : "rgba(107,114,128,0.25)";

        const bg = isSelected
          ? isCommitment ? "rgba(230,51,41,0.12)" : "rgba(107,114,128,0.10)"
          : dimmed ? "transparent" : isCommitment ? "rgba(230,51,41,0.06)" : "rgba(107,114,128,0.05)";

        const shadow = isSelected
          ? isCommitment ? "0 0 12px rgba(230,51,41,0.2)" : "0 0 12px rgba(107,114,128,0.15)"
          : "none";

        const Tag = interactive ? "button" : "div";

        return (
          <Tag
            key={s}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onFilterChange(s) : undefined}
            className={`flex flex-col items-center gap-1.5 rounded-lg py-3 px-2 border transition-all ${interactive ? "cursor-pointer" : ""}`}
            style={{ borderColor, background: bg, boxShadow: shadow }}
          >
            <StatusIcon icon={cfg.icon} color={dimmed && !isSelected ? "#4a4d56" : cfg.color} size={18} />
            <span
              className="text-[20px] font-head font-black leading-none"
              style={{ color: dimmed && !isSelected ? "#4a4d56" : cfg.color }}
            >
              {count}
            </span>
            <span
              className="text-[9px] font-black tracking-[0.15em] uppercase"
              style={{ color: dimmed && !isSelected ? "#4a4d56" : cfg.color }}
            >
              {cfg.shortLabel}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
