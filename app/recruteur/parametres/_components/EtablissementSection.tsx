"use client";

import type { RecruiterSettings } from "@/lib/types/models";
import { RSEQ_SPORTS } from "@/lib/config/recruiterReferenceData";
import { POSITIONS } from "@/lib/sports-data";
import SchoolSelect from "@/components/ui/SchoolSelect";

/* ─────────────────────────────────────────────────────────────────
   EtablissementSection — CÉGEP, sports, divisions
───────────────────────────────────────────────────────────────── */

const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

interface Props {
  form: RecruiterSettings;
  original: RecruiterSettings;
  onUpdate: <K extends keyof RecruiterSettings>(key: K, value: RecruiterSettings[K]) => void;
  onSave: () => void;
  onCegepChange: (newId: string) => void;
  schools?: { id: string; name: string }[];
}

export default function EtablissementSection({ form, original, onUpdate, onSave, onCegepChange, schools = [] }: Props) {
  const dirty = form.cegepId !== original.cegepId || form.roleTitle !== original.roleTitle ||
    JSON.stringify(form.sportIds) !== JSON.stringify(original.sportIds) ||
    JSON.stringify(form.divisions) !== JSON.stringify(original.divisions) ||
    JSON.stringify(form.programIds) !== JSON.stringify(original.programIds);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">Mon établissement</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Affiliation institutionnelle. Ces données définissent votre contexte dans Nexus.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* CÉGEP */}
        <div>
          <label className={labelCls}>CÉGEP / École</label>
          <SchoolSelect
            value={form.cegepId || null}
            onChange={(id) => { if (id !== form.cegepId) onCegepChange(id); }}
            filterType="CEGEP"
            placeholder="Rechercher un CÉGEP..."
          />
        </div>

        {/* Role */}
        <div>
          <label className={labelCls}>Rôle / Titre</label>
          <input type="text" value={form.roleTitle} maxLength={80}
            placeholder="Entraîneur-chef, Coordonnateur sportif..."
            onChange={(e) => onUpdate("roleTitle", e.target.value)} className={inputCls} />
        </div>

        {/* Sports */}
        <div>
          <label className={labelCls}>Sport(s) recruté(s) <span className="text-[#E63946]">*</span></label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.sportIds.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E63946]/15 text-[#E63946] text-[13px] font-bold border border-[#E63946]/25">
                {s}
                <button type="button" onClick={() => {
                  const next = form.sportIds.filter((x) => x !== s);
                  onUpdate("sportIds", next);
                  onUpdate("targetPositions", form.targetPositions.filter((p) => {
                    const remaining = next.flatMap((sp) => (POSITIONS[sp] || []).map((pp) => pp.abbr));
                    return remaining.includes(p);
                  }));
                }} className="hover:text-white transition-colors ml-0.5">&times;</button>
              </span>
            ))}
          </div>
          <select aria-label="Ajouter un sport" value=""
            onChange={(e) => { if (e.target.value && !form.sportIds.includes(e.target.value)) onUpdate("sportIds", [...form.sportIds, e.target.value]); }}
            className={inputCls}>
            <option value="">Ajouter un sport...</option>
            {RSEQ_SPORTS.filter((s) => !form.sportIds.includes(s)).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {form.sportIds.length === 0 && (
            <p className="text-[12px] text-[#E63946] mt-1">Sélectionnez au moins un sport.</p>
          )}
          <div className="mt-3 bg-[#E63946]/[0.06] border-l-[3px] border-[#E63946] rounded-r-lg px-4 py-3">
            <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
              Les sports sélectionnés déterminent les alertes de nouveaux athlètes et le pré-filtrage de votre recherche.
            </p>
          </div>
        </div>

        {/* Divisions */}
        <div>
          <label className={labelCls}>Division(s) <span className="text-[#E63946]">*</span></label>
          <div className="flex items-center gap-4 mt-1">
            {(["D1", "D2", "D3"] as const).map((d) => {
              const checked = form.divisions.includes(d);
              return (
                <label key={d} className="flex items-center gap-2 cursor-pointer group">
                  <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-colors ${checked ? "bg-[#E63946] border-[#E63946]" : "border-[#2a2d36] bg-[#13151a] group-hover:border-[#6B7280]"}`}>
                    {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </span>
                  <span className="text-[14px] text-[#e0e0e0]">{d === "D1" ? "Division 1" : d === "D2" ? "Division 2" : "Division 3"}</span>
                </label>
              );
            })}
          </div>
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
