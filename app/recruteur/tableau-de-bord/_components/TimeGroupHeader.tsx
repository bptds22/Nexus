/* ─────────────────────────────────────────────────────────────────
   TimeGroupHeader — centered separator between time groups.
   Layout: ─── Hier ───
───────────────────────────────────────────────────────────────── */

export default function TimeGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-1 h-px bg-[#2D3748]" />
      <span className="text-[11px] text-[#6B7280] uppercase tracking-wider font-medium shrink-0">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#2D3748]" />
    </div>
  );
}
