/* ─────────────────────────────────────────────────────────────────
   Favorite Signal — red heart + count
───────────────────────────────────────────────────────────────── */

export default function FavoriteSignal({ count }: { count: number }) {
  if (count === 0) return <span className="text-[12px] text-[#2D3748]" />;

  return (
    <div className="flex items-center gap-1">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#E63946" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      {count > 1 && (
        <span className="text-[12px] font-bold text-[#E63946]">{count}</span>
      )}
    </div>
  );
}
