"use client";

/* TeamHistoryEditor — controlled add/remove/edit editor for the athlete's
   "Parcours d'équipes". Copies the immutable-array pattern from
   DistinctionsSuggest (app/athlete/profil/page.tsx). Persistence is the
   parent's job (athlete = direct write; coach modifier = wizard save) —
   this component only owns the row UI + client validation + the cap. */

import type { TeamHistoryEntry } from "@/lib/types/models";
import { MAX_TEAM_HISTORY, isCurrentEntry, validateEntry } from "./teamHistory";

const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded px-2.5 py-1.5 text-[13px] text-white placeholder-[#4a4d56] focus:border-[#E63946] outline-none";
const labelCls = "block text-[10px] font-bold tracking-wider uppercase text-[#6b7280] mb-1";

function blankEntry(): TeamHistoryEntry {
  return { team_name: "", sport: "", ligue: "", division: "", year_start: new Date().getFullYear(), year_end: null };
}

export default function TeamHistoryEditor({
  value,
  onChange,
  sports,
  maxYear,
}: {
  value: TeamHistoryEntry[];
  onChange: (entries: TeamHistoryEntry[]) => void;
  sports: { id: string; nom: string }[];
  maxYear?: number;
}) {
  const entries = Array.isArray(value) ? value : [];
  const yMax = maxYear ?? new Date().getFullYear() + 1;
  const atMax = entries.length >= MAX_TEAM_HISTORY;

  const patch = (i: number, next: Partial<TeamHistoryEntry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...next } : e)));
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const add = () => { if (!atMax) onChange([...entries, blankEntry()]); };
  const toggleCurrent = (i: number, checked: boolean) =>
    patch(i, { year_end: checked ? null : entries[i].year_start || new Date().getFullYear() });

  return (
    <div className="space-y-3">
      {entries.map((e, i) => {
        const err = validateEntry(e, yMax);
        const cur = isCurrentEntry(e);
        return (
          <div key={i} className="rounded-lg border border-[#2a2d36] bg-[#1A1D24]/60 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <label className={labelCls}>Nom de l&apos;équipe *</label>
                <input
                  value={e.team_name}
                  onChange={(ev) => patch(i, { team_name: ev.target.value })}
                  placeholder="Ex: Titans du Cégep"
                  className={inputCls}
                />
                {err.team_name && <p className="text-[11px] text-[#EF4444] mt-1">{err.team_name}</p>}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                title="Retirer"
                className="shrink-0 mt-5 text-[#6b7280] hover:text-[#E63946] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Sport</label>
                <select value={e.sport} onChange={(ev) => patch(i, { sport: ev.target.value })} className={inputCls}>
                  <option value="">—</option>
                  {sports.map((s) => (
                    <option key={s.id} value={s.nom}>{s.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ligue</label>
                <input value={e.ligue} onChange={(ev) => patch(i, { ligue: ev.target.value })} placeholder="Ex: RSEQ" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Division</label>
                <input value={e.division} onChange={(ev) => patch(i, { division: ev.target.value })} placeholder="Ex: D1" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Année de début</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={e.year_start || ""}
                  onChange={(ev) => patch(i, { year_start: Number(ev.target.value) })}
                  placeholder="2022"
                  className={inputCls}
                />
                {err.year_start && <p className="text-[11px] text-[#EF4444] mt-1">{err.year_start}</p>}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={cur} onChange={(ev) => toggleCurrent(i, ev.target.checked)} className="accent-[#E63946] w-4 h-4" />
                <span className="text-[12px] text-[#9CA3AF]">Équipe actuelle</span>
              </label>
              {!cur && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-[#6b7280]">Fin</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={e.year_end ?? ""}
                    onChange={(ev) => patch(i, { year_end: ev.target.value === "" ? null : Number(ev.target.value) })}
                    placeholder="2024"
                    className="w-24 bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1 text-[13px] text-white focus:border-[#E63946] outline-none"
                  />
                </div>
              )}
            </div>
            {err.year_end && <p className="text-[11px] text-[#EF4444] mt-1">{err.year_end}</p>}
          </div>
        );
      })}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          disabled={atMax}
          className="flex items-center gap-1.5 text-[12px] font-bold text-[#E63946] hover:text-[#ff4d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-[15px] leading-none">+</span> Ajouter une équipe
        </button>
        <span className="text-[11px] text-[#6b7280]">{entries.length} / {MAX_TEAM_HISTORY}</span>
      </div>
    </div>
  );
}
