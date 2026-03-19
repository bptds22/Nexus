/* ═══════════════════════════════════════════════════════════════
   OrphanAlert — amber banner for athletes with no assigned coach
═══════════════════════════════════════════════════════════════ */

interface OrphanAlertProps {
  /** "coach" = coach-side view, "recruiter" = recruiter-side view */
  variant?: "coach" | "recruiter";
  className?: string;
}

export default function OrphanAlert({ variant = "coach", className = "" }: OrphanAlertProps) {
  const message =
    variant === "recruiter"
      ? "Coach non assigné — Ce profil est en attente de réassignation."
      : "Aucun entraîneur assigné — Cet athlète doit être réassigné à un entraîneur actif.";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-[#F59E0B]/30 bg-[rgba(245,158,11,0.08)] ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-[13px] text-[#F59E0B] font-medium leading-snug">
        {message}
      </p>
    </div>
  );
}
