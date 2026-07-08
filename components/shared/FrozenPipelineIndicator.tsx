/* ═══════════════════════════════════════════════════════════════
   FrozenPipelineIndicator — lock icon + "Gelé" label in gray
   Displayed next to pipeline status when pipeline is frozen.
═══════════════════════════════════════════════════════════════ */

interface FrozenPipelineIndicatorProps {
  /** "coach" or "recruteur" for tooltip text */
  entityType?: "coach" | "recruteur";
  className?: string;
}

export default function FrozenPipelineIndicator({
  entityType = "recruteur",
  className = "",
}: FrozenPipelineIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-[#6B7280] ${className}`}
      title={`Ce processus est gelé suite à la désactivation du ${entityType}. Actions suspendues.`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      Gelé
    </span>
  );
}
