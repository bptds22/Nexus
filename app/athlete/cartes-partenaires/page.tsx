"use client";

/* ═══════════════════════════════════════════════════════════════
   /athlete/cartes-partenaires — les évaluations de partenaires qui
   attendent la réponse du jeune (W4c, web).

   Y arrivent : une carte ouverte par le lien et pas encore répondue, une
   PROPOSITION de Nexus (notification PARTENAIRE_EVALUATION), une carte
   confirmée qui attend la visibilité partenaire. Source :
   prospect_partenaire_mes_cartes (base W4a).

   Web seulement : le mobile publié affiche la notification sans écran de
   réponse ; son texte renvoie à nexussports.ca (registre §85, lot mobile).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CarteProspectReponse from "@/components/athlete/prospects/CarteProspectReponse";
import { chargerCartesJeune, type CarteJeune } from "@/lib/partenaires/prospects";

export default function CartesPartenairesPage() {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();

  const [cartes, setCartes] = useState<CarteJeune[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    chargerCartesJeune(createClient())
      .then(setCartes)
      .catch((e) => { console.error("[cartes partenaires]", e?.message ?? e); setErreur(true); });
  }, []);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-2xl" data-page-cartes-partenaires>
      <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Mon espace athlète</p>
      <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">Évaluations de partenaires</h1>
      <p className="text-[13px] text-[#9CA3AF] mt-1">
        Des partenaires de Nexus t&apos;ont peut-être évalué. Rien n&apos;apparaît sur ton profil sans ton accord.
      </p>

      <div className="mt-6 space-y-5">
        {erreur ? (
          <p className="text-[13px] text-[#fca5a5]">Tes évaluations n&apos;ont pas pu être chargées. Recharge la page dans un instant.</p>
        ) : cartes === null ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cartes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2D3748] p-8 text-center">
            <p className="text-[14px] font-bold text-white">Rien en attente</p>
            <p className="text-[13px] text-[#9CA3AF] mt-1">Aucune évaluation de partenaire n&apos;attend ta réponse.</p>
          </div>
        ) : (
          cartes.map((c) => <CarteProspectReponse key={c.carteId} carte={c} />)
        )}
      </div>
    </div>
  );
}
