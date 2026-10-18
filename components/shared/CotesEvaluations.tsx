"use client";

/* Les deux évaluations d'un joueur, côte à côte : celle du coach ET celle du
   partenaire (« Évaluation L'Esprit Sportif »), chacune avec son libellé.
   Partout où une fiche ou une carte disait « Pas encore évalué » alors que le
   partenaire avait évalué, c'est ce composant qui parle (demande BP 1.4.5).

   « Pas encore évalué » n'apparaît que si NI le coach NI le partenaire n'ont
   évalué. Le partenaire n'est jamais présenté comme un coach : son libellé est
   toujours collé à ses étoiles. */

import StarRating from "@/components/ui/StarRating";
import { deuxCotes, libelleCotePartenaire, type DeuxCotes } from "@/lib/evaluations/coteCarte";
import { useCotesPartenairesDe } from "@/lib/evaluations/CotesPartenairesContext";
import { useDeclarerCarteVisible } from "@/components/shared/PartenaireCartesProvider";

export default function CotesEvaluations({
  cotes,
  taille = "md",
  vide = "Pas encore évalué",
  libelleCoach = "Coach",
  className = "",
}: {
  cotes: DeuxCotes;
  taille?: "sm" | "md";
  /** Texte quand personne n'a évalué ; null = ne rien afficher. */
  vide?: string | null;
  libelleCoach?: string;
  className?: string;
}) {
  const { coach, partenaire } = cotes;
  if (coach <= 0 && !partenaire) {
    return vide ? <span className={`text-[12px] text-[#6b7280] ${className}`}>{vide}</span> : null;
  }
  return (
    <div className={`flex flex-wrap items-start gap-x-4 gap-y-1.5 min-w-0 ${className}`} data-testid="cotes-evaluations">
      {coach > 0 && (
        <div className="flex flex-col gap-0.5 min-w-0">
          <StarRating rating={coach} size={taille} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] truncate">{libelleCoach}</span>
        </div>
      )}
      {partenaire && (
        <div className="flex flex-col gap-0.5 min-w-0" data-cote-partenaire>
          <StarRating rating={partenaire.valeur} size={taille} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] truncate max-w-[170px]" title={`${libelleCotePartenaire(partenaire.organisation)} — pas une note d'entraîneur`}>
            {libelleCotePartenaire(partenaire.organisation)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Pour une rangée qui a seulement l'identifiant et la cote du coach : le partenaire vient du
 *  lot lu par la page (PartenaireCartesProvider) — aucune requête ici. */
export function CotesEvaluationsAthlete({
  athleteId,
  coteCoach,
  ...reste
}: { athleteId: string | null | undefined; coteCoach: number | null | undefined } & Omit<React.ComponentProps<typeof CotesEvaluations>, "cotes">) {
  const evals = useCotesPartenairesDe(athleteId);
  const ref = useDeclarerCarteVisible(athleteId);
  return <div ref={ref} className="min-w-0"><CotesEvaluations cotes={deuxCotes(coteCoach, evals)} {...reste} /></div>;
}
