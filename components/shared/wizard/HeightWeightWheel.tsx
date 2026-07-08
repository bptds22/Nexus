"use client";

/* ═══════════════════════════════════════════════════════════════
   HeightWeightWheel — shared taille/poids wheel-picker wiring.

   Extracted VERBATIM from AthleteWizardMobile (the coach mobile
   create/edit wizard), where this lived inline. The inner wheel is
   the reusable MobileWheelPicker ; what's shared here is the
   *wiring* around it : the unit toggle (pi/po ↔ cm, lbs ↔ kg), the
   column generation, and the metric→imperial conversion in onCommit.

   STORAGE IS ALWAYS IMPERIAL. Metric (cm / kg) is a display-only
   input convenience — HeightWheel.onCommit always emits feet+inches
   (strings) and WeightWheel.onCommit always emits lbs (string), so
   consumers never see metric. Callers persist those imperial values
   directly (coach → taille_pieds/taille_pouces/poids_lbs) or format
   them into the canonical suggestion string (athlete → "6'4\"" /
   "185 lbs", the exact shape apply_approved_suggestion parses).
═══════════════════════════════════════════════════════════════ */

import { MobileWheelPicker } from "@/components/mobile/MobileWheelPicker";

export type UnitMode = "imperial" | "metric";

/** Persisted unit preference — shared key across the coach + athlete
 *  wizards so the chosen unit sticks for the user. */
export const UNIT_MODE_STORAGE_KEY = "nx_wizard_unit_mode";

export function UnitToggle<T extends string>({
  mode, onChange, options,
}: {
  mode: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 bg-[#13151a] rounded-2xl p-1 w-fit mx-auto">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
            mode === opt.value ? "bg-[#E63946] text-white" : "text-white/55"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function formatHeightDisplay(ft: string, inches: string, unitMode: UnitMode): string {
  const ftN = parseInt(ft || "0");
  const inN = parseInt(inches || "0");
  if (!ft && !inches) return "";
  if (unitMode === "imperial") {
    if (ft && inches) return `${ftN}'${inN}"`;
    if (ft) return `${ftN}'`;
    return `${inN}"`;
  }
  // metric — display only ; storage stays in pi/po
  const cm = Math.round((ftN * 12 + inN) * 2.54);
  return cm > 0 ? `${cm} cm` : "";
}

export function formatWeightDisplay(lbs: string, unitMode: UnitMode): string {
  const lbsN = parseFloat(lbs || "0");
  if (!lbsN) return "";
  if (unitMode === "imperial") {
    return `${Number.isInteger(lbsN) ? lbsN.toFixed(0) : lbsN.toFixed(1)} lbs`;
  }
  const kg = Math.round(lbsN / 2.20462);
  return `${kg} kg`;
}

/* ── HeightWheel — taille pi/po (2-col) ↔ cm (1-col). onCommit always
      emits imperial (feet, inches) strings. ── */
export function HeightWheel({
  open, onClose, feet, inches, unitMode, onUnitChange, onCommit,
}: {
  open: boolean;
  onClose: () => void;
  feet: string;
  inches: string;
  unitMode: UnitMode;
  onUnitChange: (next: UnitMode) => void;
  onCommit: (feet: string, inches: string) => void;
}) {
  return (
    <MobileWheelPicker
      open={open}
      onClose={onClose}
      title="Taille"
      headerExtra={
        <UnitToggle
          mode={unitMode}
          onChange={onUnitChange}
          options={[{ value: "imperial", label: "pi/po" }, { value: "metric", label: "cm" }]}
        />
      }
      columns={
        unitMode === "imperial"
          ? [
              {
                key: "ft",
                label: "Pieds",
                options: [4, 5, 6, 7].map((v) => ({ value: String(v), label: `${v}'` })),
                value: feet || "5",
              },
              {
                key: "in",
                label: "Pouces",
                options: Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: `${i}"` })),
                value: inches || "10",
              },
            ]
          : [
              {
                key: "cm",
                label: "Centimètres",
                options: Array.from({ length: 106 }, (_, i) => ({
                  value: String(120 + i),
                  label: `${120 + i} cm`,
                })),
                value: (() => {
                  const ft = parseInt(feet || "0");
                  const inch = parseInt(inches || "0");
                  if (!ft && !inch) return "175";
                  return String(Math.round((ft * 12 + inch) * 2.54));
                })(),
              },
            ]
      }
      onCommit={(values) => {
        if (unitMode === "imperial") {
          const [ft, inch] = values as [string, string];
          onCommit(ft || "", inch || "");
        } else {
          // cm → ft + in
          const cm = parseInt(String(values[0] ?? "0"));
          if (!cm) { onCommit("", ""); return; }
          const totalIn = Math.round(cm / 2.54);
          const ft = Math.floor(totalIn / 12);
          const inch = totalIn % 12;
          onCommit(String(ft), String(inch));
        }
      }}
    />
  );
}

/* ── WeightWheel — poids lbs (1-col) ↔ kg (1-col). onCommit always
      emits an imperial lbs string. ── */
export function WeightWheel({
  open, onClose, lbs, unitMode, onUnitChange, onCommit,
}: {
  open: boolean;
  onClose: () => void;
  lbs: string;
  unitMode: UnitMode;
  onUnitChange: (next: UnitMode) => void;
  onCommit: (lbs: string) => void;
}) {
  return (
    <MobileWheelPicker
      open={open}
      onClose={onClose}
      title="Poids"
      headerExtra={
        <UnitToggle
          mode={unitMode}
          onChange={onUnitChange}
          options={[{ value: "imperial", label: "lbs" }, { value: "metric", label: "kg" }]}
        />
      }
      columns={
        unitMode === "imperial"
          ? [
              {
                key: "lbs",
                label: "Livres",
                options: Array.from({ length: 271 }, (_, i) => ({
                  value: String(80 + i),
                  label: `${80 + i} lbs`,
                })),
                value: (() => {
                  const v = parseFloat(lbs || "0");
                  return v > 0 ? String(Math.round(v)) : "180";
                })(),
              },
            ]
          : [
              {
                key: "kg",
                label: "Kilogrammes",
                options: Array.from({ length: 141 }, (_, i) => ({
                  value: String(40 + i),
                  label: `${40 + i} kg`,
                })),
                value: (() => {
                  const v = parseFloat(lbs || "0");
                  if (!v) return "82";
                  return String(Math.round(v / 2.20462));
                })(),
              },
            ]
      }
      onCommit={(values) => {
        if (unitMode === "imperial") {
          onCommit(String(values[0] ?? ""));
        } else {
          const kg = parseFloat(String(values[0] ?? "0"));
          if (!kg) { onCommit(""); return; }
          const out = Math.round(kg * 2.20462 * 10) / 10;
          onCommit(String(out));
        }
      }}
    />
  );
}
