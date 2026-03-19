/* ═══════════════════════════════════════════════════════════════
   DeactivatedBadge — small gray inline badge: "Désactivé"
   Used next to coach/recruiter names when accountStatus === 'DESACTIVE'
═══════════════════════════════════════════════════════════════ */

interface DeactivatedBadgeProps {
  className?: string;
}

export default function DeactivatedBadge({ className = "" }: DeactivatedBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded bg-[rgba(107,114,128,0.2)] text-[#6B7280] ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      Désactivé
    </span>
  );
}
