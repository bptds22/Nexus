"use client";

/* ═══════════════════════════════════════════════════════════════
   VerifyAlert — Coach athlete profile.

   Renders ONLY when athletes.verified !== true. When verified, renders
   nothing.

   Canon : GRAY #4a4d56 box treatment (border / bg tint / icon tint)
   for the non-verified state itself, with the action button in BLUE
   #3B82F6 (the canon verification signal — same as the À traiter row
   "Vérifier" button). Icon : warning TRIANGLE. Shield is reserved for
   the verified badge ONLY, never on this alert.

   No confirm step here — single tap on the button fires onVerify. The
   web profile currently routes this to its existing VerifyModal
   (confirm step), the mobile profile will fire the verify write
   directly. Both call the same `onVerify` prop.

   Presentational — write handler passed via props.
═══════════════════════════════════════════════════════════════ */

import { AnimatePresence, motion } from "framer-motion";

export interface VerifyAlertProps {
  /** athletes.verified — when true (and not needsReverify), renders null. */
  isVerified: boolean;
  /** athletes.modified_since_verification — true quand l'athlète est
   *  vérifié MAIS modifié depuis. Dans ce cas l'alerte s'affiche quand même
   *  (sinon le coach n'aurait aucune action sur un profil vérifié-modifié)
   *  avec une copie « à reconfirmer » + bouton « Re-vérifier ». Optionnel :
   *  les appelants qui ne le passent pas gardent le comportement d'avant
   *  (alerte uniquement si non vérifié). */
  needsReverify?: boolean;
  /** Coach action. Web wires this to setShowVerifyModal(true) (web's
   *  existing confirm-modal flow). Mobile wires it to a direct update on
   *  the athletes row. Both call the same prop name. */
  onVerify: () => void;
}

/* Exit animation : fade + height collapse ~240ms ease-out quand
   isVerified bascule à true (cf. ConsentAlert pour le pattern). */
export default function VerifyAlert({ isVerified, needsReverify = false, onVerify }: VerifyAlertProps) {
  // L'alerte s'affiche si NON vérifié OU si vérifié-mais-modifié.
  const show = !isVerified || needsReverify;
  // Distingue les deux cas pour la copie + le libellé du bouton.
  const reverify = isVerified && needsReverify;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="verify-alert"
          initial={{ opacity: 0, height: 0, scale: 0.97 }}
          animate={{ opacity: 1, height: "auto", scale: 1 }}
          exit={{ opacity: 0, height: 0, scale: 0.97 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          style={{ overflow: "hidden" }}
        >
    <div className="bg-[#4a4d56]/15 border border-[#4a4d56]/40 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-[#3B82F6]/15 flex items-center justify-center flex-shrink-0">
          {/* Icon : circle-with-check (verification domain) — matches the
              À traiter VerifyActionRow icon. Blue stroke per user spec
              ("BLUE circle badge icon (like À traiter)"). */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-white">
            {reverify ? "Profil modifié depuis la vérification" : "Profil non vérifié"}
          </p>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5 leading-snug">
            {reverify
              ? "Le profil a changé depuis la dernière vérification — reconfirme-le pour réactiver le badge."
              : "Ce profil n'est pas visible par les recruteurs tant qu'il n'est pas vérifié."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onVerify}
        className="shrink-0 px-5 py-2.5 rounded-lg bg-[#3B82F6] text-white font-bold text-[12px] uppercase tracking-[0.1em] hover:bg-[#2563EB] active:bg-[#2563EB] transition-colors cursor-pointer"
      >
        {reverify ? "Re-vérifier" : "Vérifier maintenant"}
      </button>
    </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
