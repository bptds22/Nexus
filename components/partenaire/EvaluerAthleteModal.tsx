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

   BP 2026-10-19 : SES BADGES au même endroit — ses badges et les badges Nexus
   admissibles, cochés s'il les a déjà posés. Enregistrer pose les nouveaux et
   retire les décochés. Sans évaluation existante, on peut n'enregistrer que
   des badges (la cote reste alors vide).

   BP 2026-10-19 : « Retirer mon évaluation » vit ici (la fiche n'a plus que deux
   boutons). Confirmation en deux temps, pas de boîte native (elle bloquerait la
   WebView). Le serveur supprime la ligne et en garde une trace non publique.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { badgeSvgPath } from "@/lib/config/badges";
import {
  attribuerBadgeNexus, attribuerBadgePartenaire, chargerBadgesNexusAdmissibles, chargerMesBadgesPartenaire,
  retirerBadgePartenaire, signalerBadgesPartenaire, type BadgeCatalogue, type BadgeNexusAdmissible,
} from "@/lib/badges/partenaire";
import { useBadgesPartenaires } from "@/components/shared/athlete/BadgesPartenaire";
import { createClient } from "@/lib/supabase/client";
import EditeurEvaluationPartenaire, {
  coteFinale,
  parametresEvaluation,
  type ValeurEvaluation,
} from "@/components/partenaire/EditeurEvaluationPartenaire";
import {
  enregistrerEvaluationPartenaire,
  retirerEvaluationPartenaire,
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
  onRetiree,
}: {
  athleteId: string;
  athleteNom: string;
  grilleId: string | null;
  existante: EvaluationPartenaire | null;
  onClose: () => void;
  onSaved: () => void;
  onRetiree?: () => void;
}) {
  const [valeur, setValeur] = useState<ValeurEvaluation>({
    mode: existante && Object.keys(existante.criteres).length > 0 ? "detaille" : "simple",
    cote: existante ? Math.round(existante.coteGlobale) : 0,
    criteres: existante?.criteres ?? {},
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  // Ses badges : le catalogue, les Nexus admissibles, et ceux qu'il a déjà posés (clé « p:id » / « n:id »).
  const [catalogue, setCatalogue] = useState<BadgeCatalogue[]>([]);
  const [nexus, setNexus] = useState<BadgeNexusAdmissible[]>([]);
  const poses = useBadgesPartenaires(athleteId);
  const mesPoses = useMemo(() => new Map(poses.filter((b) => b.estLeMien).map((b) => [`${b.estNexus ? "n" : "p"}:${b.badgeId}`, b.id])), [poses]);
  const [choix, setChoix] = useState<Set<string> | null>(null);
  const coches = choix ?? new Set(mesPoses.keys());
  useEffect(() => {
    const supabase = createClient();
    void chargerMesBadgesPartenaire(supabase).then(setCatalogue).catch(() => setCatalogue([]));
    void chargerBadgesNexusAdmissibles(supabase, athleteId).then(setNexus).catch(() => setNexus([]));
  }, [athleteId]);
  const basculer = (cle: string) => setChoix(() => {
    const s = new Set(coches);
    if (s.has(cle)) s.delete(cle); else s.add(cle);
    return s;
  });
  const ajouts = [...coches].filter((k) => !mesPoses.has(k));
  const retraits = [...mesPoses.keys()].filter((k) => !coches.has(k));
  const badgesChanges = ajouts.length + retraits.length > 0;

  const coteOk = coteFinale(valeur) >= 1 && coteFinale(valeur) <= 5;
  // Une évaluation existante garde sa cote ; sans elle, des badges seuls suffisent.
  const valide = coteOk || (!existante && badgesChanges);

  async function enregistrer() {
    if (!valide) { setErreur("La cote globale est obligatoire."); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      const supabase = createClient();
      if (coteOk) {
        const { cote, criteres } = parametresEvaluation(valeur);
        await enregistrerEvaluationPartenaire(supabase, athleteId, cote, criteres);
        window.dispatchEvent(new CustomEvent(EVENEMENT_EVALUATION_PARTENAIRE, { detail: { athleteId } }));
      }
      for (const k of ajouts) {
        const [genre, id] = [k.slice(0, 1), k.slice(2)];
        if (genre === "n") await attribuerBadgeNexus(supabase, athleteId, id);
        else await attribuerBadgePartenaire(supabase, athleteId, id);
      }
      for (const k of retraits) {
        const pose = mesPoses.get(k);
        if (pose) await retirerBadgePartenaire(supabase, pose);
      }
      if (badgesChanges) signalerBadgesPartenaire(athleteId);
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

  async function retirer() {
    if (!existante) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await retirerEvaluationPartenaire(createClient(), existante.id);
      window.dispatchEvent(new CustomEvent(EVENEMENT_EVALUATION_PARTENAIRE, { detail: { athleteId } }));
      onRetiree?.();
    } catch (e) {
      setErreur((e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Retrait impossible.");
      setConfirmerRetrait(false);
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

        {(catalogue.length > 0 || nexus.length > 0) && (
          <div className="mt-5 pt-4 border-t border-[#2D3748]/40" data-badges-evaluation>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-2">Mes badges</p>
            <div className="flex flex-wrap gap-2">
              {catalogue.map((b) => {
                const cle = `p:${b.id}`;
                const actif = coches.has(cle);
                return (
                  <button key={cle} type="button" aria-pressed={actif} onClick={() => basculer(cle)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${actif ? "border-[#F59E0B] bg-[#F59E0B]/15 text-[#FCD34D]" : "border-[#2D3748] text-[#9CA3AF] hover:text-white"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {b.iconeUrl && <img src={b.iconeUrl} alt="" className="w-5 h-5 object-contain" />}
                    {b.libelle}
                  </button>
                );
              })}
              {nexus.map((b) => {
                const cle = `n:${b.id}`;
                const actif = coches.has(cle);
                const ailleurs = !!b.dejaPar && !mesPoses.has(cle);
                const svg = badgeSvgPath(b.code);
                return (
                  <button key={cle} type="button" aria-pressed={actif} disabled={ailleurs} onClick={() => basculer(cle)}
                    title={ailleurs ? `Déjà porté — ${b.dejaPar}` : undefined}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40 ${actif ? "border-[#F59E0B] bg-[#F59E0B]/15 text-[#FCD34D]" : "border-[#2D3748] text-[#9CA3AF] hover:text-white"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {svg && <img src={svg} alt="" className="w-5 h-5 object-contain" />}
                    {b.libelle}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {erreur && <p className="text-[12px] text-[#EF4444] mt-3">{erreur}</p>}

        {existante && onRetiree && confirmerRetrait && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E63946]/40 px-3 py-2" data-confirmer-retrait-evaluation>
            <span className="text-[13px] text-[#c8c8cc]">Retirer ton évaluation de cet athlète ? Elle disparaîtra de sa fiche.</span>
            <button type="button" disabled={envoi} onClick={() => void retirer()}
              className="px-3 py-1.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-md disabled:opacity-50">
              {envoi ? "Retrait…" : "Confirmer le retrait"}
            </button>
            <button type="button" disabled={envoi} onClick={() => setConfirmerRetrait(false)}
              className="px-3 py-1.5 text-[12px] font-semibold text-[#9CA3AF] hover:text-white">
              Annuler
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
          {existante && onRetiree && !confirmerRetrait && (
            <button type="button" onClick={() => setConfirmerRetrait(true)} disabled={envoi}
              className="mr-auto px-3 py-2 text-[13px] font-bold text-[#E63946] hover:underline disabled:opacity-50" data-retirer-evaluation>
              Retirer mon évaluation
            </button>
          )}
          <button type="button" onClick={onClose} disabled={envoi}
            className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void enregistrer()} disabled={envoi || !valide}
            className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50">
            {envoi ? "Enregistrement…" : coteOk || existante ? "Enregistrer l'évaluation" : "Enregistrer les badges"}
          </button>
        </div>
      </div>
    </div>
  );
}
