"use client";

/* ═══════════════════════════════════════════════════════════════
   KpiCard — reusable stat surface for the new dashboard system.

   Two sizes:
   - size="full"  : standalone card on the dark scroll area
                    (#16191F bg, 18px padding, 28px value).
   - size="inset" : compact tile for the DashboardHero's inset row
                    (#0C0E12 bg, 12px padding, 20px value).

   Optional slots:
   - icon     : right-aligned visual (full-size only).
   - trend    : ±X% chip (green positive, red negative).
   - progress : { current, total, color? } → 3-4px progress bar.
                Defaults to the verified-blue token (#3B82F6).
                Only pass progress when the stat is a TRUE ratio
                (Vérifiés, Favoris-cap, etc.) — never fake one.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import { triggerHaptic } from "./utils";

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  /** ±X% chip (green when positive, red when negative). */
  trend?: { value: number; positive?: boolean };
  /** 3-4px progress bar. Only use for TRUE ratios. */
  progress?: { current: number; total: number; color?: string };
  size?: "full" | "inset";
  onTap?: () => void;
  className?: string;
}

export function KpiCard({
  label, value, subtitle, icon, trend, progress,
  size = "full", onTap, className = "",
}: KpiCardProps) {
  const isInset = size === "inset";

  const cardBg = isInset ? "bg-[#0C0E12]" : "bg-[#16191F]";
  const cardBorder = isInset ? "border border-white/[0.06]" : "border border-white/[0.08]";
  const cardRadius = isInset ? "rounded-xl" : "rounded-2xl";
  const cardPad = isInset ? "p-3" : "p-[18px]";

  const valueCls = isInset
    ? "text-[20px] font-extrabold text-white leading-none tabular-nums"
    : "text-[28px] font-extrabold text-white leading-none tabular-nums";

  const labelCls = isInset
    ? "text-[9px] uppercase tracking-[0.18em] text-white/55 font-semibold"
    : "text-[11px] uppercase tracking-wider text-white/55 font-semibold";

  const subtitleCls = isInset
    ? "text-[10px] text-white/45"
    : "text-[13px] text-white/45";

  const trendCls = `${isInset ? "text-[9px]" : "text-[11px]"} font-bold px-1.5 py-0.5 rounded ${
    trend && trend.positive !== false && trend.value >= 0
      ? "text-[#22C55E] bg-[#22C55E]/10"
      : "text-[#E63946] bg-[#E63946]/10"
  }`;

  const progressPct = progress && progress.total > 0
    ? Math.max(0, Math.min(100, Math.round((progress.current / progress.total) * 100)))
    : 0;
  const progressColor = progress?.color ?? "#3B82F6";
  const progressTrackH = isInset ? "h-[3px]" : "h-1";

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className={labelCls}>{label}</p>
        {icon && !isInset && <div className="shrink-0">{icon}</div>}
      </div>
      <div className={`flex items-baseline gap-2 ${isInset ? "mt-1" : "mt-2"}`}>
        <p className={valueCls}>{value}</p>
        {trend && (
          <span className={`${trendCls} ${isInset ? "ml-auto" : ""}`}>
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && (
        <p className={`${subtitleCls} mt-1`}>{subtitle}</p>
      )}
      {progress && (
        <div className={`${progressTrackH} mt-2 bg-white/[0.06] rounded overflow-hidden`}>
          <div
            className="h-full rounded transition-[width] duration-300"
            style={{
              width: `${progressPct}%`,
              backgroundColor: progressColor,
            }}
          />
        </div>
      )}
    </>
  );

  const baseCls = `w-full text-left ${cardBg} ${cardRadius} ${cardBorder} ${cardPad} ${className}`;

  if (onTap) {
    return (
      <button
        type="button"
        onClick={() => { triggerHaptic("Light"); onTap(); }}
        className={`${baseCls} active:bg-white/[0.02] transition-colors`}
      >
        {body}
      </button>
    );
  }

  return <div className={baseCls}>{body}</div>;
}
