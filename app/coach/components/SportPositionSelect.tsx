"use client";

import { useEffect, useRef } from "react";
import { POSITIONS } from "../../../lib/sports-data";
import NxSelect from "./NxSelect";

/* ─────────────────────────────────────────────────────────────────
   SportPositionSelect — dynamic position dropdown per sport.
   Uses NxSelect for a fully styled dark dropdown.
   Falls back to text input for unknown / "Autre" sports.
───────────────────────────────────────────────────────────────── */

interface SportPositionSelectProps {
  sport: string;
  value: string;
  onChange: (abbr: string) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}

const labelCls = "block text-[11px] font-bold tracking-[1.2px] uppercase text-[#6b7280] mb-1.5";

const inputCls = `
  w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3.5 py-2.5
  text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56]
  focus:border-[#E63946] outline-none transition-colors
`;

export default function SportPositionSelect({
  sport,
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  hasError = false,
}: SportPositionSelectProps) {
  const prevSportRef = useRef(sport);

  // Reset position when sport changes
  useEffect(() => {
    if (prevSportRef.current !== sport) {
      const newPositions = POSITIONS[sport];
      if (!newPositions || !newPositions.some((p) => p.abbr === value)) {
        onChange("");
      }
      prevSportRef.current = sport;
    }
  }, [sport, value, onChange]);

  const noSport = !sport;
  const isCustomSport = sport === "Autre" || (sport && !POSITIONS[sport]);
  const positions = POSITIONS[sport] || [];

  // Build NxSelect options with group support
  const options = positions.map((p) => ({
    value: p.abbr,
    label: `${p.abbr} — ${p.label}`,
    group: p.group,
  }));

  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-[#E63946] ml-0.5">*</span>}
      </label>

      {isCustomSport ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Entrez la position…"
          disabled={disabled}
          className={`${inputCls} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${hasError ? "!border-[#E63946]/60" : ""}`}
        />
      ) : positions.length === 0 && !noSport ? (
        <p className="text-[12px] text-[#6b7280] py-2.5">Aucune position pour ce sport</p>
      ) : (
        <NxSelect
          value={value}
          onChange={onChange}
          options={options}
          disabled={disabled || noSport}
          hasError={hasError}
          aria-label={label}
          placeholder={noSport ? "Sélectionnez un sport d'abord" : "Sélectionner"}
        />
      )}
    </div>
  );
}
