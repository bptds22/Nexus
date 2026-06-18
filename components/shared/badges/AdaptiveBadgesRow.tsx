"use client";

/* ═══════════════════════════════════════════════════════════════
   AdaptiveBadgesRow — the 1/2/3/4/5 (2+2 on n=4, 3+2 on n=5) badges
   layout extracted from AthleteRecruiterProfileBodyMobile.tsx:367-431.

   Layout :
   - n = 1       → single centered badge
   - n = 2/3     → single centered row, gap adapts (10/6)
   - n = 4       → 2 on top + 2 on bottom, both rows centered
                   (Sprint C fix : a 4-in-a-row layout at 88px badges
                    + 20px gaps totals 412px, which overflows typical
                    mobile content widths of 343-379px and visibly
                    clipped the 4th label. Mirroring the n=5 two-row
                    pattern keeps badge size + labels intact and
                    matches the existing aesthetic for any badge count
                    that needs more than 3 across.)
   - n = 5       → 3 on top + 2 on bottom, both rows centered

   Optional staggered reveal :
   - mounted=false OR i >= badgesRevealed  → opacity 0, scale 0.4
   - revealed                              → opacity 1, scale 1
   - transition : opacity 200ms ease-out,
                  transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)

   Generic over the item type T. Caller supplies `renderItem`
   to draw the visible content (a DistinctionBadge for athlete
   profile, a ReputationBadgeCell for Ma Réputation, etc.). The
   shared component owns the reveal wrapper, so the renderItem
   returns only the inner content.

   The component is PURE — no fetching, no state.

   Byte-identical to the previous private BadgesRow inside
   AthleteRecruiterProfileBodyMobile when invoked with the same
   props : the wrapper div className, key, style, and gap classes
   are preserved verbatim.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

export interface AdaptiveBadgesRowProps<T> {
  items: T[];
  renderItem: (item: T, index: number, sizeHint: "lg" | "sm") => ReactNode;
  /** Maximum items rendered (truncates beyond). Athlete profile
   *  passes MAX_BADGES (5) ; coach reputation uses default 5. */
  maxBadges?: number;
  /** Stagger gate. When false, all items are hidden (opacity 0).
   *  Defaults to true (skip staggered reveal, show immediately). */
  mounted?: boolean;
  /** Reveal up to N items (i < badgesRevealed). Defaults to
   *  items.length (all revealed at once). */
  badgesRevealed?: number;
}

export function AdaptiveBadgesRow<T>({
  items,
  renderItem,
  maxBadges = 5,
  mounted = true,
  badgesRevealed,
}: AdaptiveBadgesRowProps<T>) {
  if (!items.length) return null;
  const list = items.slice(0, maxBadges);
  const n = list.length;
  const revealedCount = badgesRevealed ?? n;

  const sizeHint: "lg" | "sm" = n === 1 ? "lg" : "sm";

  const renderWrapped = (item: T, i: number) => {
    const revealed = mounted && i < revealedCount;
    return (
      <div
        key={i}
        className="flex-shrink-0"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "scale(1)" : "scale(0.4)",
          transformOrigin: "center",
          transition: "opacity 200ms ease-out, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {renderItem(item, i, sizeHint)}
      </div>
    );
  };

  // N = 5 : 3 en haut, 2 en bas — les deux rangées centrées
  // horizontalement, rangée du bas alignée sous le centre des
  // 3 du haut pour un équilibre 3+2 visuellement propre.
  if (n === 5) {
    const top = list.slice(0, 3);
    const bottom = list.slice(3, 5);
    return (
      <div className="flex flex-col items-center gap-y-3">
        <div className="flex items-center justify-center gap-x-5">
          {top.map((d, i) => renderWrapped(d, i))}
        </div>
        <div className="flex items-center justify-center gap-x-8">
          {bottom.map((d, i) => renderWrapped(d, i + 3))}
        </div>
      </div>
    );
  }

  // N = 4 : 2 en haut, 2 en bas — same two-row pattern as n=5. A
  // single 4-badge row at 88px badges + gap-x-5 (20px) totals 412px,
  // which overflowed typical mobile content widths (343-379px) and
  // visibly clipped the 4th label ("PROGRESSION MARQUÉE"). The 2+2
  // layout fits any mobile width (2×88 + 1×32 = 208px), preserves
  // badge size + labels, and aesthetically mirrors n=5's two-row
  // shape.
  if (n === 4) {
    const top = list.slice(0, 2);
    const bottom = list.slice(2, 4);
    return (
      <div className="flex flex-col items-center gap-y-3">
        <div className="flex items-center justify-center gap-x-8">
          {top.map((d, i) => renderWrapped(d, i))}
        </div>
        <div className="flex items-center justify-center gap-x-8">
          {bottom.map((d, i) => renderWrapped(d, i + 2))}
        </div>
      </div>
    );
  }

  // N = 1..3 — une seule rangée centrée, gap ajusté par count.
  const gapCls =
    n === 1 ? "" :
    n === 2 ? "gap-x-10" :
    "gap-x-6"; // n === 3
  return (
    <div className={`flex items-center justify-center ${gapCls}`}>
      {list.map((d, i) => renderWrapped(d, i))}
    </div>
  );
}
