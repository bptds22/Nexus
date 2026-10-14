"use client";

/* ═══════════════════════════════════════════════════════════════
   EvaluationPartenaireSection — « Évaluation de <organisation> » (W2).

   Rendue SOUS le rapport de l'entraîneur, sur les fiches recruteur,
   partenaire, coach et le profil de l'athlète. Décisions BP :
   - l'évaluation du coach reste la principale ; celle-ci est à part ;
   - titre = nom de l'ORGANISATION, jamais d'une personne ;
   - JAMAIS de check bleu (#3B82F6) ici — ce bleu dit « vérifié par le
     coach », et cette note ne vient pas d'un coach ;
   - elle reste visible après l'évaluation du coach.

   Rien à afficher (aucune évaluation, ou lecture refusée) → rien du tout :
   pas de titre vide, pas de « 0,0/5 ».
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StarRating from "@/components/ui/StarRating";
import { useGrilles } from "@/lib/evaluations/useGrilles";
import { traitGroups } from "@/lib/evaluations/grilles";
import {
  chargerEvaluationsPartenaires,
  EVENEMENT_EVALUATION_PARTENAIRE,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";
import { sectionLabel, cardBase, FreeLock } from "@/components/shared/athlete/sectionsFiche";

export default function EvaluationPartenaireSection({
  athleteId,
  verrouille = false,
}: {
  athleteId: string | null | undefined;
  /** Recruteur gratuit : même verrou que le rapport de l'entraîneur. */
  verrouille?: boolean;
}) {
  const grilleSet = useGrilles();
  const [evals, setEvals] = useState<EvaluationPartenaire[]>([]);

  useEffect(() => {
    if (!athleteId) return;
    let vivant = true;
    const charger = () => {
      chargerEvaluationsPartenaires(createClient(), athleteId)
        .then((r) => { if (vivant) setEvals(r); })
        .catch((e) => console.warn("[evaluation-partenaire] lecture :", e?.message ?? e));
    };
    charger();
    const surEnregistrement = (e: Event) => {
      if ((e as CustomEvent<{ athleteId?: string }>).detail?.athleteId === athleteId) charger();
    };
    window.addEventListener(EVENEMENT_EVALUATION_PARTENAIRE, surEnregistrement);
    return () => { vivant = false; window.removeEventListener(EVENEMENT_EVALUATION_PARTENAIRE, surEnregistrement); };
  }, [athleteId]);

  if (evals.length === 0) return null;

  return (
    <>
      {evals.map((ev) => (
        <section key={ev.id} data-evaluation-partenaire>
          <h2 className={sectionLabel}>Évaluation de {ev.organisation}</h2>
          {verrouille ? (
            <FreeLock />
          ) : (
            <div className={`${cardBase} p-6 sm:p-8`}>
              <div className="flex items-center gap-3 flex-wrap">
                <StarRating rating={ev.coteGlobale} size="md" showNumber={false} />
                <span className="text-[18px] font-head font-black text-white">
                  {ev.coteGlobale.toFixed(1)}<span className="text-[14px] text-[#6B7280] font-normal">/5</span>
                </span>
                <span className="text-[12px] text-[#6B7280] uppercase tracking-wider font-bold">Cote globale</span>
              </div>
              <p className="text-[12px] text-[#6B7280] mt-2">
                Évaluation d&apos;un partenaire de Nexus, distincte de celle de l&apos;entraîneur
                {" · "}
                {new Date(ev.updatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
              </p>

              {Object.keys(ev.criteres).length > 0 && (
                <div className="border-t border-[#2D3748]/50 pt-4 mt-4">
                  {traitGroups(grilleSet, { grilleId: ev.grilleId }).map((groupe) => {
                    const notes = groupe.traits.filter((t) => (ev.criteres[t.column as keyof typeof ev.criteres] ?? 0) > 0);
                    if (notes.length === 0) return null;
                    return (
                      <div key={groupe.title} className="mb-5 last:mb-0">
                        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-3">{groupe.title}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {notes.map((t) => (
                            <div key={t.column} className="flex items-center justify-between py-2.5 border-b border-[#2D3748]/30">
                              <span className="text-[13px] text-[#c8c8cc]">{t.label}</span>
                              <StarRating rating={ev.criteres[t.column as keyof typeof ev.criteres] ?? 0} size="sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
