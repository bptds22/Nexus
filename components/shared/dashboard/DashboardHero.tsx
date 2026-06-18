"use client";

/* ═══════════════════════════════════════════════════════════════
   DashboardHero — floating card sitting on the gradient.

   Surface : #16191F bg, 0.5px (~) border, rounded-[20px], subtle
   shadow. Watermark X-flame in the corner at low opacity (reuses
   the existing /brand/icon-black.svg asset as a CSS mask so it
   re-colors to the brand red without serving a new SVG).

   Slots :
   - eyebrow   : small uppercase label above the headline.
   - headline  : ReactNode — the role passes its own 1-2 line
                 headline (second line can be accented #E63946).
   - pulseBadge: optional pulse-dot CTA inside the card.
   - insets    : 0-3 small KpiCards in a row at the bottom of the
                 card. Use { size: "inset", … } props.

   The role passes its data via insets. Pure component — no fetch.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { KpiCard, type KpiCardProps } from "./KpiCard";
import { triggerHaptic } from "./utils";

export interface DashboardHeroProps {
  eyebrow?: string;
  headline: ReactNode;
  /** Inset stats row at the bottom of the card. Max 3. */
  insets?: Omit<KpiCardProps, "size">[];
  /** Optional pulse badge (e.g. "{N} suggestions à examiner"). */
  pulseBadge?: { label: string; onTap: () => void };
  /** Show the X-flame watermark in the card corner. */
  showWatermark?: boolean;
}

export function DashboardHero({
  eyebrow, headline, insets, pulseBadge, showWatermark = true,
}: DashboardHeroProps) {
  const insetsCount = Math.min(insets?.length ?? 0, 3);
  return (
    <div className="px-4">
      <div
        className="relative overflow-hidden rounded-[20px] p-5 bg-[#16191F] border border-white/[0.08]"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}
      >
        {/* X-flame watermark — low-opacity brand red, masked from the
            existing icon asset so we don't ship a new SVG. */}
        {showWatermark && (
          <div
            className="absolute pointer-events-none"
            style={{ top: 32, right: -60, width: 260, height: 260, opacity: 0.07, zIndex: 0 }}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundColor: "#FFFFFF",
                WebkitMaskImage: "url(/brand/icon-black.svg)",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                WebkitMaskSize: "contain",
                maskImage: "url(/brand/icon-black.svg)",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                maskSize: "contain",
              }}
            />
          </div>
        )}

        {/* Content over the watermark */}
        <div className="relative" style={{ zIndex: 1 }}>
          {eyebrow && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-2">
              {eyebrow}
            </p>
          )}

          {/* Headline area — caller passes pre-styled ReactNode so it can
              accent the second line in red. The string fallback gives a
              sane default for the trivial case. */}
          <div className="max-w-[80%]">
            {typeof headline === "string" ? (
              <h2 className="text-[24px] font-extrabold text-white leading-tight tracking-tight">
                {headline}
              </h2>
            ) : (
              headline
            )}
          </div>

          {pulseBadge && (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); pulseBadge.onTap(); }}
              className="inline-flex items-center gap-2 mt-4 rounded-full bg-white/[0.08] backdrop-blur-sm px-3 py-1.5 active:bg-white/[0.12] transition-colors"
            >
              <span className="relative flex w-2 h-2 flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#E63946] animate-ping opacity-60" />
                <span className="relative w-2 h-2 rounded-full bg-[#E63946]" />
              </span>
              <span className="text-[13px] text-white font-semibold">{pulseBadge.label}</span>
            </button>
          )}

          {insetsCount > 0 && (
            <div
              className={`grid gap-2 mt-5 ${
                insetsCount === 1 ? "grid-cols-1" :
                insetsCount === 2 ? "grid-cols-2" :
                "grid-cols-3"
              }`}
            >
              {insets!.slice(0, 3).map((stat, i) => (
                <KpiCard
                  key={i}
                  {...stat}
                  size="inset"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
