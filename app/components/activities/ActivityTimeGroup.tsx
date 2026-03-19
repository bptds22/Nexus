/* ─────────────────────────────────────────────────────────────────
   ActivityTimeGroup — date section separator in the feed.
   "AUJOURD'HUI", "HIER", "CETTE SEMAINE", etc.
───────────────────────────────────────────────────────────────── */

export default function ActivityTimeGroup({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 mt-2">
      <div className="flex-1 h-px bg-[#2D3748]" />
      <span className="text-[11px] text-[#6B7280] uppercase tracking-[0.15em] font-bold shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#2D3748]" />
    </div>
  );
}
