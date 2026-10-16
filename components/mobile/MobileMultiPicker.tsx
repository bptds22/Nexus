"use client";

/* ═══════════════════════════════════════════════════════════════
   MobileMultiPicker — bottom-sheet à cases à cocher (1.4.5, A6).

   Le pendant mobile du FacetDropdown du web (Mon processus) : plusieurs
   valeurs cochées (OU dans la facette), recherche dans le menu (comme le
   web), « Tout cocher / Tout décocher » sur ce qui est listé. Les
   options et leurs compteurs viennent de l'appelant (lib/pipeline) : ce
   composant n'en calcule aucun.

   Champ de recherche → règle clavier du projet : useSheetKeyboardGeometry
   (remonter ET plafonner), jamais de `bottom` inline.
═══════════════════════════════════════════════════════════════ */

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { triggerHaptic } from "@/lib/haptics";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";

export interface OptionMulti {
  value: string;
  label: string;
  count: number;
}

export function MobileMultiPicker({
  open,
  onClose,
  title,
  options,
  selected,
  onToggle,
  filtrer,
  onBasculerTout,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: readonly OptionMulti[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Champ de recherche en tête du menu, filtré par lib/pipeline (filtrerOptionsFacette). */
  filtrer?: (options: OptionMulti[], requete: string, selected: readonly string[]) => OptionMulti[];
  /** « Tout cocher / Tout décocher » sur les valeurs listées. */
  onBasculerTout?: (listees: readonly string[]) => void;
}) {
  // Portail : document.body n'existe pas au prérendu de l'export statique.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [requete, setRequete] = useState("");
  const kbdStyle = useSheetKeyboardGeometry("80vh");

  if (!mounted || !open) return null;

  const avecRecherche = !!filtrer;
  const listees = avecRecherche ? filtrer!([...options], requete, selected) : [...options];
  const valeursListees = listees.map((o) => o.value);
  const toutCoche = valeursListees.length > 0 && valeursListees.every((v) => selected.includes(v));
  const fermer = () => { void triggerHaptic("Light"); setRequete(""); onClose(); };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" style={{ animation: "nx-modal-fade 200ms ease-out forwards" }} onClick={fermer} />
      <div
        role="dialog"
        aria-label={title}
        data-multi-picker={title}
        className="fixed inset-x-0 z-[70] bg-[#111317] rounded-t-2xl flex flex-col"
        style={{ ...kbdStyle, animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
      >
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="font-head text-[18px] font-black uppercase tracking-tight text-white truncate">{title}</h2>
          <button type="button" onClick={fermer} className="min-h-[44px] px-3 -mr-3 text-[14px] font-bold text-[#E63946]">
            OK
          </button>
        </div>

        {avecRecherche && (
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Rechercher…"
              aria-label={`Rechercher dans ${title}`}
              className="w-full bg-white/[0.06] rounded-2xl px-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
            />
          </div>
        )}

        {onBasculerTout && valeursListees.length > 0 && (
          <button
            type="button"
            onClick={() => { void triggerHaptic("Light"); onBasculerTout(valeursListees); }}
            className="mx-4 mt-2 min-h-[40px] self-start text-[13px] font-semibold text-[#9CA3AF] underline underline-offset-2"
          >
            {toutCoche ? "Tout décocher" : "Tout cocher"}
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-1">
          {listees.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-[#6B7280]">Aucun résultat.</p>
          ) : listees.map((o) => {
            const coche = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="checkbox"
                aria-checked={coche}
                onClick={() => { void triggerHaptic("Light"); onToggle(o.value); }}
                className="w-full min-h-[52px] flex items-center gap-3 px-3 text-left rounded-xl active:bg-white/[0.04]"
              >
                <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${coche ? "bg-[#E63946] border-[#E63946]" : "border-white/30"}`}>
                  {coche && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </span>
                <span className="flex-1 min-w-0 text-[15px] text-white truncate">{o.label}</span>
                <span className="shrink-0 text-[13px] text-[#6B7280]">{o.count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}
