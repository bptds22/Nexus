"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadSchools, type SchoolRow } from "@/lib/queries/schools/allSchools";
import type { SchoolType } from "@/lib/utils/orgLabel";

/* ─────────────────────────────────────────────────────────────────
   SchoolSelect — searchable combobox for picking a school.
   - Fetches all schools once (client-cached across instances)
   - Client-side filtering on name + city
   - Max 20 visible results
   - Optional filterType to restrict to SECONDAIRE or CEGEP
───────────────────────────────────────────────────────────────── */

/* Le chargement (pagination + cache) vit désormais dans
   lib/queries/schools/allSchools.ts — implémentation unique partagée avec
   le sheet mobile, qui s'en était écarté et retombait sous le plafond de
   1000 lignes de PostgREST. Les deux types sont ré-exportés pour ne rien
   changer à la surface publique de ce composant. */
export type { SchoolRow };
export type { SchoolType };

interface Props {
  value: string | null;
  onChange: (schoolId: string) => void;
  placeholder?: string;
  filterType?: SchoolType | null;
  className?: string;
  disabled?: boolean;
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase().trim();
}

export default function SchoolSelect({
  value,
  onChange,
  placeholder = "Rechercher une école...",
  filterType = null,
  className = "",
  disabled = false,
}: Props) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    loadSchools().then((list) => {
      if (alive) setSchools(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = useMemo(
    () => schools.find((s) => s.id === value) ?? null,
    [schools, value],
  );

  const filtered = useMemo(() => {
    const base = filterType ? schools.filter((s) => s.type === filterType) : schools;
    const q = normalize(query);
    if (!q) return base.slice(0, 20);
    return base
      .filter((s) => {
        const n = normalize(s.name);
        const c = s.city ? normalize(s.city) : "";
        return n.includes(q) || c.includes(q);
      })
      .slice(0, 20);
  }, [schools, filterType, query]);

  const inputValue = open ? query : selected ? `${selected.name}${selected.city ? " — " + selected.city : ""}` : query;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => { if (!disabled) { setOpen(true); setQuery(""); } }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          className="w-full bg-[#1A1D24] border border-[#2D3748] rounded-lg pl-4 pr-9 py-2.5 text-[13px] text-white placeholder:text-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 disabled:opacity-50"
        />
        {selected && !disabled && (
          <button
            type="button"
            title="Effacer"
            onClick={(e) => { e.stopPropagation(); onChange(""); setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-[#6b7280] hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#1A1D24] border border-[#2D3748] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.5)] max-h-[320px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-[#6b7280] italic">
              {schools.length === 0 ? "Chargement..." : "Aucun résultat"}
            </div>
          ) : (
            <ul>
              {filtered.map((s) => {
                const isSelected = s.id === value;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(s.id); setOpen(false); setQuery(""); }}
                      className={`w-full text-left px-4 py-2.5 transition-colors ${
                        isSelected
                          ? "bg-[#E63946]/15 text-white"
                          : "text-[#E0E0E0] hover:bg-white/5"
                      }`}
                    >
                      <div className="text-[13px] font-medium">{s.name}</div>
                      {s.city && (
                        <div className="text-[11px] text-[#6b7280] mt-0.5">{s.city}</div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
