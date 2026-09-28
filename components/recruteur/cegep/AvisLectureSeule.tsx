"use client";

/* ═══════════════════════════════════════════════════════════════
   AvisLectureSeule — l'admin cégep qui regarde un AUTRE sport que le sien
   (ou tout le cégep) lit sans écrire (registre §40, décision BP
   2026-09-28, lot B2 étape 3).

   Pourquoi : toute écriture du tableau blanc passe par la ligne de
   l'acteur, et cette ligne vit dans l'unité de l'acteur. Un admin Football
   qui « déplacerait » un dossier Basketball en créerait un second, en
   Football. Tant qu'une écriture inter-unités n'existe pas, les autres
   sports se consultent — et l'écran le dit, plutôt que de laisser croire
   qu'un geste va porter.

   Rendu seulement quand le choix du filtre n'est PAS le sport de l'admin.
═══════════════════════════════════════════════════════════════ */

import type { FiltreSportUnite } from "@/lib/queries/recruiter/useFiltreSportUnite";
import { TOUS } from "@/lib/cegep/filtreSportUnite";

export function estAutreSport(filtre: FiltreSportUnite): boolean {
  return filtre.pret && !!filtre.monSportId && filtre.choix !== filtre.monSportId;
}

export default function AvisLectureSeule({ filtre, className = "" }: { filtre: FiltreSportUnite; className?: string }) {
  if (!estAutreSport(filtre)) return null;
  const libelle = filtre.options.find((o) => o.valeur === filtre.choix)?.libelle ?? "ce sport";
  const monSport = filtre.options.find((o) => o.valeur === filtre.monSportId)?.libelle ?? "ton sport";
  const quoi = filtre.choix === TOUS ? "Tout le cégep" : libelle;
  return (
    <div role="note" className={`flex items-start gap-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] px-4 py-3 ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <p className="text-[13px] leading-relaxed text-[#E5E7EB]">
        <span className="font-bold text-[#F59E0B]">{quoi} : lecture seule.</span>{" "}
        Tu consultes les dossiers des autres unités de ton cégep ; tu ne modifies que ceux de ton unité ({monSport}).
      </p>
    </div>
  );
}
