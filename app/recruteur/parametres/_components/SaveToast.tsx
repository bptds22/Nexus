"use client";

import { useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────
   SaveToast — success toast that auto-dismisses after 3 seconds
───────────────────────────────────────────────────────────────── */

interface Props {
  show: boolean;
  onHide: () => void;
  message?: string;
}

export default function SaveToast({ show, onHide, message = "Préférences mises à jour" }: Props) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onHide, 3000);
    return () => clearTimeout(t);
  }, [show, onHide]);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2.5 bg-[#22C55E] text-white rounded-lg px-5 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] animate-[nxDropIn_0.2s_ease-out]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span className="text-[14px] font-bold">{message}</span>
    </div>
  );
}
