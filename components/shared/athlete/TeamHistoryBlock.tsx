/* TeamHistoryBlock — LinkedIn-style read-only display of an athlete's
   "Parcours d'équipes". Self-hides when empty (recruiter/coach view); pass
   showEmptyCta to render an "Ajouter un parcours" prompt (athlete's own view).
   Shared across web + mobile — self-contained styling (no parent constants). */

import type { TeamHistoryEntry } from "@/lib/types/models";
import { sortTeamHistory, isCurrentEntry } from "./teamHistory";

function yearRange(e: TeamHistoryEntry): string {
  const start = e.year_start ? String(e.year_start) : "";
  if (isCurrentEntry(e)) return start ? `${start} — Actif` : "Actif";
  return start ? `${start} — ${e.year_end}` : String(e.year_end ?? "");
}

function metaLine(e: TeamHistoryEntry): string {
  return [e.sport, e.ligue, e.division].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
}

export default function TeamHistoryBlock({
  entries,
  showEmptyCta = false,
  onAddClick,
  headingClassName,
}: {
  entries: TeamHistoryEntry[] | null | undefined;
  showEmptyCta?: boolean;
  onAddClick?: () => void;
  headingClassName?: string;
}) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0 && !showEmptyCta) return null;
  const sorted = sortTeamHistory(list);
  const heading = headingClassName ?? "text-[13px] font-head font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-3";

  return (
    <section className="nx-slide-section">
      <h2 className={heading}>Parcours d&apos;équipes</h2>

      {list.length === 0 ? (
        <button
          type="button"
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2D3748] bg-[#1A1D24]/40 px-4 py-6 text-[13px] font-semibold text-[#9CA3AF] hover:border-[#E63946]/40 hover:text-white transition-colors"
        >
          <span className="text-[16px] leading-none">+</span> Ajouter un parcours
        </button>
      ) : (
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl divide-y divide-[#2D3748]/50">
          {sorted.map((e, i) => {
            const letter = ((e.team_name || "?").trim().charAt(0) || "?").toUpperCase();
            const cur = isCurrentEntry(e);
            const meta = metaLine(e);
            return (
              <div key={i} className="flex items-start gap-3.5 p-4">
                {/* Letter-avatar — red ring when current */}
                <div
                  className={`shrink-0 w-11 h-11 rounded-full bg-[#111317] border-2 flex items-center justify-center ${cur ? "border-[#E63946]" : "border-[#2D3748]"}`}
                >
                  <span className="text-[16px] font-head font-bold text-white leading-none">{letter}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold text-white break-words">{e.team_name || "—"}</span>
                    {cur && (
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30">
                        Actif
                      </span>
                    )}
                  </div>
                  {meta && <p className="text-[13px] text-[#6B7280] mt-0.5">{meta}</p>}
                </div>

                <div className="shrink-0 pt-0.5">
                  <span className="text-[12px] font-semibold text-[#9CA3AF] whitespace-nowrap">{yearRange(e)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
