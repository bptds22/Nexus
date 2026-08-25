"use client";

/* ═══════════════════════════════════════════════════════════════
   ProgrammeCegepPicker — LE sélecteur, partagé par les cinq surfaces
   de saisie (onboarding athlète, wizard mobile, profil athlète,
   création coach, admin). Il remplace quatre vocabulaires
   incompatibles : PROGRAMME_TYPE_OPTIONS (2 valeurs + texte libre),
   le CEGEP_PROGRAMS local de l'admin (8 valeurs), le CEGEP_PROGRAMS
   mort de lib/mock, et un <input type="text"> brut.

   CE QU'IL ÉCRIT
   Un uuid[] de cegep_program_labels.id, 3 maximum. Jamais du texte.

   LES QUATRE RÈGLES D'AFFICHAGE (décision produit du 2026-08-25)
    ① On ne parcourt pas 228 entrées — on cherche. Le champ de
       recherche a le focus d'entrée.
    ② Liste au repos = les 183 VEDETTES, groupées préuniversitaire /
       technique. Une entrée par code, zéro doublon visuel.
    ③ Dès la première frappe, la recherche court sur les 228 libellés,
       queue comprise. C'est ce qui fait que « psycho » trouve
       « Sciences humaines — Psychologie » — un libellé que seuls
       2 cégeps emploient, et le SEUL endroit où le vocabulaire d'un
       ado de 16 ans existe. La formule ministérielle
       (« Sciences humaines avec mathématiques supplémentaires ») ne
       contient aucun des mots qu'il cherche.
    ④ Un libellé de queue affiche sa PORTÉE RÉELLE. C'est la ligne qui
       rend le choix honnête : « Sciences humaines — Psychologie »
       n'existe que chez 2 cégeps, mais la clé stockée (300.M1) ouvre
       38 portes. On ne vend pas une précision qui n'existe pas, et on
       ne cache pas ce que le choix vaut vraiment.
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import {
  useCegepPrograms, normProg, MAX_PROGRAMMES_VISES,
  type CegepProgramLabel,
} from "@/lib/queries/shared/useCegepPrograms";

interface Props {
  open: boolean;
  onClose: () => void;
  /** cegep_program_labels.id[] — la valeur de athletes.programmes_vises. */
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}

function Portee({ l }: { l: CegepProgramLabel }) {
  // Règle ④. Une vedette n'a pas besoin de se justifier : elle EST le
  // nom du programme. Seul un libellé de queue doit dire ce qu'il vaut.
  if (l.isVedette) {
    return (
      <span className="text-[10px] text-[#4a4d56]">
        {l.cegepsOffrant > 0 ? `${l.cegepsOffrant} cégep${l.cegepsOffrant > 1 ? "s" : ""}` : "—"}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-[#4a4d56]">
      {l.nbEcoles} cégep{l.nbEcoles > 1 ? "s" : ""} le nomment ainsi
      {l.code ? ` · ${l.code}, offert par ${l.cegepsOffrant}` : ""}
    </span>
  );
}

/* Hors du composant parent, deliberement : defini a l'interieur, il etait
   recree a CHAQUE rendu — donc la liste entiere se demontait et se remontait
   a chaque caractere tape dans la recherche. C'est le motif que signale
   react-hooks/static-components, et ici il coute cher : le sélecteur est
   fait pour etre tape dedans. */
function Groupe({ titre, items, value, plein, onToggle }: {
  titre: string;
  items: CegepProgramLabel[];
  value: string[];
  plein: boolean;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{titre}</div>
      {items.map((l) => {
        const on = value.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle(l.id)}
            disabled={!on && plein}
            className={`w-full text-left px-3 py-2.5 border-b border-[#1f2229] transition-colors ${
              on ? "bg-[#E63946]/10" : !on && plein ? "opacity-40 cursor-not-allowed" : "hover:bg-[#1a1d24]"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 w-4 h-4 shrink-0 rounded border ${on ? "bg-[#E63946] border-[#E63946]" : "border-[#2D3748]"}`} />
              <span className="min-w-0">
                <span className="block text-[13px] text-white leading-tight">{l.label}</span>
                <Portee l={l} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ProgrammeCegepPicker({
  open, onClose, value, onChange, max = MAX_PROGRAMMES_VISES,
}: Props) {
  const { data: catalogue = [], isLoading } = useCegepPrograms();
  const [q, setQ] = useState("");

  const selected = useMemo(
    () => catalogue.filter((l) => value.includes(l.id)),
    [catalogue, value],
  );

  const results = useMemo(() => {
    const nq = normProg(q);
    // Règle ② au repos, règle ③ dès la première frappe.
    const pool = nq ? catalogue : catalogue.filter((l) => l.isVedette);
    const hits = nq ? pool.filter((l) => normProg(l.label).includes(nq)) : pool;
    // Les plus répandus d'abord : un ado qui tape « sciences humaines »
    // doit voir le programme de 52 cégeps avant le profil d'un seul.
    return [...hits].sort(
      (a, b) =>
        (b.isVedette ? 1 : 0) - (a.isVedette ? 1 : 0) ||
        b.cegepsOffrant - a.cegepsOffrant ||
        a.label.localeCompare(b.label, "fr"),
    );
  }, [catalogue, q]);

  const preu = results.filter((l) => l.type === "preuniversitaire");
  const tech = results.filter((l) => l.type === "technique");

  if (!open) return null;

  const plein = value.length >= max;
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else if (!plein) onChange([...value, id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] flex flex-col bg-[#13151a] border border-[#2D3748] rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[#2D3748]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold text-white">Programme CÉGEP visé</span>
            <button type="button" onClick={onClose} className="text-[12px] text-[#6b7280] hover:text-white">Fermer</button>
          </div>
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isLoading ? "Chargement…" : `Chercher parmi ${catalogue.length} programmes…`}
            className="w-full px-3 py-2 bg-[#0d0f13] border border-[#2D3748] rounded-lg text-[13px] text-white placeholder-[#4a4d56]"
          />
          <p className="mt-1.5 text-[10px] text-[#6b7280]">
            {value.length}/{max} choisi{value.length > 1 ? "s" : ""}
            {plein ? " — retire-en un pour en ajouter un autre" : ""}
          </p>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selected.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  className="px-2 py-1 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[11px] text-[#E63946]"
                >
                  {l.label} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {!isLoading && results.length === 0 && (
            <p className="p-4 text-[12px] text-[#6b7280]">Aucun programme ne correspond à « {q} ».</p>
          )}
          <Groupe titre="Préuniversitaire" items={preu} value={value} plein={plein} onToggle={toggle} />
          <Groupe titre="Technique" items={tech} value={value} plein={plein} onToggle={toggle} />
        </div>
      </div>
    </div>
  );
}
