"use client";

/* « Cet athlète existe déjà » (D1, 2026-10-15) — assistant coach, web et appli.
   Seulement des fiches que ce coach voit déjà (RLS de la RPC) : ce qu'il ne voit
   pas ne sort jamais de la base. Les actions (ouvrir, inviter) sont celles de
   chaque surface : le lien d'une fiche et le choix d'équipe y diffèrent. */

import type { ReactNode } from "react";
import { TEXTES_MEME_IDENTITE, type AthleteMemeIdentite } from "@/lib/queries/coach/athletesMemeIdentite";

export default function MemeIdentiteAvertissement({
  athletes,
  voirFiche,
  inviter,
  onContinuer,
  className = "",
}: {
  athletes: readonly AthleteMemeIdentite[];
  /** Le bouton ou le lien « Voir sa fiche » de la surface. */
  voirFiche: (a: AthleteMemeIdentite, libelle: string) => ReactNode;
  /** Le bloc d'invitation (null = rien), et son retour éventuel. */
  inviter?: (a: AthleteMemeIdentite) => ReactNode;
  /** « Ce n'est pas lui » : la création reprend. */
  onContinuer: () => void;
  className?: string;
}) {
  if (athletes.length === 0) return null;
  const t = TEXTES_MEME_IDENTITE;
  return (
    <div data-meme-identite className={`${className} rounded-lg bg-[#1A1D24] border border-[#F59E0B]/30 p-4`}>
      <p className="text-[13px] font-semibold text-white">{t.titre}</p>
      <p className="text-[12px] text-[#9CA3AF] mt-1 leading-relaxed">{t.detail}</p>
      <ul className="mt-3 space-y-3">
        {athletes.map((a) => (
          <li key={a.athleteId} className="rounded-lg border border-[#2D3748] bg-[#111317] p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold text-white">{a.prenom} {a.nom}</span>
              {a.ecole && <span className="text-[12px] text-[#9CA3AF]">· {a.ecole}</span>}
              <span className="text-[11px] font-semibold text-[#F59E0B]">{a.estLeMien ? t.mien : t.pasMien}</span>
            </div>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              {voirFiche(a, t.voir)}
              {inviter?.(a)}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onContinuer}
        className="mt-3 min-h-[36px] text-[12px] font-semibold text-[#9CA3AF] hover:text-white underline underline-offset-2">
        {t.continuer}
      </button>
    </div>
  );
}
