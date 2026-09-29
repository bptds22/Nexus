"use client";

/* ListeRecherche — un champ qui filtre sa liste pendant qu'on tape
   (combobox ARIA) : flèches pour parcourir, Entrée pour choisir, Échap
   pour fermer. Retaper après un choix l'annule. La règle de recherche et
   de tri vit dans lib/demo/rechercheListe.ts. */

import { useId, useMemo, useRef, useState } from "react";
import { filtrerOptions, type OptionListe } from "@/lib/demo/rechercheListe";

export default function ListeRecherche({
  id, options, valeur, onChoisir, className, placeholder,
}: {
  id: string;
  options: OptionListe[];
  /** id de l'option choisie, "" si aucune. */
  valeur: string;
  onChoisir: (id: string) => void;
  className: string;
  placeholder?: string;
}) {
  const choisie = options.find((o) => o.id === valeur) ?? null;
  const [saisie, setSaisie] = useState<string | null>(null); // null → affiche le choix
  const [ouverte, setOuverte] = useState(false);
  const [active, setActive] = useState(0);
  const listeId = useId();
  const ul = useRef<HTMLUListElement>(null);

  const texte = saisie ?? choisie?.nom ?? "";
  const resultats = useMemo(() => filtrerOptions(options, saisie ?? ""), [options, saisie]);

  const choisir = (o: OptionListe) => {
    onChoisir(o.id);
    setSaisie(null);
    setOuverte(false);
  };

  const clavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouverte) { setOuverte(true); return; }
      const n = resultats.length;
      if (n === 0) return;
      const suivant = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      setActive(suivant);
      ul.current?.children[suivant]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && ouverte && resultats[active]) {
      e.preventDefault();
      choisir(resultats[active]);
    } else if (e.key === "Escape") {
      setOuverte(false);
      setSaisie(null);
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={ouverte}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={ouverte && resultats[active] ? `${listeId}-${resultats[active].id}` : undefined}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        value={texte}
        onFocus={() => { setOuverte(true); setActive(0); }}
        onBlur={() => { setOuverte(false); setSaisie(null); }}
        onChange={(e) => {
          setSaisie(e.target.value);
          setOuverte(true);
          setActive(0);
          if (valeur) onChoisir("");
        }}
        onKeyDown={clavier}
      />
      {ouverte && resultats.length > 0 && (
        <ul ref={ul} id={listeId} role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto border border-[#2D3F5E] bg-[#0A1428] shadow-2xl">
          {resultats.map((o, i) => (
            <li key={o.id} id={`${listeId}-${o.id}`} role="option" aria-selected={i === active}
              // mousedown : choisir AVANT que le blur du champ ne ferme la liste.
              onMouseDown={(e) => { e.preventDefault(); choisir(o); }}
              onMouseEnter={() => setActive(i)}
              className={`px-4 py-2.5 text-base cursor-pointer ${i === active ? "bg-[#E63946]/15 text-white" : "text-[#D1D5DB]"} ${o.id === valeur ? "font-semibold" : ""}`}>
              {o.nom}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
