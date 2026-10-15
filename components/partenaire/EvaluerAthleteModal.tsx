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

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import EditeurEvaluationPartenaire, {
  coteFinale,
  parametresEvaluation,
  type ValeurEvaluation,
} from "@/components/partenaire/EditeurEvaluationPartenaire";
import {
  enregistrerEvaluationPartenaire,
  EVENEMENT_EVALUATION_PARTENAIRE,
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
  const [valeur, setValeur] = useState<ValeurEvaluation>({
    mode: existante && Object.keys(existante.criteres).length > 0 ? "detaille" : "simple",
    cote: existante ? Math.round(existante.coteGlobale) : 0,
    criteres: existante?.criteres ?? {},
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const valide = coteFinale(valeur) >= 1 && coteFinale(valeur) <= 5;

  async function enregistrer() {
    if (!valide) { setErreur("La cote globale est obligatoire."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const { cote, criteres } = parametresEvaluation(valeur);
      await enregistrerEvaluationPartenaire(createClient(), athleteId, cote, criteres);
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

        <EditeurEvaluationPartenaire grilleId={grilleId} valeur={valeur} onChange={setValeur} />

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
