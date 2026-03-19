"use client";

import { useState } from "react";
import type { SchoolInfo } from "../_data/mockSettingsData";

/* ─────────────────────────────────────────────────────────────────
   SchoolSection — School & program info
───────────────────────────────────────────────────────────────── */

const label = "text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280] mb-1.5";
const input = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const readOnly = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] opacity-60 cursor-not-allowed";

interface Props {
  data: SchoolInfo;
}

export default function SchoolSection({ data }: Props) {
  const [form, setForm] = useState({ ...data });
  const [saved, setSaved] = useState(false);

  function update(field: keyof SchoolInfo, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">École & programme</h2>
        <p className="text-[14px] text-[#6b7280] mt-1">Informations sur ton école et ton programme sportif.</p>
      </div>

      <div className="space-y-5 max-w-2xl">
        {/* School info - read only (managed by director) */}
        <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#6b7280]">
              Géré par le directeur
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className={label}>Nom de l&apos;école</p>
              <input type="text" value={form.name} readOnly className={readOnly} />
            </div>
            <div>
              <p className={label}>Ville</p>
              <input type="text" value={form.city} readOnly className={readOnly} />
            </div>
            <div>
              <p className={label}>Région</p>
              <input type="text" value={form.region} readOnly className={readOnly} />
            </div>
            <div>
              <p className={label}>Conférence</p>
              <input type="text" value={form.conference} readOnly className={readOnly} />
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className={label}>Division</p>
            <input type="text" value={form.division} onChange={(e) => update("division", e.target.value)} className={input} />
          </div>
          <div>
            <p className={label}>Catégorie d&apos;âge</p>
            <input type="text" value={form.ageGroup} onChange={(e) => update("ageGroup", e.target.value)} className={input} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className={label}>Nom de l&apos;équipe</p>
            <input type="text" value={form.teamName} onChange={(e) => update("teamName", e.target.value)} className={input} />
          </div>
          <div>
            <p className={label}>Site web</p>
            <input type="url" value={form.website} onChange={(e) => update("website", e.target.value)} className={input} placeholder="https://..." />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="bg-[#E63946] hover:bg-[#D42B22] text-white text-[14px] font-bold px-6 py-2.5 rounded-lg transition-colors"
          >
            Enregistrer
          </button>
          {saved && (
            <span className="text-[14px] font-semibold text-[#22C55E] animate-pulse">
              Modifications enregistrées
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
