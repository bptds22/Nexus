"use client";

/**
 * Green success toast — fixed top-center, slide-in from above.
 *
 * Mirrors the shape of ErrorToast.tsx so the two read as a pair.
 * Use for confirming user-initiated writes that need acknowledgment
 * but shouldn't block the UI:
 *   - Flag/report submitted
 *   - Suggestion sent
 *   - Profile updated
 *   - Pipeline status changed (when standalone toast wanted)
 *
 * Auto-dismisses after `autoDismissMs` (default 5000); pass 0 to
 * keep open until user dismisses.
 *
 * Usage:
 *   const [success, setSuccess] = useState<SuccessToastData | null>(null);
 *   <SuccessToast data={success} onDismiss={() => setSuccess(null)} />
 *
 *   // Trigger:
 *   setSuccess({ message: "Signalement envoyé", referenceId: "18d774fe" });
 */

import { useEffect } from "react";

export interface SuccessToastData {
  message: string;
  /**
   * Optional short reference shown in muted text under the message
   * (e.g. first 8 chars of a UUID). Used to give the user a handle
   * if they need to follow up with support / admin.
   */
  referenceId?: string;
}

interface SuccessToastProps {
  data: SuccessToastData | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. Default 5000. Pass 0 to disable. */
  autoDismissMs?: number;
}

export default function SuccessToast({ data, onDismiss, autoDismissMs = 5000 }: SuccessToastProps) {
  useEffect(() => {
    if (!data || autoDismissMs <= 0) return;
    const t = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [data, autoDismissMs, onDismiss]);

  if (!data) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-[toastSlideDown_0.3s_ease-out]">
      <div className="flex items-center gap-3 bg-[#22C55E] text-white px-6 py-3.5 rounded-xl shadow-2xl max-w-[480px]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold leading-tight">{data.message}</p>
          {data.referenceId && (
            <p className="text-[11px] font-mono text-white/70 mt-0.5">Réf. {data.referenceId}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-white/80 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}