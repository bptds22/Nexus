"use client";

/* Doublon probable à l'inscription (D1) — web et appli. Rien de l'autre fiche
   n'est montré : la base ne rend qu'un code. « Continuer » enregistre quand même. */

import {
  PHRASE_PLUSIEURS_SPORTS,
  TEXTE_AUTRE_ADRESSE,
  TEXTES_DOUBLON,
  type DoublonInscription,
} from "@/lib/athlete/doublonInscription";

export function AvertissementDoublonInscription({
  code,
  enCours,
  onContinuer,
  onAutreAdresse,
}: {
  code: DoublonInscription;
  enCours: boolean;
  onContinuer: () => void;
  onAutreAdresse: () => void;
}) {
  const t = TEXTES_DOUBLON[code];
  return (
    <div data-avertissement-doublon={code} className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-4" role="status">
      <p className="text-[14px] font-bold text-white">{t.titre}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-[#D1D5DB]">{t.detail}</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        {code === "COMPTE" && (
          <button type="button" onClick={onAutreAdresse}
            className="flex-1 min-h-[44px] py-3 rounded-lg border border-[#F59E0B]/50 text-[#F59E0B] font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#F59E0B]/10 transition-colors">
            {TEXTE_AUTRE_ADRESSE}
          </button>
        )}
        <button type="button" onClick={onContinuer} disabled={enCours}
          className="flex-1 min-h-[44px] py-3 rounded-lg bg-[#E63946] text-white font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors disabled:opacity-50">
          Continuer
        </button>
      </div>
    </div>
  );
}

/* Un compte par sport faisait un doublon (cas relevé en prod le 2026-10-15). */
export function PlusieursSports({ className = "mt-2 mb-6" }: { className?: string }) {
  return (
    <p data-plusieurs-sports className={`${className} text-[12px] leading-relaxed text-[#9CA3AF]`}>
      {PHRASE_PLUSIEURS_SPORTS.phrase}
      <span className="text-[#6b7280]"> {PHRASE_PLUSIEURS_SPORTS.ou}</span>
    </p>
  );
}
