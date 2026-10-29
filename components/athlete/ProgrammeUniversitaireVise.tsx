"use client";

/* Programme universitaire visé du cégépien (D5 Q6, décision BP 2026-10-29).
   Une saisie avec suggestions tirées du catalogue des universités (university_programs, lisible par le
   cégépien sous lancement_universitaire ON seulement — la base cache tout sous OFF), ou un texte libre.
   La valeur rendue : { id, libelle }. Pour un programme du catalogue, la base réécrit elle-même le libellé
   (« Programme — Université ») ; pour un texte libre, id = null. */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/utils/useDebouncedValue";

export type ProgrammeUniversitaireValeur = { id: string | null; libelle: string | null };

type Suggestion = { id: string; libelle: string; cycle: string | null };

const un = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));

/** Libellé affiché d'un programme du catalogue — même forme que celle que pose la base. */
export function libelleProgrammeUniversitaire(nom: string, universite: string | null): string {
  return universite ? `${nom} — ${universite}` : nom;
}

export default function ProgrammeUniversitaireVise({ value, onChange, inputCls }: {
  value: ProgrammeUniversitaireValeur;
  onChange: (v: ProgrammeUniversitaireValeur) => void;
  inputCls: string;
}) {
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const terme = useDebouncedValue(saisie.trim(), 250);

  useEffect(() => {
    if (terme.length < 2) return;
    let vivant = true;
    const motif = `%${terme.replace(/[%_]/g, "")}%`;
    void createClient()
      .from("university_programs")
      .select("id, name, cycle, schools!school_id(name)")
      .ilike("name", motif)
      .order("name")
      .limit(12)
      .then(({ data }) => {
        if (!vivant) return;
        setSuggestions((data ?? []).map((p) => ({
          id: p.id as string,
          libelle: libelleProgrammeUniversitaire(p.name as string, un<{ name: string }>(p.schools)?.name ?? null),
          cycle: (p.cycle as string) ?? null,
        })));
      });
    return () => { vivant = false; };
  }, [terme]);

  // Sous 2 lettres, aucune suggestion (l'ancienne liste n'est simplement pas montrée).
  const visibles = terme.length >= 2 ? suggestions : [];

  if (value.libelle) {
    return (
      <div className={`${inputCls} flex items-center justify-between gap-2 text-white`}>
        <span className="truncate" title={value.libelle}>{value.libelle}</span>
        <button type="button" aria-label="Retirer le programme visé" onClick={() => onChange({ id: null, libelle: null })}
          className="shrink-0 text-[#9CA3AF] hover:text-white text-[13px] leading-none">✕</button>
      </div>
    );
  }

  const libre = saisie.trim().replace(/\s+/g, " ");
  return (
    <div className="relative">
      <input type="text" value={saisie} placeholder="Ex. : médecine, génie, kinésiologie…"
        onChange={(e) => { setSaisie(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onBlur={() => window.setTimeout(() => setOuvert(false), 150)}
        className={inputCls} />
      {ouvert && libre.length >= 2 && (
        <ul role="listbox" className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-[#2D3748] bg-[#13151a] shadow-xl">
          {visibles.map((s) => (
            <li key={s.id}>
              <button type="button" role="option" aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange({ id: s.id, libelle: s.libelle }); setSaisie(""); setOuvert(false); }}
                className="w-full text-left px-3 py-2 text-[12px] text-white hover:bg-[#E63946]/15">
                {s.libelle}
              </button>
            </li>
          ))}
          {libre.length >= 2 && (
            <li>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange({ id: null, libelle: libre.slice(0, 200) }); setSaisie(""); setOuvert(false); }}
                className="w-full text-left px-3 py-2 text-[12px] text-[#9CA3AF] hover:bg-white/5 border-t border-[#2D3748]">
                Utiliser « {libre} » tel quel
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
