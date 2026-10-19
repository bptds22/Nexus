"use client";

/* Bandeau UNIQUE « visibilité partenaire » en haut de « Mes évaluations »
   (BP 2026-10-18, 6.2) : une seule fois, qu'on peut fermer — plus répété au bas
   de la liste ni sous chaque carte. Fermé = retenu dans ce navigateur. */

import { useState, useSyncExternalStore } from "react";
import { bandeauFerme, fermerBandeau, TEXTE_BANDEAU_VISIBILITE } from "@/lib/partenaires/vueMesAthletes";

export default function BandeauVisibilite({ className = "" }: { className?: string }) {
  // Lu après l'hydratation (rendu serveur : caché), puis fermé localement au clic.
  const fermeStocke = useSyncExternalStore(() => () => {}, bandeauFerme, () => true);
  const [fermeIci, setFermeIci] = useState(false);
  if (fermeStocke || fermeIci) return null;
  return (
    <div role="note" data-bandeau-visibilite
      className={`flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#1A1D24] px-4 py-3 ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
      </svg>
      <p className="flex-1 text-[13px] text-[#c8c8cc] leading-relaxed">{TEXTE_BANDEAU_VISIBILITE}</p>
      <button type="button" aria-label="Fermer" onClick={() => { fermerBandeau(); setFermeIci(true); }}
        className="-mr-1 -mt-1 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[#9CA3AF] hover:text-white active:bg-white/[0.08]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
