"use client";

/* « Voulais-tu dire … ? » (D1, 2026-10-15) — inscription web et appli.

   Une adresse mal écrite (gmail.co, hotmial.com) laisse un compte qu'on ne
   peut pas récupérer — et le jeune se réinscrit. Montrée en quittant le champ
   ou au clic sur « Continuer », jamais pendant la frappe (« gmail.co » n'est
   qu'une étape vers « gmail.com »). Non bloquante : « Non, elle est bonne »
   laisse passer l'adresse telle quelle. */

import { useState } from "react";
import { suggestionCourriel } from "@/lib/auth/suggestionCourriel";

export function useSuggestionCourriel(courriel: string) {
  const [quitte, setQuitte] = useState(false);
  const [garde, setGarde] = useState<string | null>(null);
  const propose = suggestionCourriel(courriel);
  const enAttente = !!propose && garde !== courriel;
  return {
    propose,
    /** Une suggestion attend une réponse : « Continuer » doit d'abord la montrer. */
    enAttente,
    /** La boîte est à l'écran. */
    visible: quitte && enAttente,
    montrer: () => setQuitte(true),
    garder: () => setGarde(courriel),
  };
}

export function SuggestionCourriel({
  propose,
  onCorriger,
  onGarder,
  className = "mt-2",
}: {
  propose: string;
  onCorriger: () => void;
  onGarder: () => void;
  className?: string;
}) {
  return (
    <div data-suggestion-courriel className={`${className} rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3`}>
      <p className="text-[13px] text-white">
        Voulais-tu dire <span className="font-semibold break-all">{propose}</span> ?
      </p>
      <p className="mt-1 text-[12px] text-[#9CA3AF]">
        Avec une adresse mal écrite, tu ne pourrais pas récupérer ton compte.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onCorriger}
          className="min-h-[36px] h-9 px-3 rounded-lg bg-[#E63946] text-white text-[12px] font-semibold hover:bg-[#D42B22]">
          Oui, corriger
        </button>
        <button type="button" onClick={onGarder}
          className="min-h-[36px] h-9 px-3 rounded-lg border border-white/15 text-[#D1D5DB] text-[12px] font-semibold hover:border-white/30">
          Non, elle est bonne
        </button>
      </div>
    </div>
  );
}
