"use client";

/* ═══════════════════════════════════════════════════════════════
   EditeurEvaluationPartenaire — la saisie d'une évaluation PARTENAIRE (W2),
   sans l'enregistrement. Partagé par :
   - EvaluerAthleteModal (fiche d'un athlète inscrit) ;
   - le formulaire d'une carte prospect (W4b), où l'évaluation est facultative.

   Deux modes, comme chez le coach :
   - Simple   : la cote globale seule (1 à 5).
   - Détaillé : les critères de la grille (celle de la position, sinon
     GENERIQUE), tous facultatifs. Dès qu'un critère est noté, la cote est
     leur moyenne — le serveur la recalcule de toute façon (le détaillé gagne).
═══════════════════════════════════════════════════════════════ */

import StarRatingInput from "@/app/coach/components/StarRatingInput";
import { useGrilles } from "@/lib/evaluations/useGrilles";
import { traitGroups } from "@/lib/evaluations/grilles";
import { moyenneCriteres, type CritereColonne } from "@/lib/evaluations/partenaire";

export type ModeEvaluation = "simple" | "detaille";

export interface ValeurEvaluation {
  mode: ModeEvaluation;
  cote: number;
  criteres: Partial<Record<CritereColonne, number>>;
}

/** Ce qui sera enregistré : en détaillé avec au moins un critère, la moyenne. */
export function coteFinale(v: ValeurEvaluation): number {
  const moyenne = moyenneCriteres(v.criteres);
  return v.mode === "detaille" && moyenne !== null ? moyenne : v.cote;
}

/** Les paramètres de la RPC : cote en mode simple (ou sans critère), critères en détaillé. */
export function parametresEvaluation(v: ValeurEvaluation): { cote: number | null; criteres: Partial<Record<CritereColonne, number>> } {
  const moyenne = moyenneCriteres(v.criteres);
  return {
    cote: v.mode === "simple" || moyenne === null ? v.cote : null,
    criteres: v.mode === "detaille" ? v.criteres : {},
  };
}

export default function EditeurEvaluationPartenaire({
  grilleId,
  valeur,
  onChange,
}: {
  grilleId: string | null;
  valeur: ValeurEvaluation;
  onChange: (v: ValeurEvaluation) => void;
}) {
  const grilleSet = useGrilles();
  const moyenne = moyenneCriteres(valeur.criteres);
  const { mode, cote, criteres } = valeur;

  return (
    <div>
      <div className="inline-flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden mb-5">
        {(["simple", "detaille"] as const).map((m) => (
          <button key={m} type="button" onClick={() => onChange({ ...valeur, mode: m })}
            className={`px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider transition-colors ${mode === m ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
            {m === "simple" ? "Simple" : "Détaillé"}
          </button>
        ))}
      </div>

      {mode === "simple" ? (
        <div className="flex items-center justify-between gap-4 py-3 border-y border-[#2D3748]/50">
          <span className="text-[13px] font-bold text-white">Cote globale <span className="text-[#EF4444]">*</span></span>
          <StarRatingInput value={cote} onChange={(c) => onChange({ ...valeur, cote: c })} />
        </div>
      ) : (
        <div>
          {traitGroups(grilleSet, { grilleId }).map((groupe) => (
            <div key={groupe.title} className="mb-5">
              <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">{groupe.title}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {groupe.traits.map((t) => (
                  <StarRatingInput
                    key={t.column}
                    compact
                    label={t.label}
                    value={criteres[t.column as CritereColonne] ?? 0}
                    onChange={(v) => onChange({
                      ...valeur,
                      criteres: {
                        ...criteres,
                        // Recliquer la même étoile retire la note : critère facultatif.
                        [t.column]: criteres[t.column as CritereColonne] === v ? undefined : v,
                      },
                    })}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-3 border-t border-[#2D3748]/50">
            <span className="text-[13px] font-bold text-white">
              Cote globale <span className="text-[#EF4444]">*</span>
              <span className="block text-[11px] font-normal text-[#6b7280]">
                {moyenne !== null ? "Moyenne des critères notés" : "Aucun critère noté : choisis la cote"}
              </span>
            </span>
            {moyenne !== null ? (
              <span className="text-[18px] font-head font-black text-white">{moyenne.toFixed(1)}<span className="text-[13px] text-[#6B7280] font-normal">/5</span></span>
            ) : (
              <StarRatingInput value={cote} onChange={(c) => onChange({ ...valeur, cote: c })} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
