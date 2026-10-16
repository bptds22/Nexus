/* « Nom à confirmer par l'athlète » (D1b, décision BP 2026-10-15) — listes du coach,
   web et appli. Sans prénom, sans nom, ou nom recopié de Google pas encore
   confirmé : la fiche RESTE dans l'effectif du coach, étiquetée ; elle sort
   seulement des recherches (recruteur, « à réclamer », « école »). */

import { nomPresentable, TEXTES_NOM } from "@/lib/athlete/nomAConfirmer";

export default function EtiquetteNomAConfirmer({ a }: { a: { firstName: string; lastName: string; nomAConfirmer?: boolean } }) {
  if (nomPresentable(a)) return null;
  return (
    <span data-nom-a-confirmer className="inline-flex items-center px-2 py-0.5 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] text-[11px] font-bold">
      {TEXTES_NOM.etiquetteCoach}
    </span>
  );
}
