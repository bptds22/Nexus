"use client";

/* ═══════════════════════════════════════════════════════════════
   WizardPills — sticky pill-chrome header for wizard-style mobile
   editors.

   Cloned from AthleteWizardMobile.tsx :820-852 with the create-mode
   gating (reachableSlides + canProceed + activeChipRef scroll-into-
   view) intentionally LEFT OUT — the athlete editor doesn't have
   step-validation prerequisites the way the coach create flow does.
   The coach wizard keeps its inline version unchanged for now ;
   unifying behind this primitive can come once the athlete wizard
   has shipped and we see what gating semantics actually generalize.

   Surface :
     - Sticky bg-#111317/95 with backdrop blur, safe-area top padding.
     - Row 1 : back chevron + "Étape X/N" eyebrow + title.
     - Row 2 : horizontal scrollable pill row, one per step.

   The optional accentColor per pill drives the mode-color chip used
   by the athlete editor's section header (GREEN for direct, YELLOW
   for suggest, RED for locked). When omitted, the current pill is
   red (#E63946 canon).

   All steps are reachable — there's no validation guard. The athlete
   editor needs to let users jump anywhere ; per-row pending state
   handles the suggest-already-pending case.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react";

export interface WizardPillsProps {
  /** Section labels in order (e.g. ["Identité", "Académique", …]). */
  labels: string[];
  /** Current step index (0-based). */
  active: number;
  /** Tap handler — receives the new step index. */
  onSelect: (i: number) => void;
  /** Optional mode-color per pill (hex). When provided for the
   *  current pill, replaces the canon red accent. Used to show the
   *  section mode (DIRECT green / SUGGEST yellow / LOCKED red). */
  accentColors?: (string | undefined)[];
  /** Eyebrow text shown above the title (e.g. "Mon profil"). */
  eyebrow?: string;
  /** Title text (e.g. athlete's first name). */
  title?: string;
  /** Back-button handler ; renders the back chevron when set. */
  onBack?: () => void;
}

export function WizardPills({
  labels, active, onSelect, accentColors, eyebrow, title, onBack,
}: WizardPillsProps) {
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  // Mirror the coach wizard's auto-scroll-into-view : when the active
  // step changes, scroll the active chip into the visible scroll area
  // so the user can always see where they are. Behavior matches the
  // coach pill chrome.
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return (
    <div
      className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center px-4 pt-2 gap-2 min-h-[56px]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
              {eyebrow} {active + 1} / {labels.length}
            </p>
          )}
          {title && (
            <p className="text-[15px] font-bold text-white truncate">{title}</p>
          )}
        </div>
      </div>
      <div className="w-full min-w-0 overflow-x-auto px-4 pt-1 pb-3 nx-no-scrollbar">
        <div className="flex items-center gap-2">
          {labels.map((label, i) => {
            const isCurrent = i === active;
            const accent = accentColors?.[i];
            const baseCls = "px-4 py-2 rounded-full text-[12px] font-bold uppercase tracking-[0.14em] whitespace-nowrap transition-colors";
            // When current : red accent OR mode-color override.
            // When inactive : neutral grey, tappable.
            const chipStyle = isCurrent && accent
              ? { backgroundColor: accent, color: "#FFFFFF" }
              : undefined;
            const chipCls = isCurrent
              ? (accent ? "" : "bg-[#E63946] text-white")
              : "bg-[#1A1D24] text-white/70 border border-white/[0.06] active:bg-white/[0.04]";
            return (
              <button
                key={i}
                type="button"
                ref={isCurrent ? activeChipRef : null}
                onClick={() => onSelect(i)}
                className={`${baseCls} ${chipCls}`}
                style={chipStyle}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
