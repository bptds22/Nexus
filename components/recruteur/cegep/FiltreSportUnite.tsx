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
      className={`bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] outline-none focus:border-[#E63946] transition-colors ${className}`}
    >
      {filtre.options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          Sport : {o.libelle} ({o.nb})
        </option>
      ))}
    </select>
  );
}
