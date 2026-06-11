"use client";

/* ═══════════════════════════════════════════════════════════════
   ConsentAlert — Coach athlete profile.

   Renders ONLY when parental consent has NOT been confirmed on the
   athletes row (consentement_parental === false). When confirmed,
   renders nothing — the absence of the banner IS the confirmed signal.

   Canon : red #E63946 (action/urgent) + warning TRIANGLE icon. NEVER
   a shield (shield is reserved for verification only).

   Used by both the web coach profile (PageClient.tsx) and the future
   mobile coach profile. Presentational — write handler passed via props.
═══════════════════════════════════════════════════════════════ */

import { AnimatePresence, motion } from "framer-motion";

export interface ConsentAlertProps {
  /** athletes.consentement_parental — when true, renders null. */
  consentGiven: boolean;
  /** Coach action to confirm. Writes consentement_parental=true +
   *  consentement_parental_date=now() on the athlete row. */
  onConfirm: () => void;
}

/* Exit animation : fade + height collapse + léger scale ~240ms ease-out.
   Quand consentGiven flip à true, AnimatePresence run l'exit AVANT
   l'unmount → l'item disparait en douceur au lieu de claquer. */
export default function ConsentAlert({ consentGiven, onConfirm }: ConsentAlertProps) {
  return (
    <AnimatePresence initial={false}>
      {!consentGiven && (
        <motion.div
          key="consent-alert"
          initial={{ opacity: 0, height: 0, scale: 0.97 }}
          animate={{ opacity: 1, height: "auto", scale: 1 }}
          exit={{ opacity: 0, height: 0, scale: 0.97 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
    <div className="bg-[#E63946]/10 border border-[#E63946]/30 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#E63946]">Consentement non confirmé</p>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 leading-snug">
            Le consentement parental est requis avant d&apos;inviter l&apos;athlète.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        className="shrink-0 px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[12px] uppercase tracking-[0.1em] hover:bg-[#D42B22] active:bg-[#D42B22] transition-colors"
      >
        Confirmer
      </button>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
