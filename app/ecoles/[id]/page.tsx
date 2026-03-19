import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   École Profile — Placeholder page (Phase 1)
   Will be fleshed out when school directories are built.
═══════════════════════════════════════════════════════════════ */

export default async function EcolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-[#060A14] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-white/5 flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">
          Profil d&apos;école
        </h1>
        <p className="text-[14px] text-[#9CA3AF] leading-relaxed">
          La page de profil pour cette école (<span className="font-mono text-[#6B7280]">{id}</span>) sera disponible prochainement.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#E63946] hover:text-[#D93C3C] transition-colors mt-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
