import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
   Empty State — zero athletes onboarding
───────────────────────────────────────────────────────────────── */

export default function RosterEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Icon */}
      <div className="w-24 h-24 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-6">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      </div>

      <h3 className="font-head text-xl font-black text-white uppercase tracking-wide mb-2">
        Ton roster est vide
      </h3>
      <p className="text-[14px] text-[#9CA3AF] max-w-sm mb-8 leading-relaxed">
        Ajoute ton premier athlète en 2 minutes et commence à le rendre visible aux recruteurs CÉGEP.
      </p>

      <Link
        href="/coach/athletes/create"
        className="flex items-center gap-2.5 bg-[#E63946] text-white rounded-lg px-8 py-3.5 font-head font-bold text-[14px] uppercase tracking-widest
          transition-all duration-150 hover:bg-[#D42B22] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(230,57,70,0.35)] active:scale-95"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
        Ajouter mon premier athlète
      </Link>

      <p className="text-[13px] text-[#6b7280] mt-4 max-w-xs leading-relaxed">
        Tu pourras ajouter des stats, des vidéos et le profil académique ensuite.
      </p>
    </div>
  );
}
