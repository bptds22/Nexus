/* ─────────────────────────────────────────────────────────────────
   LOT 3 — pastille « Te cible · depuis le … »

   Posée sur la fiche athlète, côté recruteur. Elle était aussi sur les
   cartes de recherche (grille + liste) jusqu'au lot 5 : le filtre « Te
   ciblent » l'y remplace (décision BP 2026-09-23). UN composant, pas des copies —
   même raison que `lib/cibles/divulgation.ts` : trois pastilles
   recopiées dérivent, et la quatrième surface naît sans pastille.

   POURQUOI VERT ET PAS ROUGE.
   Le rouge #E63946 est déjà, sur la MÊME carte, la couleur des badges de
   distinction (`bg-[#E63946]/15 border-[#E63946]/30`) et du cœur favori.
   Une quatrième pastille rouge à côté ne se distinguerait plus de rien.
   Le bleu #3B82F6 est exclu par le design system : c'est le signal
   « vérifié », et le poser sur une carte d'athlète le ferait lire comme
   une validation. Le violet est réservé au grade privé (`GradeChip`).
   Reste le vert #22C55E, « statut positif / entrant » — exactement la
   convention que l'ActionBar du tableau de bord applique déjà aux
   réponses de coachs, qui sont le même genre de signal.

   CE QU'ELLE N'AFFIRME PAS. « Te cible » dit que l'athlète a mis CE
   CÉGEP dans son parcours. Pas qu'il attend un appel, pas qu'il est
   disponible, pas qu'il a été contacté. Le libellé reste au présent et
   sans promesse — c'est le pendant exact de ce que l'athlète a lu avant
   de cliquer (`CIBLE_DIVULGATION_AVANT`).
───────────────────────────────────────────────────────────────── */

import * as React from "react";

/** « depuis le 14 sept. » — format court : la pastille vit dans une carte. */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

export default function PastilleTeCible({
  targetedAt,
  taille = "normale",
}: {
  /** `athlete_targets.created_at`, ou null/undefined si l'athlète ne cible pas
   *  ce cégep — la pastille ne rend alors RIEN. Une pastille absente est le
   *  bon défaut : on n'affirme « te cible » que sur une donnée reçue. */
  targetedAt: string | null | undefined;
  /** `compacte` pour les cartes denses (vue liste), `normale` ailleurs. */
  taille?: "normale" | "compacte";
}) {
  if (!targetedAt) return null;

  const quand = dateCourte(targetedAt);
  const compacte = taille === "compacte";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/15 font-bold text-[#22C55E] whitespace-nowrap ${
        compacte ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12px]"
      }`}
      title={quand ? `Cet athlète a ajouté ton cégep à ses cibles le ${quand}` : undefined}
    >
      <svg
        width={compacte ? 10 : 11}
        height={compacte ? 10 : 11}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
      </svg>
      Te cible
      {quand && (
        <span className="font-semibold text-[#22C55E]/70">· depuis le {quand}</span>
      )}
    </span>
  );
}
