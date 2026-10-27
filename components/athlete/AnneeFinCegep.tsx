"use client";

/* « Année où tu finis ton cégep » sur /athlete/transfert (lot C1 cégep, points 2 et 5) — WEB
   seulement, quand l'interrupteur lancement_collegial est ON et que l'athlète est ancré à un cégep.
   Même colonne qu'à l'inscription (athletes.annee_diplomation, hors périmètre protégé), même fenêtre
   (optionsAnneeCegep), sans présélection : une année hors fenêtre déjà enregistrée reste offerte. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { optionsAnneeCegep, LIBELLE_ANNEE_CEGEP } from "@/lib/config/gradYears";
import type { EtatCegepien } from "@/lib/athlete/useEtatCegepien";
import { messageEchecSauvegarde } from "@/lib/sauvegarde/messageEchec";

export default function AnneeFinCegep({ etat, onEnregistre }: { etat: EtatCegepien; onEnregistre?: (m: string) => void }) {
  const enBase = etat.anneeDiplomation ? String(etat.anneeDiplomation) : "";
  const [annee, setAnnee] = useState(enBase);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  useEffect(() => { setAnnee(enBase); }, [enBase]);

  if (!etat.lancementCollegial || etat.typeEcole !== "CEGEP" || !etat.athleteId) return null;
  const options = optionsAnneeCegep(new Date(), enBase || null);

  async function enregistrer() {
    if (!annee || !etat.athleteId) return;
    setBusy(true);
    setErreur("");
    const { error } = await createClient()
      .from("athletes")
      .update({ annee_diplomation: parseInt(annee, 10) })
      .eq("id", etat.athleteId);
    setBusy(false);
    if (error) { setErreur(messageEchecSauvegarde(error, "Année de fin de cégep")); return; }
    onEnregistre?.("Année de fin de cégep enregistrée");
  }

  return (
    <section className="mt-6 rounded-xl border border-[#2D3748] bg-[#1A1D24] p-6">
      <label className="mb-1.5 block text-[12px] font-semibold text-[#9CA3AF]" htmlFor="annee-fin-cegep">
        {LIBELLE_ANNEE_CEGEP}
      </label>
      <div className="flex gap-3">
        <select
          id="annee-fin-cegep"
          title={LIBELLE_ANNEE_CEGEP}
          value={annee}
          onChange={(e) => setAnnee(e.target.value)}
          className="h-11 flex-1 rounded-lg border border-[#2D3748] bg-[#111317] px-4 text-[14px] text-white focus:border-[#E63946]/50 focus:outline-none"
        >
          <option value="" disabled>Sélectionner l&apos;année…</option>
          {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <button
          type="button"
          disabled={!annee || annee === enBase || busy}
          onClick={enregistrer}
          className="rounded-lg bg-[#E63946] px-5 font-head text-[12px] font-bold uppercase tracking-widest text-white transition hover:bg-[#D42B22] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Confirmer"}
        </button>
      </div>
      {erreur ? <p className="mt-2 text-[12px] text-[#EF4444]">{erreur}</p> : null}
    </section>
  );
}
