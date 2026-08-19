"use client";

import { useState, type ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════
   AdvancedFilterDrawer — le bouton « Filtres avancés » et son
   panneau repliable, extraits pour les trois barres partenaire
   (/classements, /tendances, /newsroom).

   Reproduit à l'identique le patron de
   components/partenaire/PartnerAthletesSearch.tsx : mêmes
   couleurs, même icône, même chevron qui pivote. L'objectif est
   que les quatre écrans partenaire soient indiscernables — donc
   ce composant NE DOIT PAS diverger du modèle, ni « améliorer »
   son apparence de son côté.

   L'état d'ouverture est LOCAL, pas dans l'URL : il ne décrit
   pas une sélection de données, seulement une préférence
   d'affichage. Le mettre dans l'URL polluerait les liens
   partagés, qui sont la raison d'être des filtres URL.

   NOTE CONNUE — le bouton ne porte pas de compteur de filtres
   actifs, donc un filtre posé puis le tiroir refermé devient
   invisible. C'est le comportement du modèle /athletes, repris
   TEL QUEL par choix de parité. Le jour où on ajoute un
   compteur, il faut l'ajouter aux QUATRE écrans en même temps,
   ici et dans PartnerAthletesSearch.
═══════════════════════════════════════════════════════════════ */

export default function AdvancedFilterDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors shrink-0 ${
          open
            ? "bg-[#E63946]/10 text-[#E63946] border border-[#E63946]/30"
            : "text-[#9CA3AF] hover:text-white border border-[#2D3748]"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
        </svg>
        Filtres avancés
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* `basis-full` : le panneau prend toute la largeur et force un retour à
          la ligne dans le conteneur `flex-wrap` de la barre, au lieu de se
          tasser à côté du bouton. */}
      {open && (
        <div className="basis-full w-full bg-[#13151a] border border-[#2a2d36] rounded-lg p-4 mt-1">
          <div className="flex flex-wrap items-center gap-2.5">{children}</div>
        </div>
      )}
    </>
  );
}
