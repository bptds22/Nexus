"use client";

/* Menu « Sport » de Mon CÉGEP (lot A). Rendu seulement s'il offre un vrai
   choix ; le filtre s'applique quand même (sur le sport de l'admin). */

import type { FiltreSportUnite as Filtre } from "@/lib/queries/recruiter/useFiltreSportUnite";

export default function FiltreSportUnite({ filtre, className = "" }: { filtre: Filtre; className?: string }) {
  if (!filtre.pret || !filtre.visible) return null;
  return (
    <select
      value={filtre.choix}
      onChange={(e) => filtre.setChoix(e.target.value)}
      aria-label="Sport de l'unité"
      title="Filtre les recruteurs de ton cégep par le sport qu'ils recrutent"
      // Rouge (retour BP 2026-09-24) : le menu doit se voir en haut de page.
      className={`bg-[#E63946]/10 border border-[#E63946] rounded-lg px-3 py-2 text-[13px] font-bold text-[#E63946] outline-none focus:ring-2 focus:ring-[#E63946]/40 transition-colors cursor-pointer [&>option]:bg-[#13151a] [&>option]:text-[#e0e0e0] [&>option]:font-normal ${className}`}
    >
      {filtre.options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          Sport : {o.libelle} ({o.nb})
        </option>
      ))}
    </select>
  );
}
