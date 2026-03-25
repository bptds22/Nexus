"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   UpgradePrompt — Subtle, dismissible upgrade card
   Shows only for free-tier users. Reads from localStorage.
═══════════════════════════════════════════════════════════════ */

interface UpgradePromptProps {
  /** localStorage key to track dismissal */
  dismissKey: string;
  /** Role-specific message */
  message: string;
  /** CTA label */
  ctaLabel?: string;
  /** CTA link (defaults to /tarifs) */
  ctaHref?: string;
}

export default function UpgradePrompt({
  dismissKey,
  message,
  ctaLabel = "Essayer gratuitement →",
  ctaHref = "/tarifs",
}: UpgradePromptProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexus_user");
      const user = raw ? JSON.parse(raw) : null;
      const tier = user?.tier || "free";
      const dismissed = localStorage.getItem(dismissKey) === "true";
      if (tier === "free" && !dismissed) setVisible(true);
    } catch {
      setVisible(true); // default: show for POC
    }
  }, [dismissKey]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(dismissKey, "true"); } catch { /* noop */ }
  };

  if (!visible) return null;

  return (
    <div className="relative bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
      {/* Gold top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#DAB65A]" />

      <div className="flex items-start gap-4 px-5 py-4">
        {/* Lock icon */}
        <div className="w-9 h-9 rounded-lg bg-[#DAB65A]/10 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DAB65A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#c8ccd4] leading-relaxed">
            {message}
          </p>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] mt-2 transition-colors uppercase tracking-wider"
          >
            {ctaLabel}
          </Link>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-white hover:bg-white/5 transition-colors"
          title="Fermer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
