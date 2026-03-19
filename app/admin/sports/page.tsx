"use client";

import { useState } from "react";
import { ADMIN_SPORTS } from "@/lib/mock/admin";

export default function AdminSportsPage() {
  const [toast, setToast] = useState<string | null>(null);
  function showToast() { setToast("Action simulée — POC"); setTimeout(() => setToast(null), 3000); }

  const totalAthletes = ADMIN_SPORTS.reduce((sum, s) => sum + s.athletes_count, 0);
  const activeSports = ADMIN_SPORTS.filter((s) => s.is_active).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Gestion des sports</h1>
          <p className="text-[13px] text-[#6b7280] mt-1">{activeSports} sports actifs · {totalAthletes} athlètes inscrits</p>
        </div>
        <button type="button" onClick={showToast} className="shrink-0 px-5 py-2.5 rounded-lg border border-[#E63946] text-[#E63946] font-bold text-[13px] uppercase tracking-wider hover:bg-[#E63946]/10 transition-colors">
          + Ajouter un sport
        </button>
      </div>

      {/* Sport cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {ADMIN_SPORTS.map((sport) => (
          <div key={sport.id} className="bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 flex flex-col">
            {/* Top */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <span className="text-[32px]">{sport.icon}</span>
                <h3 className="font-head text-xl font-black text-white">{sport.name}</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${sport.is_active ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#6b7280]/15 text-[#6b7280]"}`}>
                {sport.is_active ? "Actif" : "Inactif"}
              </span>
            </div>
            <p className="text-[13px] text-[#6b7280] mb-4">{sport.athletes_count} athlètes inscrits</p>

            <div className="border-t border-[#2D3748]/50 pt-4 space-y-4 flex-1">
              {/* Positions */}
              <div>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Positions</p>
                <div className="flex flex-wrap gap-1.5">
                  {sport.positions.map((pos) => (
                    <span key={pos} className="px-2.5 py-1 rounded-full bg-[#2D3748] text-[11px] font-bold text-[#9CA3AF]">{pos}</span>
                  ))}
                </div>
              </div>

              {/* Stat fields */}
              <div>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Champs de stats</p>
                <div className="flex flex-wrap gap-1.5">
                  {sport.stat_fields.map((field) => (
                    <span key={field} className="text-[12px] text-[#9CA3AF]">{field}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom action */}
            <button type="button" onClick={showToast} className="mt-4 w-full py-2.5 rounded-lg border border-[#2D3748] text-[12px] font-bold text-[#9CA3AF] uppercase tracking-wider hover:text-white hover:border-[#E63946]/40 transition-colors">
              Modifier
            </button>
          </div>
        ))}
      </div>

      {toast && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">{toast}</div>}
    </div>
  );
}
