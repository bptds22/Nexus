"use client";

/* ═══════════════════════════════════════════════════════════════
   MesAthletesPartenaire — « Mes athlètes » partenaire, UN onglet avec deux
   pastilles en haut (BP 2026-10-18, 6.1), web et appli :
     « En attente »     → les cartes pas encore liées (rouges) + propositions ;
     « Mes évaluations » → les vrais profils Nexus, y compris les réclamées.
   La pastille vit dans l'adresse (?vue=…) : l'Accueil y mène directement.
═══════════════════════════════════════════════════════════════ */

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";
import { adresseVue, lireVue, PASTILLES_MES_ATHLETES, type VueMesAthletes } from "@/lib/partenaires/vueMesAthletes";
import { classesPage, EnTetePartenaire } from "@/components/partenaire/kit/KitPartenaire";
import EnTeteMobilePartenaire from "@/components/partenaire/mobile/EnTeteMobilePartenaire";
import CartesEnAttenteWeb from "@/components/partenaire/CartesEnAttenteWeb";
import MesEvaluationsWeb from "@/components/partenaire/MesEvaluationsWeb";
import MesAthletesMobile from "@/components/partenaire/mobile/MesAthletesMobile";
import MesEvaluationsMobile from "@/components/partenaire/mobile/MesEvaluationsMobile";

function Pastilles({ vue, onChoix, mobile }: { vue: VueMesAthletes; onChoix: (v: VueMesAthletes) => void; mobile: boolean }) {
  return (
    <div role="tablist" aria-label="Mes athlètes" className="flex items-center gap-2" data-pastilles-mes-athletes>
      {PASTILLES_MES_ATHLETES.map((p) => {
        const actif = p.key === vue;
        return (
          <button key={p.key} type="button" role="tab" aria-selected={actif} data-pastille={p.key}
            onClick={() => { if (mobile) void triggerHaptic("Light"); onChoix(p.key); }}
            className={`${mobile ? "h-10 px-4 text-[14px]" : "h-9 px-4 text-[13px]"} rounded-full font-bold border transition-colors ${
              actif ? "bg-[#E63946] border-[#E63946] text-white" : "bg-[#1A1D24] border-white/[0.08] text-[#c8c8cc] hover:text-white"}`}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function useVue() {
  const params = useSearchParams();
  const router = useRouter();
  const { vue, propositions } = lireVue(params);
  const aller = (v: VueMesAthletes, prop = false) => {
    router.replace(adresseVue(v, prop), { scroll: false });
  };
  return { vue, propositions, aller };
}

function Web() {
  const { vue, propositions, aller } = useVue();
  return (
    <div className={classesPage()} data-page-mes-athletes-fusion>
      <EnTetePartenaire titre="Mes athlètes" actions={<Pastilles vue={vue} onChoix={(v) => aller(v)} mobile={false} />} />
      <div className="mt-6">
        {vue === "attente"
          ? <CartesEnAttenteWeb propositionsSeulement={propositions} onToutVoir={() => aller("attente")} />
          : <MesEvaluationsWeb />}
      </div>
    </div>
  );
}

function Mobile() {
  const { vue, propositions, aller } = useVue();
  return (
    <div className="min-h-screen bg-[#111317] text-white" data-page-mes-athletes-fusion>
      <EnTeteMobilePartenaire titre="Mes athlètes" />
      <div className="px-4 pt-1 pb-2"><Pastilles vue={vue} onChoix={(v) => aller(v)} mobile /></div>
      {vue === "attente"
        ? <MesAthletesMobile propositionsSeulement={propositions} onToutVoir={() => aller("attente")} />
        : <MesEvaluationsMobile />}
    </div>
  );
}

export default function MesAthletesPartenaire({ mobile }: { mobile: boolean }) {
  // useSearchParams exige une frontière Suspense (export statique de l'appli).
  return <Suspense fallback={null}>{mobile ? <Mobile /> : <Web />}</Suspense>;
}
