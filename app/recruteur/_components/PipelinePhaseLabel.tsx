import type { RecruitmentPhase } from "@/lib/config/recruitmentStatuses";
import { getPhaseLabel } from "@/lib/config/recruitmentStatuses";

/* ─────────────────────────────────────────────────────────────────
   PipelinePhaseLabel
   Prominent section header with phase icon, label, count, and rule.
───────────────────────────────────────────────────────────────── */

interface Props {
  phase: RecruitmentPhase;
  count?: number;
}

/* Phase-specific icons */
function PhaseIcon({ phase, color }: { phase: RecruitmentPhase; color: string }) {
  const s = 18;
  if (phase === "commitment") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (phase === "auto") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  // exit
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
    </svg>
  );
}

export default function PipelinePhaseLabel({ phase, count }: Props) {
  const label = getPhaseLabel(phase);
  if (!label) return null;

  const color = phase === "commitment" ? "#E63946" : phase === "exit" ? "#6B7280" : "#6B7280";
  const bgTint = phase === "commitment" ? "rgba(230,57,70,0.08)" : "rgba(107,114,128,0.06)";

  return (
    <div className="flex items-center gap-4 mb-5 mt-16 first:mt-0">
      {/* Icon + label block */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 rounded-lg"
        style={{ backgroundColor: bgTint }}
      >
        <PhaseIcon phase={phase} color={color} />
        <span
          className="text-[15px] font-head font-black tracking-[0.2em] uppercase"
          style={{ color }}
        >
          {label}
        </span>
        {count !== undefined && (
          <span
            className="text-[13px] font-black min-w-[26px] h-[26px] flex items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            {count}
          </span>
        )}
      </div>

      {/* Decorative line */}
      <div
        className="flex-1 h-px"
        style={{
          background: phase === "commitment"
            ? "linear-gradient(to right, rgba(230,57,70,0.4), transparent)"
            : "linear-gradient(to right, rgba(107,114,128,0.3), transparent)",
        }}
      />
    </div>
  );
}
