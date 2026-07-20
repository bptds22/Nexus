/* TeamHistoryBlock — athlete "Parcours d'équipes". Shared across web + mobile,
   self-contained styling (no parent constants).

   Option B layout:
     • "JOUE ACTUELLEMENT" banner (red-tint gradient) holding the athlete's
       real Nexus affiliation (the `anchor`) first, then declared current
       entries (year_end null), as cards in a responsive flex-wrap row.
     • "HISTORIQUE" block below — declared past entries (year_end set), quiet
       greyscale rows at 60% opacity, sorted year_end desc.

   GUARD: `anchor` is DERIVED from the athlete's real profile data and is
   DISPLAY-ONLY. It is a separate prop — it never enters the `entries` array,
   so the TeamHistoryEditor (which only ever receives `entries`) cannot edit or
   delete it. Do not fold the anchor into entries anywhere. */

import type { TeamHistoryEntry } from "@/lib/types/models";
import { sortTeamHistory, isCurrentEntry } from "./teamHistory";

/** The athlete's real Nexus affiliation — display-only anchor card. */
export interface TeamHistoryAnchor {
  /** School name, or club/team name for civil athletes. */
  teamName: string;
  sport?: string;
  position?: string;
  region?: string;
  /** Pill/tag label — defaults to "NEXUS". */
  label?: string;
}

/** Declared current entry sub-line: "Sport · Ligue · Division · depuis {an}". */
function currentMeta(e: TeamHistoryEntry): string {
  const parts = [e.sport, e.ligue, e.division].map((s) => (s ?? "").trim()).filter(Boolean);
  if (e.year_start) parts.push(`depuis ${e.year_start}`);
  return parts.join(" · ");
}

function pastMeta(e: TeamHistoryEntry): string {
  return [e.sport, e.ligue, e.division].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
}

function pastYears(e: TeamHistoryEntry): string {
  const start = e.year_start ? String(e.year_start) : "";
  return start ? `${start} — ${e.year_end}` : String(e.year_end ?? "");
}

function anchorMeta(a: TeamHistoryAnchor): string {
  return [a.sport, a.position, a.region].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
}

export default function TeamHistoryBlock({
  entries,
  anchor,
  showEmptyCta = false,
  onAddClick,
  headingClassName,
}: {
  entries: TeamHistoryEntry[] | null | undefined;
  /** Display-only real-team anchor (NOT an editable history entry). */
  anchor?: TeamHistoryAnchor | null;
  showEmptyCta?: boolean;
  onAddClick?: () => void;
  headingClassName?: string;
}) {
  const list = Array.isArray(entries) ? entries : [];
  const hasAnchor = !!(anchor && anchor.teamName && anchor.teamName.trim());

  // Nothing to show and no prompt requested → self-hide (recruiter/coach view).
  if (list.length === 0 && !hasAnchor && !showEmptyCta) return null;

  const current = sortTeamHistory(list).filter(isCurrentEntry);
  const past = list
    .filter((e) => !isCurrentEntry(e))
    .sort((a, b) => (b.year_end || 0) - (a.year_end || 0));

  // N = anchor (1 real team) + declared current entries.
  const nowCount = (hasAnchor ? 1 : 0) + current.length;
  const heading = headingClassName ?? "text-[13px] font-head font-bold tracking-[0.15em] uppercase text-[#9CA3AF] mb-3";
  const showEmptyPrompt = list.length === 0 && !hasAnchor && showEmptyCta;

  return (
    <section className="nx-slide-section">
      <h2 className={heading}>Parcours d&apos;équipes</h2>

      {showEmptyPrompt ? (
        <button
          type="button"
          onClick={onAddClick}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#2D3748] bg-[#1A1D24]/40 px-4 py-6 text-[13px] font-semibold text-[#9CA3AF] hover:border-[#E63946]/40 hover:text-white transition-colors"
        >
          <span className="text-[16px] leading-none">+</span> Ajouter un parcours
        </button>
      ) : (
        <>
          {/* ── JOUE ACTUELLEMENT banner ── */}
          {nowCount > 0 && (
            <div className="rounded-xl border border-[#E63946]/40 bg-gradient-to-br from-[#E63946]/[0.12] to-[#E63946]/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3.5">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,0.18)]" />
                <span className="text-[12px] font-bold tracking-[1.5px] text-white">
                  JOUE ACTUELLEMENT · {nowCount} {nowCount === 1 ? "ÉQUIPE" : "ÉQUIPES"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {/* Anchor card — real Nexus affiliation, red left accent */}
                {hasAnchor && anchor && (
                  <div className="flex-1 min-w-[220px] flex items-center gap-3 rounded-lg bg-[#1A1D24] border border-[#2D3748] border-l-[3px] border-l-[#E63946] p-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#E63946] flex items-center justify-center text-[17px] font-bold text-white">
                      {((anchor.teamName || "?").trim().charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[14px] font-bold text-white truncate">{anchor.teamName}</span>
                        <span className="shrink-0 text-[10px] font-bold text-[#E63946] whitespace-nowrap">★ {anchor.label || "NEXUS"}</span>
                      </div>
                      {anchorMeta(anchor) && <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{anchorMeta(anchor)}</p>}
                    </div>
                  </div>
                )}

                {/* Declared current — red-ring avatar */}
                {current.map((e, i) => {
                  const letter = ((e.team_name || "?").trim().charAt(0) || "?").toUpperCase();
                  const meta = currentMeta(e);
                  return (
                    <div key={`cur-${i}`} className="flex-1 min-w-[220px] flex items-center gap-3 rounded-lg bg-[#1A1D24] border border-[#2D3748] p-3">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-[#111317] border-2 border-[#E63946] flex items-center justify-center text-[15px] font-bold text-white">
                        {letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[14px] font-semibold text-white truncate">{e.team_name || "—"}</span>
                        {meta && <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{meta}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── HISTORIQUE (declared past) ── */}
          {past.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#6B7280] mb-2">Historique</p>
              <div>
                {past.map((e, i) => {
                  const letter = ((e.team_name || "?").trim().charAt(0) || "?").toUpperCase();
                  const meta = pastMeta(e);
                  return (
                    <div key={`past-${i}`} className="flex items-center gap-3 py-1.5 opacity-60">
                      <div className="shrink-0 w-[30px] h-[30px] rounded-full bg-[#20242c] flex items-center justify-center text-[12px] font-bold text-[#9CA3AF]">
                        {letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[13px] font-semibold text-[#cbd0d8] truncate">{e.team_name || "—"}</span>
                        {meta && <p className="text-[12px] text-[#6B7280] truncate">{meta}</p>}
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-[#6B7280] whitespace-nowrap">{pastYears(e)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
