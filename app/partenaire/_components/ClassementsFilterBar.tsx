"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   ClassementsFilterBar — client-side filter dropdowns that
   write to URL params. The /partenaire/classements page reads
   the URL and re-queries top_athletes_view server-side.

   Position dropdown filters its own options by the selected
   sport (positions are pre-fetched server-side and passed
   in via the positionsBySport prop).
═══════════════════════════════════════════════════════════════ */

interface SportOption { id: string; nom: string }
interface PositionOption { id: string; nom: string; abreviation: string | null; sport_id: string }

interface ClassementsFilterBarProps {
  sports: SportOption[];
  positions: PositionOption[];
  regions: string[];
  graduationYears: number[];
}

export default function ClassementsFilterBar({
  sports,
  positions,
  regions,
  graduationYears,
}: ClassementsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSport = searchParams.get("sport") || "";
  const currentPosition = searchParams.get("position") || "";
  const currentRegion = searchParams.get("region") || "";
  const currentYear = searchParams.get("year") || "";

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
    router.push(qs ? `/partenaire/classements?${qs}` : "/partenaire/classements");
  }

  function reset() {
    router.push("/partenaire/classements");
  }

  const hasFilters = currentSport || currentPosition || currentRegion || currentYear;
  const selectCls = "bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] focus:border-[#E63946] outline-none transition-colors min-w-[140px]";
  const activeCls = "border-[#E63946]/40 bg-[#E63946]/5";

  return (
    <div className="flex flex-wrap items-center gap-2 bg-[#1A1D24] border border-[#2D3748] rounded-xl p-3 sticky top-0 z-20">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280] ml-1 mr-1">Filtres</span>

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

      <select
        value={currentRegion}
        onChange={(e) => pushFilter({ region: e.target.value || null })}
        className={`${selectCls} ${currentRegion ? activeCls : ""}`}
        aria-label="Région"
      >
        <option value="">Toutes les régions</option>
        {regions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>

      <select
        value={currentYear}
        onChange={(e) => pushFilter({ year: e.target.value || null })}
        className={`${selectCls} ${currentYear ? activeCls : ""}`}
        aria-label="Promotion"
      >
        <option value="">Toutes les promotions</option>
        {graduationYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="text-[12px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors ml-1 px-2"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
