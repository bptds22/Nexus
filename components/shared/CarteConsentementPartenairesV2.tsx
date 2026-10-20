"use client";

/* ═══════════════════════════════════════════════════════════════
   CarteConsentementPartenairesV2 — la demande v2 en plein écran
   (web et appli, BP 2026-10-19).

   Le texte v2 en entier (source unique lib/legal/partnerMediaCopy.ts),
   deux choix SANS défaut — « Oui, je partage » / « Non » — et « Plus tard ».
   Moins de 14 ans : « Oui » transmet la demande au parent (la base le fait).
   La carte ne décide pas quand elle revient : la base (`a_afficher`) tient
   le compte des « Plus tard » (3 au plus, 3 jours d'écart) et du « Non ».

   Rendue dans <body> par un portail : au-dessus de la barre d'onglets de
   l'appli (z-40) et de tout conteneur de défilement.
═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_MEDIA_COPY, partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";
import { repondreV2, TEXTES_V2, type EtatV2, type IssueV2, type ReponseV2 } from "@/lib/partenaires/consentementV2";

type Props = {
  etat: EtatV2;
  /** Appelé quand la carte se ferme : l'issue, ou null si fermée sans réponse enregistrée. */
  onFermer: (issue: IssueV2 | null) => void;
  /** « Plus tard » : absent sur la page ouverte par le push (on y vient exprès). */
  avecPlusTard?: boolean;
};

export default function CarteConsentementPartenairesV2({ etat, onFermer, avecPlusTard = true }: Props) {
  const [envoi, setEnvoi] = useState<ReponseV2 | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<IssueV2 | null>(null);

  async function repondre(r: ReponseV2) {
    setEnvoi(r);
    setErreur(null);
    const res = await repondreV2(createClient(), r);
    setEnvoi(null);
    if ("erreur" in res) { setErreur(res.erreur); return; }
    if (res.issue === "PLUS_TARD") { onFermer("PLUS_TARD"); return; }
    setIssue(res.issue);
  }

  // Rendue seulement après une lecture côté client (état chargé dans un effet) : document existe.
  if (typeof document === "undefined") return null;

  const merci = issue === "ACCEPTEE" ? TEXTES_V2.merciOui
    : issue === "DEMANDE_PARENT" ? TEXTES_V2.merciParent
    : issue === "REFUSEE" ? TEXTES_V2.merciNon : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consentement-v2-titre"
      data-consentement-v2={issue ?? "question"}
      className="fixed inset-0 z-[200] bg-[#111317] flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-xl mx-auto px-5 sm:px-8 pt-8 pb-6">
          <div className="w-12 h-12 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center mb-5" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" />
            </svg>
          </div>
          <h1 id="consentement-v2-titre" className="font-head text-[24px] sm:text-[28px] font-black text-white uppercase tracking-tight leading-tight">
            {TEXTES_V2.titre}
          </h1>

          {merci ? (
            <p className="text-[15px] text-white leading-relaxed mt-4" data-consentement-v2-merci>{merci}</p>
          ) : (
            <>
              <p className="text-[15px] text-white leading-relaxed mt-4">
                {etat.statut === "V1" ? TEXTES_V2.chapeauV1 : TEXTES_V2.chapeauAucun}
              </p>
              {!etat.peutSeul && (
                <p className="text-[13px] text-[#F59E0B] leading-relaxed mt-3">{TEXTES_V2.moinsDe14}</p>
              )}

              <div className="mt-6 space-y-3 text-[13px] text-[#9CA3AF] leading-relaxed">
                <p>{PARTNER_MEDIA_COPY.intro}</p>
                <p>
                  <span className="font-bold text-white">Ce qui apparaît sur la carte :</span>{" "}
                  {PARTNER_MEDIA_COPY.whatAppears}
                </p>
                <p>
                  <span className="font-bold text-white">Ce que les partenaires voient aussi :</span>{" "}
                  {PARTNER_MEDIA_COPY.videosEtReseaux}
                </p>
                <p className="font-bold text-white pt-1">Ce que cela signifie concrètement :</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  {PARTNER_MEDIA_COPY.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <p className="text-[12px] pt-3 border-t border-[#2D3748]">{partnerResponsibilityText("self")}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-white/[0.06] bg-[#111317]">
        <div className="max-w-xl mx-auto px-5 sm:px-8 pt-4 pb-5">
          {erreur && <p className="text-[13px] text-[#FF6B76] mb-3" role="alert">{erreur}</p>}
          {merci ? (
            <button type="button" onClick={() => onFermer(issue)} data-consentement-v2-fermer
              className="w-full min-h-[50px] rounded-xl bg-[#E63946] text-white text-[15px] font-bold">
              Fermer
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Partager tes vidéos et tes réseaux avec les partenaires">
                <button type="button" disabled={envoi !== null} onClick={() => repondre("OUI")} data-consentement-v2-oui
                  className="min-h-[50px] px-3 rounded-xl border border-[#2D3748] text-white text-[15px] font-bold hover:border-[#E63946] hover:bg-[#E63946] transition-colors disabled:opacity-60">
                  {envoi === "OUI" ? "…" : TEXTES_V2.oui}
                </button>
                <button type="button" disabled={envoi !== null} onClick={() => repondre("NON")} data-consentement-v2-non
                  className="min-h-[50px] px-3 rounded-xl border border-[#2D3748] text-white text-[15px] font-bold hover:border-white/40 hover:bg-white/[0.08] transition-colors disabled:opacity-60">
                  {envoi === "NON" ? "…" : TEXTES_V2.non}
                </button>
              </div>
              <p className="text-[12px] text-[#6b7280] leading-relaxed mt-3">
                {etat.statut === "V1" ? TEXTES_V2.nonV1 : TEXTES_V2.nonAucun} {TEXTES_V2.parametres}
              </p>
              {avecPlusTard && (
                <button type="button" disabled={envoi !== null} onClick={() => repondre("PLUS_TARD")} data-consentement-v2-plus-tard
                  className="w-full mt-2 min-h-[44px] text-[14px] font-semibold text-[#9CA3AF] hover:text-white disabled:opacity-60">
                  {envoi === "PLUS_TARD" ? "…" : TEXTES_V2.plusTard}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
