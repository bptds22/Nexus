"use client";

import { useState } from "react";
import type { RecruiterSettings } from "@/lib/types/models";
import { QC_REGIONS } from "@/lib/config/recruiterReferenceData";
import { POSITIONS } from "@/lib/sports-data";
import RangeSliderInput from "./RangeSliderInput";
import SettingsToggle from "./SettingsToggle";

/* ─────────────────────────────────────────────────────────────────
   RecrutementSection — Recruitment preferences
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdate: <K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) => void;
  onSave: () => void;
}

export default function RecrutementSection({ form, original, onUpdate, onSave }: Props) {
  const [showTip, setShowTip] = useState(() => {
    if (typeof window !== "undefined") return !localStorage.getItem("nx-recruit-tip-dismissed");
    return true;
  });

  const dirty = JSON.stringify(form.targetRegions) !== JSON.stringify(original.targetRegions) ||
    JSON.stringify(form.targetGradYears) !== JSON.stringify(original.targetGradYears) ||
    JSON.stringify(form.targetPositions) !== JSON.stringify(original.targetPositions) ||
    form.minMoyenne !== original.minMoyenne || form.minCoteGlobale !== original.minCoteGlobale ||
    form.alertNewProfiles !== original.alertNewProfiles;

  function getAvailablePositions(): { abbr: string; label: string }[] {
    const positions: { abbr: string; label: string }[] = [];
    for (const sport of form.sportIds) {
      const sportPositions = POSITIONS[sport];
      if (sportPositions) {
        for (const p of sportPositions) {
          if (!positions.find((x) => x.abbr === p.abbr)) {
            positions.push({ abbr: p.abbr, label: p.label });
          }
        }
      }
    }
    return positions;
  }

  function getAlertSummary(): string {
    const sports = form.sportIds.join(", ") || "—";
    const positions = form.targetPositions.length > 0 ? `(${form.targetPositions.join(", ")})` : "";
    const regions = form.targetRegions.length === QC_REGIONS.length
      ? "Toutes les régions"
      : form.targetRegions.length > 0 ? form.targetRegions.join(", ") : "—";
    const years = form.targetGradYears.length > 0
      ? `Promotion ${form.targetGradYears.sort().join(", ")}` : "—";
    return `Vous serez alerté pour : ${sports} ${positions} — ${regions} — ${years}`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Préférences de recrutement</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Configurez vos critères pour recevoir automatiquement les profils qui vous intéressent.</p>
      </div>

      {/* Tip banner */}
      {showTip && (
        <div className="bg-[#F59E0B]/[0.08] border-l-[3px] border-[#F59E0B] rounded-r-lg px-4 py-3 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
            <path d="M9 21h6" stroke="#F5C518" strokeWidth="2" strokeLinecap="round" />
            <path d="M12 2a6 6 0 014 10.5V17a1 1 0 01-1 1h-6a1 1 0 01-1-1v-4.5A6 6 0 0112 2z" fill="#F5C518" fillOpacity="0.15" stroke="#F5C518" strokeWidth="1.6" />
          </svg>
          <div className="flex-1">
            <p className="text-[13px] text-[#e0e0e0] leading-relaxed">
              Ces préférences pré-remplissent vos filtres de recherche ET déclenchent des alertes quand un nouvel athlète matching vos critères est ajouté.
            </p>
            <button type="button" onClick={() => { setShowTip(false); localStorage.setItem("nx-recruit-tip-dismissed", "1"); }}
              className="text-[12px] font-bold text-[#F59E0B] mt-2 hover:text-[#FBBF24] transition-colors uppercase tracking-wider">
              Compris
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6 max-w-2xl">
        {/* Regions */}
        <div>
          <label className={labelCls}>Régions ciblées</label>
          {form.targetRegions.length === QC_REGIONS.length ? (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[13px] font-bold border border-[#E63946]/25">
                Toutes les régions
                <button type="button" onClick={() => onUpdate("targetRegions", QC_REGIONS.slice(0, -1))} className="hover:text-white transition-colors ml-0.5">&times;</button>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {form.targetRegions.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[13px] font-bold border border-[#E63946]/25">
                  {r}
                  <button type="button" onClick={() => onUpdate("targetRegions", form.targetRegions.filter((x) => x !== r))} className="hover:text-white transition-colors ml-0.5">&times;</button>
                </span>
              ))}
            </div>
          )}
          <select aria-label="Ajouter une région" value=""
            onChange={(e) => {
              if (e.target.value === "__all") onUpdate("targetRegions", [...QC_REGIONS]);
              else if (e.target.value && !form.targetRegions.includes(e.target.value)) onUpdate("targetRegions", [...form.targetRegions, e.target.value]);
            }}
            className={`${inputCls} mt-2`}>
            <option value="">Ajouter une région...</option>
            <option value="__all">— Toutes les régions —</option>
            {QC_REGIONS.filter((r) => !form.targetRegions.includes(r)).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Grad years */}
        <div>
          <label className={labelCls}>Année(s) de diplomation</label>
          <div className="flex items-center gap-4 mt-1">
            {[2026, 2027, 2028, 2029].map((y) => {
              const checked = form.targetGradYears.includes(y);
              return (
                <label key={y} className="flex items-center gap-2 cursor-pointer group">
                  <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6B7280]"}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <span className="text-[14px] text-[#e0e0e0]">{y}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Positions */}
        <div>
          <label className={labelCls}>Positions recherchées</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.targetPositions.map((abbr) => {
              const pos = getAvailablePositions().find((p) => p.abbr === abbr);
              return (
                <span key={abbr} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[13px] font-bold border border-[#E63946]/25">
                  {abbr}{pos ? ` — ${pos.label}` : ""}
                  <button type="button" onClick={() => onUpdate("targetPositions", form.targetPositions.filter((x) => x !== abbr))} className="hover:text-white transition-colors ml-0.5">&times;</button>
                </span>
              );
            })}
          </div>
          {getAvailablePositions().length > 0 ? (
            <select aria-label="Ajouter une position" value=""
              onChange={(e) => { if (e.target.value && !form.targetPositions.includes(e.target.value)) onUpdate("targetPositions", [...form.targetPositions, e.target.value]); }}
              className={inputCls}>
              <option value="">Ajouter une position...</option>
              {form.sportIds.map(sport => {
                const sportPositions = (POSITIONS[sport] || []).filter((p: { abbr: string }) => !form.targetPositions.includes(p.abbr));
                if (sportPositions.length === 0) return null;
                return (
                  <optgroup key={sport} label={`── ${sport} ──`}>
                    {sportPositions.map((p: { abbr: string; label: string }) => (
                      <option key={`${sport}-${p.abbr}`} value={p.abbr}>{p.abbr} — {p.label}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          ) : (
            <p className="text-[12px] text-[#4a4d56]">Sélectionnez un sport dans la section Établissement pour voir les positions.</p>
          )}
        </div>

        {/* Moyenne générale min */}
        <RangeSliderInput
          value={form.minMoyenne}
          onChange={(v) => onUpdate("minMoyenne", v)}
          min={60} max={100} step={1}
          label="Moyenne générale minimum"
        />

        {/* Cote globale min */}
        <RangeSliderInput
          value={form.minCoteGlobale}
          onChange={(v) => onUpdate("minCoteGlobale", v)}
          min={1} max={5} step={0.1}
          label="⭐ Cote globale minimum"
          sublabel="Moyenne des critères d'évaluation coach (étoiles)"
        />

        {/* Alert toggle */}
        <div className="border-t border-[#1e2128] pt-4">
          <SettingsToggle
            checked={form.alertNewProfiles}
            onChange={(v) => onUpdate("alertNewProfiles", v)}
            label="Recevoir une alerte quand un nouvel athlète matche mes critères"
          />
          {form.alertNewProfiles && (
            <p className="text-[12px] text-[#6B7280] mt-2 leading-relaxed pl-1">
              {getAlertSummary()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={onSave} disabled={!dirty}
          className={`px-6 py-2.5 rounded-lg font-head font-bold text-[14px] uppercase tracking-widest transition-all ${
            dirty ? "bg-[#E63946] text-white hover:bg-[#D42B22] cursor-pointer" : "bg-[#333] text-[#6B7280] cursor-not-allowed"
          }`}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
