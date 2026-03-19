/* ═══════════════════════════════════════════════════════════════
   ImpactSummaryCard — shows deactivation impact with red left border
   Counts: orphaned athletes, active pipelines, open conversations
═══════════════════════════════════════════════════════════════ */

import Link from "next/link";

interface ImpactItem {
  label: string;
  count: number;
  href?: string;
}

interface ImpactSummaryCardProps {
  items: ImpactItem[];
  className?: string;
}

export default function ImpactSummaryCard({ items, className = "" }: ImpactSummaryCardProps) {
  return (
    <div
      className={`bg-[#1A1D24] rounded-xl border border-[#1e2128] overflow-hidden ${className}`}
      style={{ borderLeft: "4px solid #E63946" }}
    >
      <div className="px-5 py-4 border-b border-[#1e2128]">
        <h3 className="text-[14px] font-bold text-white">
          Impact de la désactivation
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1e2128]">
        {items.map((item) => (
          <div key={item.label} className="bg-[#1A1D24] px-4 py-4 flex flex-col items-center text-center">
            <span
              className="text-[28px] font-head font-black"
              style={{ color: item.count > 0 ? "#E63946" : "#6B7280" }}
            >
              {item.count}
            </span>
            {item.href && item.count > 0 ? (
              <Link
                href={item.href}
                className="text-[11px] font-medium text-[#9CA3AF] hover:text-[#E63946] transition-colors mt-1"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[11px] font-medium text-[#6B7280] mt-1">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
