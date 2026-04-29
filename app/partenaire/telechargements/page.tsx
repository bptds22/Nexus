"use client";

export default function PartnerTelechargementsPage() {
  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1100px] mx-auto">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Téléchargements</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">Historique des cartes téléchargées et métriques d&apos;usage</p>
      </div>
      <div className="mt-8 bg-[#1A1D24] border border-[#2D3748] rounded-xl p-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F59E0B]/15 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">Bientôt disponible</h2>
        <p className="text-[13px] text-[#9CA3AF] mt-2 max-w-md mx-auto">
          Phase 2 ouvrira l&apos;endpoint de téléchargement de cartes. Chaque téléchargement sera enregistré ici avec l&apos;athlète, le format, et la date.
        </p>
      </div>
    </div>
  );
}
