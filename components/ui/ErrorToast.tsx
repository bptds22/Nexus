"use client";

import Link from "next/link";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/**
 * Red error toast — fixed top-center, slide-in from above.
 *
 * Used across the app for surfacing user-facing errors that need
 * attention but shouldn't block the UI:
 * - Tier-denial errors with optional upgrade CTA (messages compose,
 *   future: search filters, advanced features)
 * - Auth errors on signup/login (duplicate email, weak password,
 *   network issues)
 *
 * Usage:
 *   const [error, setError] = useState<ErrorToastData | null>(null);
 *   <ErrorToast data={error} onDismiss={() => setError(null)} />
 *
 *   // Trigger:
 *   setError({ message: "Cet email est déjà utilisé.", showUpgrade: false });
 */
export interface ErrorToastData {
  message: string;
  showUpgrade?: boolean;
}

interface ErrorToastProps {
  data: ErrorToastData | null;
  onDismiss: () => void;
}

export default function ErrorToast({ data, onDismiss }: ErrorToastProps) {
  if (!data) return null;
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-[toastSlideDown_0.3s_ease-out]">
      <div className="flex items-center gap-3 bg-[#E63946] text-white px-6 py-3.5 rounded-xl shadow-2xl max-w-[480px]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-[14px] font-bold flex-1">{data.message}</span>
        {data.showUpgrade && !IS_CAPACITOR && (
          <Link
            href="/tarifs"
            className="shrink-0 bg-white text-[#E63946] px-3 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-wider hover:bg-white/90 transition-colors"
          >
            Passer à Pro
          </Link>
        )}
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
