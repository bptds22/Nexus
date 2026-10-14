"use client";

/* ═══════════════════════════════════════════════════════════════
   EvaluerAthleteModal — saisie de l'évaluation PARTENAIRE (W2).

   Deux modes, comme chez le coach :
   - Simple   : la cote globale seule (obligatoire, 1 à 5).
   - Détaillé : les 14 critères de la grille de l'athlète (même
     résolveur que le coach : grille de la position, sinon GENERIQUE),
     tous facultatifs. Dès qu'un critère est noté, la cote est leur
     moyenne — le serveur la recalcule de toute façon (le détaillé gagne).

   La grille vient du SERVEUR (partenaire_evaluation_contexte) : c'est
   celle que l'écriture figera, pas une déduction du client.
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StarRatingInput from "@/app/coach/components/StarRatingInput";
import { useGrilles } from "@/lib/evaluations/useGrilles";
import { traitGroups } from "@/lib/evaluations/grilles";
import {
  enregistrerEvaluationPartenaire,
  moyenneCriteres,
  EVENEMENT_EVALUATION_PARTENAIRE,
  type CritereColonne,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";

export default function EvaluerAthleteModal({
  athleteId,
  athleteNom,
  grilleId,
  existante,
  onClose,
  onSaved,
}: {
  athleteId: string;
  athleteNom: string;
  grilleId: string | null;
  existante: EvaluationPartenaire | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const grilleSet = useGrilles();
  const [mode, setMode] = useState<"simple" | "detaille">(
    existante && Object.keys(existante.criteres).length > 0 ? "detaille" : "simple",
  );
  const [cote, setCote] = useState<number>(existante ? Math.round(existante.coteGlobale) : 0);
  const [criteres, setCriteres] = useState<Partial<Record<CritereColonne, number>>>(existante?.criteres ?? {});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const moyenne = useMemo(() => moyenneCriteres(criteres), [criteres]);
  // Ce qui sera enregistré : en détaillé avec au moins un critère, la moyenne.
  const coteFinale = mode === "detaille" && moyenne !== null ? moyenne : cote;
  const valide = coteFinale >= 1 && coteFinale <= 5;

  async function enregistrer() {
    if (!valide) { setErreur("La cote globale est obligatoire."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await enregistrerEvaluationPartenaire(
        createClient(),
        athleteId,
        mode === "simple" || moyenne === null ? cote : null,
        mode === "detaille" ? criteres : {},
      );
      window.dispatchEvent(new CustomEvent(EVENEMENT_EVALUATION_PARTENAIRE, { detail: { athleteId } }));
      onSaved();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      setErreur(err.code === "42501"
        ? "Évaluation refusée : ton organisation n'est pas autorisée à évaluer cet athlète."
        : err.message ?? "Erreur inconnue");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !envoi && onClose()} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-head text-lg font-black text-white uppercase tracking-tight">Évaluer {athleteNom}</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1 mb-5">
          Ton évaluation est signée par ton organisation et s&apos;affiche à part, sous celle de
          l&apos;entraîneur. Elle ne la remplace jamais.
        </p>

        <div className="inline-flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden mb-5">
          {(["simple", "detaille"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider transition-colors ${mode === m ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              {m === "simple" ? "Simple" : "Détaillé"}
            </button>
          ))}
        </div>

        {mode === "simple" ? (
          <div className="flex items-center justify-between gap-4 py-3 border-y border-[#2D3748]/50">
            <span className="text-[13px] font-bold text-white">Cote globale <span className="text-[#EF4444]">*</span></span>
            <StarRatingInput value={cote} onChange={setCote} />
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
                      onChange={(v) => setCriteres((prev) => ({
                        ...prev,
                        // Recliquer la même étoile retire la note : critère facultatif.
                        [t.column]: prev[t.column as CritereColonne] === v ? undefined : v,
                      }))}
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
                <StarRatingInput value={cote} onChange={setCote} />
              )}
            </div>
          </div>
        )}

        {erreur && <p className="text-[12px] text-[#EF4444] mt-3">{erreur}</p>}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
          <button type="button" onClick={onClose} disabled={envoi}
            className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void enregistrer()} disabled={envoi || !valide}
            className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50">
            {envoi ? "Enregistrement…" : "Enregistrer l'évaluation"}
          </button>
        </div>
      </div>
    </div>
  );
}
