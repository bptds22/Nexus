"use client";

/* Le bouton « S'abonner à mon agenda » du Calendrier : ouvre AbonnementAgenda
   dans une modale (le même composant que Paramètres › Agenda). */

import { useEffect, useState } from "react";
import AbonnementAgenda from "./AbonnementAgenda";

export default function BoutonAbonnementAgenda() {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-2 rounded-xl border border-[#262A33] bg-[#1A1D24] px-[16px] py-[10px] text-[13.5px] font-semibold text-[#EDEFF3] transition-colors hover:border-[#6B7280]"
        data-testid="bouton-abonnement-agenda"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
        </svg>
        S&apos;abonner à mon agenda
      </button>
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOuvert(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titre-abonnement-agenda"
            className="w-full max-w-[560px] rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 id="titre-abonnement-agenda" className="font-head text-xl font-black uppercase tracking-tight text-white">S&apos;abonner à mon agenda</h2>
              <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="text-[#9CA3AF] hover:text-white">✕</button>
            </div>
            <AbonnementAgenda />
          </div>
        </div>
      )}
    </>
  );
}
