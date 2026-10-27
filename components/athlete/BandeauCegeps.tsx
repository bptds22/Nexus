"use client";

/* Bandeau « Les cégeps sont maintenant sur Nexus ! » (lot C1 cégep, point 5) — WEB seulement, et
   seulement quand l'interrupteur lancement_collegial est ON (règle : lib/athlete/bandeauCegeps.ts).
   Mène à /athlete/transfert : choisir son cégep et son équipe, confirmer l'année de fin de cégep. */

import Link from "next/link";
import { useNomsCegeps } from "@/lib/athlete/useNomsCegeps";
import { useEtatCegepien } from "@/lib/athlete/useEtatCegepien";
import { doitVoirBandeauCegeps, TEXTE_BANDEAU_CEGEPS } from "@/lib/athlete/bandeauCegeps";

export default function BandeauCegeps() {
  const { etat, charge } = useEtatCegepien();
  // La liste des noms de cégeps ne se charge que si un texte libre est à reconnaître.
  const nomsCegeps = useNomsCegeps(charge && etat.lancementCollegial && !!etat.ecoleNonListee);
  if (!charge || !doitVoirBandeauCegeps(etat, nomsCegeps)) return null;

  return (
    <Link
      href="/athlete/transfert"
      className="flex items-center gap-4 bg-[#1A1D24] border border-[#3B82F6]/30 hover:border-[#3B82F6]/60 rounded-xl px-5 py-4 transition-colors group"
    >
      <span className="w-11 h-11 shrink-0 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-xl">
        🎓
      </span>
      <p className="flex-1 min-w-0 text-[13px] leading-relaxed text-white">{TEXTE_BANDEAU_CEGEPS}</p>
      <span className="text-[12px] font-bold text-[#3B82F6] shrink-0">Choisir mon cégep →</span>
    </Link>
  );
}
