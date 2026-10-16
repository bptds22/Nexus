"use client";

/* ═══════════════════════════════════════════════════════════════
   ErreurChargement — une lecture a échoué : on le DIT, avec « Réessayer »
   (correctif 2026-10-16, décision BP : plus aucune erreur de chargement
   en silence). Web et mobile.
═══════════════════════════════════════════════════════════════ */

interface Props {
  message: string;
  onReessayer: () => void;
  className?: string;
}

export default function ErreurChargement({ message, onReessayer, className = "" }: Props) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/[0.07] px-4 py-3 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <p className="min-w-0 flex-1 text-[13px] text-[#E5E7EB]">{message}</p>
      <button
        type="button"
        onClick={onReessayer}
        className="shrink-0 rounded-lg bg-[#E63946] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#D42B22] active:bg-[#D42B22]"
      >
        Réessayer
      </button>
    </div>
  );
}

/** Les deux messages du processus — un seul endroit, web et mobile. */
export const MESSAGES_PROCESSUS = {
  cartes: (dejaAffiche: boolean) => dejaAffiche
    ? "Ton processus n'a pas pu être mis à jour. Vérifie ta connexion, puis réessaie."
    : "Ton processus n'a pas pu être chargé. Vérifie ta connexion, puis réessaie.",
  notes: "Les dernières notes n'ont pas pu être chargées. Vérifie ta connexion, puis réessaie.",
} as const;
