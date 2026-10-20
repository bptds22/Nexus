"use client";

/* ═══════════════════════════════════════════════════════════════
   EtendreConsentementPartenairesV2 — dans les paramètres (web et appli),
   sous l'interrupteur « Partenaires médias ».

   Accord v1 (la carte seulement) : une ligne + « Partager aussi mes vidéos et
   mes réseaux » (un toucher, v2). C'est là que la demande reste quand la carte
   plein écran ne revient plus (« Non », 3 « Plus tard »).
   Accord v2 : une ligne de confirmation. Aucun accord : rien (l'interrupteur
   accorde directement la v2).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { lireEtatV2, repondreV2, TEXTES_V2, type EtatV2 } from "@/lib/partenaires/consentementV2";

type Props = {
  /** Change quand l'interrupteur bouge : la ligne se relit. */
  cle: unknown;
  notifier?: (message: string) => void;
};

export default function EtendreConsentementPartenairesV2({ cle, notifier }: Props) {
  const [etat, setEtat] = useState<EtatV2 | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    void lireEtatV2(createClient()).then((e) => { if (vivant) setEtat(e); });
    return () => { vivant = false; };
  }, [cle]);

  if (!etat || etat.statut === "AUCUN") return null;

  if (etat.statut === "V2") {
    return <p className="text-[12px] text-[#22C55E] leading-relaxed" data-consentement-v2-parametres="V2">{TEXTES_V2.etendreFait}</p>;
  }

  async function etendre() {
    setEnvoi(true);
    setMessage(null);
    const res = await repondreV2(createClient(), "OUI");
    setEnvoi(false);
    if ("erreur" in res) { setMessage(res.erreur); return; }
    if (res.issue === "DEMANDE_PARENT") { setMessage(TEXTES_V2.merciParent); return; }
    notifier?.(TEXTES_V2.merciOui);
    setEtat(await lireEtatV2(createClient()));
  }

  return (
    <div className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-3" data-consentement-v2-parametres="V1">
      <p className="text-[13px] font-bold text-white">{TEXTES_V2.etendreTitre}</p>
      <p className="text-[12px] text-[#9CA3AF] leading-relaxed mt-1">{TEXTES_V2.etendreTexte}</p>
      {etat.demandeParent ? (
        <p className="text-[12px] text-[#F59E0B] leading-relaxed mt-2">{TEXTES_V2.merciParent}</p>
      ) : (
        <button type="button" disabled={envoi} onClick={etendre} data-consentement-v2-etendre
          className="mt-3 min-h-[40px] px-4 rounded-lg border border-[#2D3748] text-white text-[13px] font-bold hover:border-[#E63946] hover:bg-[#E63946] transition-colors disabled:opacity-60">
          {envoi ? "…" : TEXTES_V2.etendreBouton}
        </button>
      )}
      {message && <p className="text-[12px] text-[#F59E0B] leading-relaxed mt-2" role="status">{message}</p>}
    </div>
  );
}
