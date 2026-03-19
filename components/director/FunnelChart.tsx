"use client";

import Link from "next/link";

export interface FunnelStage {
  stage: string;
  value: number;
  color: string;
  href?: string;
}

interface FunnelChartProps {
  title: string;
  data: FunnelStage[];
}

export default function FunnelChart({ title, data }: FunnelChartProps) {
  if (data.length === 0) return null;

  const maxValue = data[0].value;

  return (
    <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-5 sm:p-6">
      <h3 className="font-head text-[15px] font-bold text-white mb-5">
        {title}
      </h3>

      <div className="space-y-3">
        {data.map((stage, index) => {
          const widthPct = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const prevValue = index > 0 ? data[index - 1].value : null;
          const conversionPct =
            prevValue && prevValue > 0
              ? Math.round((stage.value / prevValue) * 100)
              : null;

          const content = (
            <>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-[#e0e0e0] group-hover:text-white transition-colors">
                  {stage.stage}
                </span>
                <div className="flex items-center gap-2">
                  {conversionPct !== null && (
                    <span className="text-[11px] text-[#6B7280]">
                      {conversionPct}%
                    </span>
                  )}
                  <span className="text-[14px] font-bold text-white min-w-[28px] text-right">
                    {stage.value}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2.5 rounded-full bg-[#2A2D35] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-125"
                  style={{
                    width: `${Math.max(widthPct, 4)}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
            </>
          );

          return stage.href ? (
            <Link
              key={stage.stage}
              href={stage.href}
              className="block group rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
            >
              {content}
            </Link>
          ) : (
            <div key={stage.stage}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
