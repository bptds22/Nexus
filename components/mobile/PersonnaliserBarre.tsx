"use client";

/* « Personnaliser la barre » (BP 2026-10-19) : jusqu'à 4 onglets choisis parmi ceux du rôle,
   dans l'ordre voulu ; « Plus » reste le dernier. Enregistré sur le compte (lib/mobile/barrePerso). */

import { useState, type ReactNode } from "react";
import { FeuilleBas } from "@/components/mobile/FeuilleBas";
import { MAX_ONGLETS } from "@/lib/mobile/barrePerso";
import { triggerHaptic } from "@/lib/haptics";

export interface OngletPossible { key: string; label: string; icon: ReactNode }

export default function PersonnaliserBarre({ pool, actuels, onFermer, onEnregistrer, onDefaut }: {
  pool: readonly OngletPossible[];
  /** Les clés de la barre actuelle, dans l'ordre. */
  actuels: readonly string[];
  onFermer: () => void;
  onEnregistrer: (cles: string[]) => Promise<void>;
  onDefaut: () => Promise<void>;
}) {
  const [choix, setChoix] = useState<string[]>(() => actuels.filter((k) => pool.some((p) => p.key === k)));
  const [enCours, setEnCours] = useState(false);
  const parCle = new Map(pool.map((p) => [p.key, p]));
  const restants = pool.filter((p) => !choix.includes(p.key));
  const plein = choix.length >= MAX_ONGLETS;

  const deplacer = (i: number, d: -1 | 1) => setChoix((c) => {
    const j = i + d;
    if (j < 0 || j >= c.length) return c;
    const n = [...c];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const agir = async (f: () => Promise<void>) => {
    setEnCours(true);
    try { await f(); } finally { setEnCours(false); }
  };

  const ligne = "flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 min-h-[52px]";
  const petit = "h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white/70 active:bg-white/10 disabled:opacity-30";

  return (
    <FeuilleBas onFermer={onFermer} titre="Personnaliser la barre" testId="personnaliser-barre"
      pied={
        <div className="flex items-center gap-3">
          <button type="button" disabled={enCours} onClick={() => void agir(onDefaut)}
            className="h-12 px-4 text-[14px] font-semibold text-white/60 underline disabled:opacity-40">Par défaut</button>
          <button type="button" disabled={enCours || choix.length === 0} onClick={() => { triggerHaptic("Medium"); void agir(() => onEnregistrer(choix)); }}
            className="h-12 flex-1 rounded-2xl bg-[#E63946] text-[16px] font-bold text-white disabled:opacity-40">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      }>
      <p className="text-[13px] text-white/55 mb-3">Jusqu&apos;à {MAX_ONGLETS} onglets ; « Plus » reste toujours le dernier.</p>
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/45 mb-2">Dans ta barre</p>
      <ul className="space-y-2 mb-5">
        {choix.map((k, i) => {
          const p = parCle.get(k);
          if (!p) return null;
          return (
            <li key={k} className={ligne} data-onglet-choisi={k}>
              <span className="text-[#E63946] [&_svg]:w-[22px] [&_svg]:h-[22px]">{p.icon}</span>
              <span className="flex-1 text-[15px] font-semibold text-white">{p.label}</span>
              <button type="button" aria-label={`Monter ${p.label}`} disabled={i === 0} onClick={() => deplacer(i, -1)} className={petit}>▲</button>
              <button type="button" aria-label={`Descendre ${p.label}`} disabled={i === choix.length - 1} onClick={() => deplacer(i, 1)} className={petit}>▼</button>
              <button type="button" aria-label={`Retirer ${p.label}`} onClick={() => setChoix((c) => c.filter((x) => x !== k))} className={petit}>✕</button>
            </li>
          );
        })}
        {choix.length === 0 && <li className="text-[13px] text-white/40">Ajoute au moins un onglet.</li>}
      </ul>
      {restants.length > 0 && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/45 mb-2">Ajouter</p>
          <ul className="space-y-2">
            {restants.map((p) => (
              <li key={p.key}>
                <button type="button" disabled={plein} onClick={() => setChoix((c) => [...c, p.key])} data-onglet-possible={p.key}
                  className={`${ligne} w-full text-left disabled:opacity-40`}>
                  <span className="text-white/60 [&_svg]:w-[22px] [&_svg]:h-[22px]">{p.icon}</span>
                  <span className="flex-1 text-[15px] text-white/85">{p.label}</span>
                  <span className="text-[20px] font-bold text-[#E63946]">+</span>
                </button>
              </li>
            ))}
          </ul>
          {plein && <p className="mt-2 text-[12px] text-white/40">Barre pleine : retire un onglet pour en ajouter un autre.</p>}
        </>
      )}
    </FeuilleBas>
  );
}
