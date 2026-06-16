"use client";

import { dictionaries } from "@/lib/i18n/dictionaries";

/* ═══════════════════════════════════════════════════════════════
   CoteChangeConfirmContent — the BODY of the coach cote-change
   confirmation popup. Plugs into ConfirmSheet's `extra` slot
   (the modal chrome stays the shared ConfirmSheet).

   Renders :
     - The 5-rung Nexus scale (index 0 = 5★) from fr.stars.definitions,
       same single source as the public /comment-ca-marche page. Each
       rung : N gold stars + the definition text. Same gold-star canon
       as the Langue commune carousel screen (#F59E0B fill).
     - The rung matching the new cote (round + clamp to 1-5) gets a
       red-tinted bg + "NOUVELLE" pill — same canon as the "TOI" pill.
       null newCote → no rung highlighted (cote being cleared).
     - A diff line below : "Ta nouvelle cote : 3,7★ (avant : 3,2★)"
       with French-comma formatting + drop trailing zeros (3.0 → 3★).

   The rounded-rung highlight + the precise decimal display intentionally
   diverge : a 3.7 cote highlights the 4★ rung (visual anchor on the
   coach-canon scale) but the diff line shows 3,7 (precision the cote
   was actually computed at). The coach sees BOTH — which scale tier
   the cote lands on AND the exact number — without ambiguity.
═══════════════════════════════════════════════════════════════ */

interface Props {
  newCote: number | null;
  originalCote: number | null;
}

function formatCote(c: number | null): string {
  if (c == null) return "non évaluée";
  // FR comma + drop trailing zeros (3.00 → "3", 3.70 → "3,7", 3.75 → "3,75").
  return c.toFixed(2).replace(/\.?0+$/, "").replace(".", ",") + "★";
}

function highlightedRungIndex(newCote: number | null): number | null {
  if (newCote == null) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(newCote)));
  return 5 - rounded; // 5★ rounded → index 0, 4★ → index 1, etc.
}

export default function CoteChangeConfirmContent({ newCote, originalCote }: Props) {
  /* The stars block lives under the `howItWorks` section, NOT at the
     dictionary root. Mirrors how /comment-ca-marche reads it
     (`t.howItWorks.stars.definitions` via useTranslation). The cast +
     `?? []` defensive fallback : if a future dictionary edit drops or
     relocates the block, the modal still renders the title + message +
     cote diff line — the scale is a nice-to-have context, not a
     prerequisite for the confirm gate. */
  const definitions: string[] =
    (dictionaries.fr as unknown as { howItWorks?: { stars?: { definitions?: string[] } } })
      ?.howItWorks?.stars?.definitions ?? [];
  const highlightIndex = highlightedRungIndex(newCote);

  return (
    <div className="space-y-3">
      {/* 5 rungs — index 0 = 5★, mirrors Langue commune carousel structure.
          Only renders when definitions actually resolved ; the diff line
          below ALWAYS renders so the gate works even with empty scale. */}
      {definitions.length > 0 && (
        <div className="space-y-1.5">
          {definitions.map((def, i) => {
            if (def == null) return null; // per-rung guard
            const stars = 5 - i;
            const isHighlight = i === highlightIndex;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg ${
                  isHighlight
                    ? "bg-[#E63946]/10 border border-[#E63946]/30"
                    : "bg-[#13151a]/40 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5" aria-hidden>
                  {Array.from({ length: stars }).map((_, j) => (
                    <svg key={j} width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" aria-hidden>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p
                  className={`flex-1 text-[12px] leading-snug ${
                    isHighlight ? "text-white font-semibold" : "text-[#9CA3AF]"
                  }`}
                >
                  {def}
                </p>
                {isHighlight && (
                  <span className="text-[9px] font-black tracking-[0.18em] uppercase bg-[#E63946] text-white px-2 py-0.5 rounded-full shrink-0">
                    Nouvelle
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Diff line — shows the precise computed cote, NOT the rounded rung. */}
      <p className="text-[12px] text-[#E0E0E0] mt-3 leading-relaxed pt-3 border-t border-white/[0.06]">
        {newCote == null ? (
          <>
            <span className="font-semibold">Cote retirée</span>
            {originalCote != null && (
              <>
                {" "}(avant&nbsp;: <span className="font-semibold">{formatCote(originalCote)}</span>)
              </>
            )}
          </>
        ) : (
          <>
            Ta nouvelle cote&nbsp;: <span className="font-semibold">{formatCote(newCote)}</span>{" "}
            (avant&nbsp;:{" "}
            <span className="font-semibold">
              {originalCote != null ? formatCote(originalCote) : "non évaluée"}
            </span>
            )
          </>
        )}
      </p>
    </div>
  );
}
