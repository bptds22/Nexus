"use client";

/* ─────────────────────────────────────────────────────────────────
   RangeSliderInput — slider + synchronized numeric input
───────────────────────────────────────────────────────────────── */

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min: number;
  max: number;
  step: number;
  label: string;
  sublabel?: string;
}

export default function RangeSliderInput({ value, onChange, min, max, step, label, sublabel }: Props) {
  const hasValue = value !== undefined;
  const displayValue = hasValue ? value : min;
  const pct = ((displayValue - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280]">{label}</p>
          {sublabel && <p className="text-[12px] text-[#4a4d56] mt-0.5">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={hasValue ? value : ""}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v >= min && v <= max) onChange(v);
              else if (e.target.value === "") onChange(undefined);
            }}
            placeholder="—"
            className="w-[72px] bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-1.5 text-[14px] text-[#e0e0e0] text-center focus:border-[#E63946] outline-none"
          />
          {hasValue && (
            <button type="button" onClick={() => onChange(undefined)}
              className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] hover:text-[#E63946] transition-colors">
              ×
            </button>
          )}
        </div>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-[4px] rounded-full bg-[#2D3748]" />
        <div className="absolute left-0 h-[4px] rounded-full bg-[#E63946]" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-x-0 w-full h-6 opacity-0 cursor-pointer"
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-[#E63946] shadow pointer-events-none"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#4a4d56]">{min}</span>
        <span className="text-[10px] text-[#4a4d56]">{max}</span>
      </div>
    </div>
  );
}
