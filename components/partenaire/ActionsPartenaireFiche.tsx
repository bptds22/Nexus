"use client";

/* ═══════════════════════════════════════════════════════════════
   Actions du PARTENAIRE sur la fiche d'un athlète (lots W3 et « C »).

   - « Retirer mon évaluation » : seulement s'il en a une. Confirmation en
     deux temps (pas de boîte native : elle bloquerait la WebView). Le
     serveur supprime la ligne et en garde une trace non publique ; elle
     sort des fiches ET du filtre « 4+ étoiles ». Proposé même si la
     permission d'évaluer a été retirée : retirer sa propre note réduit
     l'exposition, ça ne l'étend jamais.
   - « Attribuer un badge » : seulement si le serveur dit que le partenaire
     peut évaluer cet athlète (même garde que W2) ET qu'il a un catalogue.
     Les badges déjà posés (vivants) ne sont pas reproposés.
   - « Attribuer un badge Nexus » (W3b) : les badges du catalogue que le
     serveur juge admissibles pour CET athlète (universels, et ceux de SON
     sport ; jamais les honneurs). Un badge déjà porté reste listé, grisé,
     avec qui le porte — le serveur refuse de toute façon le doublon.
   Le retrait d'un badge se fait depuis la rangée « Distinctions » de la
   fiche (BadgePartenaireVignette, actions="partenaire").
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  retirerEvaluationPartenaire,
  EVENEMENT_EVALUATION_PARTENAIRE,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";
import {
  attribuerBadgePartenaire,
  attribuerBadgeNexus,
  chargerBadgesNexusAdmissibles,
  chargerMesBadgesPartenaire,
  signalerBadgesPartenaire,
  EVENEMENT_BADGE_PARTENAIRE,
  type BadgeCatalogue,
  type BadgeNexusAdmissible,
} from "@/lib/badges/partenaire";
import { badgeSvgPath } from "@/lib/config/badges";
import { useBadgesPartenaires } from "@/components/shared/athlete/BadgesPartenaire";

function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

export default function ActionsPartenaireFiche({
  athleteId,
  peutEvaluer,
  maEvaluation,
  onEvaluationRetiree,
  notifier,
}: {
  athleteId: string;
  peutEvaluer: boolean;
  maEvaluation: EvaluationPartenaire | null;
  onEvaluationRetiree: () => void;
  notifier: (kind: "success" | "error", message: string) => void;
}) {
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [catalogue, setCatalogue] = useState<BadgeCatalogue[]>([]);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [nexus, setNexus] = useState<BadgeNexusAdmissible[]>([]);
  const [choixNexusOuvert, setChoixNexusOuvert] = useState(false);
  const poses = useBadgesPartenaires(athleteId);

  useEffect(() => {
    if (!peutEvaluer) return;
    let vivant = true;
    const charger = () => {
      chargerBadgesNexusAdmissibles(createClient(), athleteId)
        .then((r) => { if (vivant) setNexus(r); })
        .catch((e) => console.warn("[partenaire] badges Nexus admissibles :", e?.message ?? e));
    };
    charger();
    // Une pose ou un retrait change « déjà porté » : on relit.
    const surChangement = (e: Event) => {
      if ((e as CustomEvent<{ athleteId?: string }>).detail?.athleteId === athleteId) charger();
    };
    window.addEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement);
    return () => { vivant = false; window.removeEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement); };
  }, [peutEvaluer, athleteId]);
  const nexusLibres = nexus.filter((b) => !b.dejaPar);

  useEffect(() => {
    if (!peutEvaluer) return;
    chargerMesBadgesPartenaire(createClient())
      .then(setCatalogue)
      .catch((e) => console.warn("[partenaire] catalogue de badges :", e?.message ?? e));
  }, [peutEvaluer]);

  const dejaPoses = new Set(poses.filter((b) => b.estLeMien).map((b) => b.badgeId));
  const disponibles = catalogue.filter((b) => !dejaPoses.has(b.id));

  const retirerEvaluation = async () => {
    if (!maEvaluation) return;
    setOccupe(true);
    try {
      await retirerEvaluationPartenaire(createClient(), maEvaluation.id);
      window.dispatchEvent(new CustomEvent(EVENEMENT_EVALUATION_PARTENAIRE, { detail: { athleteId } }));
      onEvaluationRetiree();
      notifier("success", "Évaluation retirée.");
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
      setConfirmerRetrait(false);
    }
  };

  const attribuer = async (badge: BadgeCatalogue) => {
    setOccupe(true);
    try {
      await attribuerBadgePartenaire(createClient(), athleteId, badge.id);
      signalerBadgesPartenaire(athleteId);
      setChoixOuvert(false);
      notifier("success", `Badge « ${badge.libelle} » attribué.`);
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  const attribuerNexus = async (badge: BadgeNexusAdmissible) => {
    setOccupe(true);
    try {
      await attribuerBadgeNexus(createClient(), athleteId, badge.id);
      signalerBadgesPartenaire(athleteId);
      setChoixNexusOuvert(false);
      notifier("success", `Badge « ${badge.libelle} » attribué.`);
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };

  if (!maEvaluation && !(peutEvaluer && (catalogue.length > 0 || nexus.length > 0))) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap" data-actions-partenaire>
      {maEvaluation && !confirmerRetrait && (
        <button
          type="button"
          disabled={occupe}
          onClick={() => setConfirmerRetrait(true)}
          className="px-4 py-2 border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56] text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          Retirer mon évaluation
        </button>
      )}
      {maEvaluation && confirmerRetrait && (
        <div className="flex items-center gap-2 flex-wrap bg-[#1A1D24] border border-[#E63946]/40 rounded-lg px-3 py-2">
          <span className="text-[13px] text-[#c8c8cc]">Retirer ton évaluation de cet athlète ? Elle disparaîtra de sa fiche.</span>
          <button
            type="button"
            disabled={occupe}
            onClick={retirerEvaluation}
            className="px-3 py-1.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-md disabled:opacity-50"
          >
            {occupe ? "Retrait…" : "Confirmer le retrait"}
          </button>
          <button
            type="button"
            disabled={occupe}
            onClick={() => setConfirmerRetrait(false)}
            className="px-3 py-1.5 text-[12px] font-semibold text-[#9CA3AF] hover:text-white"
          >
            Annuler
          </button>
        </div>
      )}

      {peutEvaluer && catalogue.length > 0 && (
        <div className="relative">
          <button
            type="button"
            disabled={occupe || disponibles.length === 0}
            onClick={() => setChoixOuvert((v) => !v)}
            className="px-4 py-2 border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={disponibles.length === 0 ? "Tous tes badges sont déjà attribués à cet athlète" : undefined}
          >
            Attribuer un badge
          </button>
          {choixOuvert && disponibles.length > 0 && (
            <div className="absolute z-20 mt-2 right-0 w-[280px] bg-[#1A1D24] border border-[#2D3748] rounded-xl p-2 shadow-xl">
              {disponibles.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={occupe}
                  onClick={() => attribuer(b)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-50"
                >
                  {b.iconeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.iconeUrl} alt="" className="w-9 h-9 object-contain shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded-full border border-[#2D3748] flex items-center justify-center text-[13px] font-bold text-[#9CA3AF] shrink-0">
                      {b.libelle.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold text-white">{b.libelle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {peutEvaluer && nexus.length > 0 && (
        <div className="relative">
          <button
            type="button"
            disabled={occupe || nexusLibres.length === 0}
            onClick={() => setChoixNexusOuvert((v) => !v)}
            className="px-4 py-2 border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={nexusLibres.length === 0 ? "Cet athlète porte déjà tous les badges Nexus que tu peux attribuer" : undefined}
            data-attribuer-badge-nexus
          >
            Attribuer un badge Nexus
          </button>
          {choixNexusOuvert && (
            <div className="absolute z-20 mt-2 right-0 w-[300px] max-h-[360px] overflow-y-auto bg-[#1A1D24] border border-[#2D3748] rounded-xl p-2 shadow-xl">
              {nexus.map((b) => {
                const svg = badgeSvgPath(b.code);
                return (
                  <button
                    key={b.id}
                    type="button"
                    disabled={occupe || !!b.dejaPar}
                    onClick={() => attribuerNexus(b)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-45 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  >
                    {svg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svg} alt="" className="w-9 h-9 object-contain shrink-0" />
                    ) : (
                      <span className="w-9 h-9 shrink-0" />
                    )}
                    <span className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-white">{b.libelle}</span>
                      <span className="text-[11px] text-[#6B7280]">
                        {b.dejaPar ? `Déjà porté — ${b.dejaPar}` : b.famille === "sport" ? "Badge de sport" : "Badge universel"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
