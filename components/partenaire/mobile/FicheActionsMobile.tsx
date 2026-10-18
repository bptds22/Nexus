"use client";

/* ═══════════════════════════════════════════════════════════════
   FicheActionsMobile — la feuille d'actions iOS de la fiche athlète
   PARTENAIRE dans l'appli (1.4.5, chrome natif intérimaire). Copie du
   ListActionSheet local de RecruteurListeDetailMobile : portée sur
   document.body (AnimatedRoute est un conteneur transformé — un `fixed`
   à l'intérieur y resterait piégé), ressort, liste d'actions + Annuler.

   Le web n'utilise pas ce fichier : il garde son sélecteur de format et
   ses boutons.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { triggerHaptic } from "@/lib/haptics";

export interface ActionFiche {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

const abonnementVide = () => () => {};

/** Vrai une fois côté client (pas de setState dans un effet). */
function useCoteClient(): boolean {
  return useSyncExternalStore(abonnementVide, () => true, () => false);
}

export default function FeuilleActionsFiche({ open, onClose, actions }: {
  open: boolean;
  onClose: () => void;
  actions: ActionFiche[];
}) {
  const client = useCoteClient();
  if (!client) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed inset-x-3 bottom-3 z-[75] flex flex-col gap-2"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            data-feuille-actions-fiche
          >
            <div className="rounded-2xl bg-[#1A1D24] overflow-hidden">
              {actions.map((a, idx) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={a.disabled}
                  onClick={a.disabled ? undefined : () => { triggerHaptic("Light"); a.onClick(); }}
                  className={`w-full flex items-center gap-3 px-4 h-14 text-left transition-colors ${
                    idx > 0 ? "border-t border-white/[0.06]" : ""
                  } ${
                    a.disabled ? "opacity-40" : "active:bg-white/[0.04]"
                  }`}
                >
                  {a.icon && <span className="flex-shrink-0">{a.icon}</span>}
                  <span className={`text-[15px] font-medium ${a.destructive ? "text-[#E63946]" : "text-white"}`}>
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#1A1D24] h-14 text-[15px] font-bold text-white active:bg-white/[0.04] transition-colors"
            >
              Annuler
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ── Icônes de la feuille (traits blancs, 20 px) ─────────────── */

export function IconeTelecharger() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}

export function IconeEtoile() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Le « ⋮ » du bouton rond de l'en-tête. */
export function IconeMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  );
}
