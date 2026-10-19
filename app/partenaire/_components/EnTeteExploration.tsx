"use client";

/* ═══════════════════════════════════════════════════════════════
   EnTeteExploration — le haut commun de Newsroom, Tendances et
   Classements (BP 2026-10-18, 6.5) : plus de place pour le contenu.
     - le titre (et sa ligne) avec, À CÔTÉ, UN bouton « Filtres » qui
       ouvre la recherche et les filtres avancés (ceux d'avant, inchangés) ;
       le nombre de filtres actifs s'affiche sur le bouton ;
     - dessous, des pastilles rapides de période (Cette semaine, Ce mois,
       Saison) quand l'écran en a une.
   Dans l'appli, le titre est porté par l'en-tête natif (h1 caché par
   [data-ecran-plus]) : le bouton reste en haut à droite.
═══════════════════════════════════════════════════════════════ */

import { useState, type ReactNode } from "react";
import Link from "next/link";

export interface PastillePeriode { label: string; href: string; actif: boolean }

export default function EnTeteExploration({ titre, sousTitre, nbActifs, periode, reinitialiser, children }: {
  titre: string;
  sousTitre?: string;
  /** Nombre de filtres avancés actifs (hors période), affiché sur le bouton. */
  nbActifs: number;
  periode?: PastillePeriode[];
  /** Adresse sans filtre, offerte dans le panneau quand un filtre est actif. */
  reinitialiser?: string;
  /** Le contenu du panneau « Filtres » (barres de filtres existantes). */
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="space-y-3" data-entete-exploration>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">{titre}</h1>
          {sousTitre && <p className="text-[14px] text-[#9CA3AF] mt-1">{sousTitre}</p>}
        </div>
        <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} data-bouton-filtres
          className={`shrink-0 h-10 px-4 rounded-full border text-[13px] font-bold flex items-center gap-2 transition-colors ${
            ouvert || nbActifs > 0 ? "border-[#E63946] bg-[#E63946]/10 text-white" : "border-[#2D3748] bg-[#13151a] text-[#c8c8cc] hover:text-white"}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" />
          </svg>
          Filtres
          {nbActifs > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#E63946] text-white text-[11px] font-black flex items-center justify-center">{nbActifs}</span>
          )}
        </button>
      </div>

      {periode && periode.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-pastilles-periode>
          {periode.map((p) => (
            <Link key={p.label} href={p.href} aria-current={p.actif ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap h-9 px-4 rounded-full border text-[13px] font-bold flex items-center transition-colors ${
                p.actif ? "bg-[#E63946] border-[#E63946] text-white" : "bg-[#1A1D24] border-white/[0.08] text-[#c8c8cc] hover:text-white"}`}>
              {p.label}
            </Link>
          ))}
        </div>
      )}

      {ouvert && (
        <div className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-4 space-y-3" data-panneau-filtres>
          {children}
          {reinitialiser && nbActifs > 0 && (
            <Link href={reinitialiser} className="inline-block text-[12px] font-bold text-[#9CA3AF] hover:text-white underline underline-offset-2">
              Réinitialiser les filtres
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
