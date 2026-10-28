"use client";

import { OPTIONS_FILTRE_TYPE_ETABLISSEMENT } from "@/lib/config/schoolTypes";

/** Menu « Type d'établissement » commun aux listes admin (lot D-admin cégep).
 *  Même habillage que les FilterSelect de /admin/athletes : rouge quand actif. */
export default function FiltreTypeEtablissement({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value !== "";
  return (
    <select
      title="Type d'établissement"
      aria-label="Type d'établissement"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[#1A1D24] border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none transition-colors ${active ? "border-[#E63946]/50 text-[#E63946] font-bold" : "border-white/10 text-white hover:border-white/20"}`}
    >
      {OPTIONS_FILTRE_TYPE_ETABLISSEMENT.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#1A1D24] text-white">{o.label}</option>
      ))}
    </select>
  );
}
