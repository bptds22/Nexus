"use client";

/* ═══════════════════════════════════════════════════════════════
   /athlete/consentement-partenaires — la demande v2 (vidéos + réseaux),
   ouverte par le push unique de la campagne (BP 2026-10-19).

   On y vient exprès : la carte s'affiche même pendant l'attente de 3 jours
   d'un « Plus tard », sans bouton « Plus tard ». Déjà répondu (v2 acceptée,
   « Non », demande au parent en cours) : l'état, et le chemin des paramètres.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { lireEtatV2, TEXTES_V2, type EtatV2 } from "@/lib/partenaires/consentementV2";
import CarteConsentementPartenairesV2 from "@/components/shared/CarteConsentementPartenairesV2";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export default function ConsentementPartenairesPage() {
  const router = useRouter();
  const [etat, setEtat] = useState<EtatV2 | null | "erreur">(null);
  const [carte, setCarte] = useState(false);

  useEffect(() => {
    lireEtatV2(createClient()).then((e) => {
      if (!e) { setEtat("erreur"); return; }
      setEtat(e);
      setCarte(e.statut !== "V2" && !e.refuse && !e.demandeParent);
    });
  }, []);

  if (etat === null) return null;

  if (carte && etat !== "erreur") {
    return (
      <CarteConsentementPartenairesV2
        etat={etat}
        avecPlusTard={false}
        onFermer={() => router.replace("/athlete")}
      />
    );
  }

  const message = etat === "erreur" ? TEXTES_V2.echec
    : etat.statut === "V2" ? TEXTES_V2.etendreFait
    : etat.demandeParent ? TEXTES_V2.merciParent
    : TEXTES_V2.merciNon;

  return (
    <div className={`px-4 sm:px-8 max-w-2xl ${IS_CAPACITOR ? "pb-6 nx-safe-top" : "py-6 sm:py-8"}`} data-page-consentement-v2>
      <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Mon espace athlète</p>
      <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">{TEXTES_V2.titre}</h1>
      <p className="text-[14px] text-white leading-relaxed mt-3">{message}</p>
      <p className="text-[13px] text-[#9CA3AF] leading-relaxed mt-2">{TEXTES_V2.parametres}</p>
      <button type="button" onClick={() => router.push("/athlete/parametres")}
        className="mt-5 min-h-[44px] px-5 rounded-xl border border-[#2D3748] text-white text-[14px] font-bold hover:border-white/40">
        Mes paramètres
      </button>
    </div>
  );
}
