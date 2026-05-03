"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   TendancesDropdownFilters — sport + position dropdowns that
   write to URL params on /partenaire/tendances. Mirrors
   NewsroomDropdownFilters (same cascading sport→position UX,
   same disabled-with-placeholder treatment, same Tailwind
   classes) — just routes back to /partenaire/tendances on
   change.

   Position dropdown filters its own options by selected sport
   (positions are pre-fetched server-side and passed in).
═══════════════════════════════════════════════════════════════ */

interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string }

interface TendancesDropdownFiltersProps {
  sports: SportOption[];
  positions: PositionOption[];
}

export default function TendancesDropdownFilters({ sports, positions }: TendancesDropdownFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";

  const positionsForSport = useMemo(
    () => (currentSport ? positions.filter((p) => p.sport_id === currentSport) : []),
    [currentSport, positions],
  );

  function pushFilter(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `/partenaire/tendances?${qs}` : "/partenaire/tendances");
  }

  const selectCls = "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed";
  const activeCls = "border-[#E63946]/40 bg-[#E63946]/5";

  const hasFilters = currentSport || currentPosition;

  return (
    <>
      <select
        value={currentSport}
        onChange={(e) => pushFilter({ sport: e.target.value || null, position: null })}
        className={`${selectCls} ${currentSport ? activeCls : ""}`}
        aria-label="Sport"
      >
        <option value="">Tous les sports</option>
        {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
      </select>

      <select
        value={currentPosition}
        onChange={(e) => pushFilter({ position: e.target.value || null })}
        className={`${selectCls} ${currentPosition ? activeCls : ""}`}
        disabled={!currentSport}
        aria-label="Position"
      >
        <option value="">{currentSport ? "Toutes les positions" : "Sélectionner un sport d'abord"}</option>
        {positionsForSport.map((p) => (
          <option key={p.id} value={p.id}>
            {p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push("/partenaire/tendances")}
          className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors px-2"
        >
          Réinitialiser
        </button>
      )}
    </>
  );
}
